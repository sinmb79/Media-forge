import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { loadForgeDefaults } from "../forge/config/load-forge-defaults.js";
import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";
import { inspectBackends } from "./registry.js";
import { ensureBackendReady } from "./supervisor.js";
import type {
  BackendExecutionRequest,
  BackendExecutionResult,
  IBackend,
} from "./types.js";

export interface ComfyUIQueueResponse {
  prompt_id: string;
  number?: number;
  node_errors?: Record<string, unknown>;
}

export interface ComfyUIOutputFile {
  filename: string;
  subfolder: string;
  type: string;
}

export interface ComfyUIStatusResult {
  prompt_id: string;
  status: string;
  completed: boolean;
  outputs: ComfyUIOutputFile[];
  raw: Record<string, unknown>;
}

interface FetchLike {
  (url: string, init?: RequestInit): Promise<Response>;
}

export interface ComfyUIBackendOptions {
  autoStart?: boolean;
  baseUrl?: string;
  fetchFn?: FetchLike;
  pollIntervalMs?: number;
  rootDir?: string;
  startService?: () => Promise<void>;
}

export class ComfyUIBackend implements IBackend {
  readonly name = "comfyui" as const;
  private readonly options: ComfyUIBackendOptions;

  constructor(options: ComfyUIBackendOptions = {}) {
    this.options = options;
  }

  async isAvailable(): Promise<boolean> {
    const status = await lookupBackendStatus(this.name);
    return status?.available ?? false;
  }

  async getVersion(): Promise<string | null> {
    const status = await lookupBackendStatus(this.name);
    return status?.version ?? null;
  }

  async queueWorkflow(
    workflow: unknown,
    options: { autoStart?: boolean; clientId?: string } = {},
  ): Promise<ComfyUIQueueResponse> {
    const baseUrl = await this.resolveBaseUrl();
    const payload = {
      client_id: options.clientId ?? "mediaforge",
      prompt: workflow,
    };

    try {
      const response = await this.fetch(baseUrl, "/prompt", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      return await response.json() as ComfyUIQueueResponse;
    } catch (error) {
      if (options.autoStart ?? this.options.autoStart) {
        if (this.options.startService) {
          await this.options.startService();
        } else {
          const ensured = await ensureBackendReady("comfyui", {
            ...(this.options.rootDir ? { rootDir: this.options.rootDir } : {}),
          });

          if (!ensured.ready) {
            throw new Error(ensured.reason ?? "ComfyUI auto-start failed.");
          }
        }
        const retryResponse = await this.fetch(baseUrl, "/prompt", {
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        return await retryResponse.json() as ComfyUIQueueResponse;
      }

      throw error;
    }
  }

  async getStatus(promptId: string): Promise<ComfyUIStatusResult> {
    const baseUrl = await this.resolveBaseUrl();
    const response = await this.fetch(baseUrl, `/history/${promptId}`, { method: "GET" });
    const payload = await response.json() as Record<string, unknown>;
    const historyRecord = payload[promptId] as Record<string, unknown> | undefined;
    const statusRecord = historyRecord?.status as Record<string, unknown> | undefined;
    const outputsRecord = historyRecord?.outputs as Record<string, unknown> | undefined;

    return {
      completed: Boolean(statusRecord?.completed),
      outputs: extractOutputs(outputsRecord),
      prompt_id: promptId,
      raw: historyRecord ?? {},
      status: typeof statusRecord?.status_str === "string" ? statusRecord.status_str : "pending",
    };
  }

  async downloadOutput(file: ComfyUIOutputFile): Promise<Buffer> {
    const baseUrl = await this.resolveBaseUrl();
    const query = new URLSearchParams({
      filename: file.filename,
      subfolder: file.subfolder,
      type: file.type,
    });
    const response = await this.fetch(baseUrl, `/view?${query.toString()}`, { method: "GET" });
    return Buffer.from(await response.arrayBuffer());
  }

  async waitForCompletion(
    promptId: string,
    options: { maxAttempts?: number; pollIntervalMs?: number } = {},
  ): Promise<ComfyUIStatusResult> {
    const maxAttempts = options.maxAttempts ?? 360;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const status = await this.getStatus(promptId);
      if (status.completed || status.status === "success" || status.status === "error") {
        return status;
      }

      await sleep(options.pollIntervalMs ?? this.options.pollIntervalMs ?? 5000);
    }

    throw new Error(`Timed out waiting for ComfyUI prompt ${promptId}`);
  }

  async execute(request: BackendExecutionRequest): Promise<BackendExecutionResult> {
    const workflow = request.payload ?? request.args?.[0];

    if (!workflow) {
      throw new Error("ComfyUI execution requires a workflow payload.");
    }

    const queued = await this.queueWorkflow(workflow);
    return {
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify(queued),
    };
  }

  async saveDownloadedOutput(output: ComfyUIOutputFile, targetPath: string): Promise<string> {
    const content = await this.downloadOutput(output);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content);
    return targetPath;
  }

  private async resolveBaseUrl(): Promise<string> {
    if (this.options.baseUrl) {
      return this.options.baseUrl;
    }

    const defaults = await loadForgeDefaults(this.options.rootDir ?? resolveMediaForgeRoot());
    const port = defaults.comfyui?.default_port ?? 8188;
    return `http://127.0.0.1:${port}`;
  }

  private async fetch(baseUrl: string, pathname: string, init: RequestInit): Promise<Response> {
    const response = await (this.options.fetchFn ?? fetch)(`${baseUrl}${pathname}`, init);

    if (!response.ok) {
      throw new Error(`ComfyUI request failed: ${response.status} ${response.statusText}`);
    }

    return response;
  }
}

async function lookupBackendStatus(name: IBackend["name"]) {
  const statuses = await inspectBackends();
  return statuses.find((status) => status.name === name) ?? null;
}

function extractOutputs(outputsRecord: Record<string, unknown> | undefined): ComfyUIOutputFile[] {
  if (!outputsRecord) {
    return [];
  }

  return Object.values(outputsRecord)
    .flatMap((entry) => {
      const images = (entry as { images?: unknown[] }).images;
      const videos = (entry as { videos?: unknown[] }).videos;
      return [
        ...(Array.isArray(images) ? images : []),
        ...(Array.isArray(videos) ? videos : []),
      ];
    })
    .filter((asset): asset is ComfyUIOutputFile => {
      return (
        typeof asset === "object" &&
        asset !== null &&
        typeof (asset as { filename?: unknown }).filename === "string" &&
        typeof (asset as { subfolder?: unknown }).subfolder === "string" &&
        typeof (asset as { type?: unknown }).type === "string"
      );
    });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
