import { loadForgeDefaults } from "../forge/config/load-forge-defaults.js";
import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";
import { inspectBackends } from "./registry.js";
import { ensureBackendReady } from "./supervisor.js";
import type {
  BackendExecutionRequest,
  BackendExecutionResult,
  IBackend,
} from "./types.js";

interface FetchLike {
  (url: string, init?: RequestInit): Promise<Response>;
}

export interface OllamaBackendOptions {
  autoStart?: boolean;
  baseUrl?: string;
  defaultModel?: string;
  fetchFn?: FetchLike;
  rootDir?: string;
  systemPrompt?: string;
}

const DEFAULT_SYSTEM_PROMPT = "You are a prompt engineer for SD XL and Wan 2.2 video generation. Convert the user's Korean scene description into optimized English prompts. Output JSON: { image_prompt, image_negative, video_prompt, video_negative }";

export class OllamaBackend implements IBackend {
  readonly name = "ollama" as const;
  private readonly options: OllamaBackendOptions;

  constructor(options: OllamaBackendOptions = {}) {
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

  async generate(prompt: string, model?: string): Promise<string> {
    return this.generateWithSystemPrompt(
      prompt,
      model,
      this.options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    );
  }

  async generateWithSystemPrompt(
    prompt: string,
    model: string | undefined,
    systemPrompt: string,
  ): Promise<string> {
    const baseUrl = await this.resolveBaseUrl();
    const performRequest = async () => {
      const response = await (this.options.fetchFn ?? fetch)(`${baseUrl}/api/generate`, {
        body: JSON.stringify({
          format: "json",
          model: model ?? await this.resolveDefaultModel(),
          prompt,
          stream: false,
          system: systemPrompt,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
      }

      return response;
    };

    let response: Response;
    try {
      response = await performRequest();
    } catch (error) {
      if (!this.options.autoStart) {
        throw error;
      }

      const ensured = await ensureBackendReady("ollama", {
        ...(this.options.rootDir ? { rootDir: this.options.rootDir } : {}),
      });

      if (!ensured.ready) {
        throw new Error(ensured.reason ?? "Ollama auto-start failed.");
      }

      response = await performRequest();
    }

    const payload = await response.json() as { response?: string; thinking?: string };
    return payload.response?.trim() || payload.thinking?.trim() || "";
  }

  async execute(request: BackendExecutionRequest): Promise<BackendExecutionResult> {
    const prompt = request.args?.join(" ").trim();

    if (!prompt) {
      throw new Error("Ollama execution requires prompt text.");
    }

    const output = await this.generate(prompt);
    return {
      exitCode: 0,
      stderr: "",
      stdout: output,
    };
  }

  private async resolveBaseUrl(): Promise<string> {
    if (this.options.baseUrl) {
      return this.options.baseUrl;
    }

    const defaults = await loadForgeDefaults(this.options.rootDir ?? resolveMediaForgeRoot());
    const port = defaults.ollama?.default_port ?? 11434;
    return `http://127.0.0.1:${port}`;
  }

  private async resolveDefaultModel(): Promise<string> {
    if (this.options.defaultModel) {
      return this.options.defaultModel;
    }

    const defaults = await loadForgeDefaults(this.options.rootDir ?? resolveMediaForgeRoot());
    return defaults.ollama?.default_model ?? "qwen3:14b";
  }
}

async function lookupBackendStatus(name: IBackend["name"]) {
  const statuses = await inspectBackends();
  return statuses.find((status) => status.name === name) ?? null;
}
