import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { inspectBackends } from "../../backends/registry.js";
import type { BackendStatus } from "../../backends/types.js";
import { loadDesktopRuntimeStageSnapshot, type DesktopRuntimeStageSnapshot } from "../../desktop/runtime-staging.js";
import { createDesktopRuntimeManifest } from "../../desktop/runtime-manifest.js";
import { buildForgeDoctorReport } from "../doctor/build-forge-doctor-report.js";
import { validateForgePaths } from "../doctor/validate-forge-paths.js";
import type { ForgeDoctorResult, ForgePathsValidationResult } from "../contracts.js";
import { runImageGenerate } from "../image/generate.js";
import { runSketchToImage } from "../image/sketch-to-image.js";
import { runVideoFromImage } from "../video/from-image.js";
import { runVideoFromText } from "../video/from-text.js";
import { buildForgePromptBundle } from "../../prompt/forge-prompt-builder.js";
import { OllamaBackend } from "../../backends/ollama.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export type OpenClawActionId =
  | "doctor"
  | "probe"
  | "paths.validate"
  | "prompt.build"
  | "image.generate"
  | "image.sketch"
  | "video.from-image"
  | "video.from-text";

export interface OpenClawActionRecord {
  expects_artifact: boolean;
  id: OpenClawActionId;
  label: string;
}

export interface OpenClawBridgeManifest {
  actions: OpenClawActionRecord[];
  backends: BackendStatus[];
  doctor: ForgeDoctorResult;
  openclaw: {
    actions: OpenClawActionRecord[];
    host: string;
    port: number;
    root_dir: string;
    running: boolean;
    url: string;
  };
  schema_version: "0.1";
  stage: DesktopRuntimeStageSnapshot;
}

export interface OpenClawBridgeDependencies {
  buildDoctorReportFn?: () => Promise<ForgeDoctorResult>;
  buildPromptBundleFn?: typeof buildForgePromptBundle;
  inspectBackendsFn?: typeof inspectBackends;
  loadStageSnapshotFn?: (input?: { rootDir?: string }) => Promise<DesktopRuntimeStageSnapshot>;
  runImageGenerateFn?: typeof runImageGenerate;
  runSketchToImageFn?: typeof runSketchToImage;
  runVideoFromImageFn?: typeof runVideoFromImage;
  runVideoFromTextFn?: typeof runVideoFromText;
  validatePathsFn?: (rootDir?: string) => Promise<ForgePathsValidationResult>;
}

export interface StartOpenClawBridgeOptions {
  host?: string;
  port?: number;
  rootDir?: string;
}

export interface StartedOpenClawBridgeServer {
  close(): Promise<void>;
  host: string;
  port: number;
  rootDir: string;
  server: Server;
  url: string;
}

const OPENCLAW_ACTIONS: OpenClawActionRecord[] = [
  { expects_artifact: false, id: "doctor", label: "Doctor" },
  { expects_artifact: false, id: "probe", label: "Probe backends" },
  { expects_artifact: false, id: "paths.validate", label: "Validate paths" },
  { expects_artifact: false, id: "prompt.build", label: "Build prompt bundle" },
  { expects_artifact: true, id: "image.generate", label: "Generate image" },
  { expects_artifact: true, id: "image.sketch", label: "Sketch to image" },
  { expects_artifact: true, id: "video.from-image", label: "Image to video" },
  { expects_artifact: true, id: "video.from-text", label: "Text to video" },
];

export async function inspectOpenClawBridge(
  input: StartOpenClawBridgeOptions = {},
  dependencies: OpenClawBridgeDependencies = {},
): Promise<OpenClawBridgeManifest> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const manifest = createDesktopRuntimeManifest({ rootDir });
  const host = input.host?.trim() || manifest.openclaw.host;
  const port = input.port ?? manifest.openclaw.port;
  const url = `http://${host}:${port}`;
  const [doctor, backends, running, stage] = await Promise.all([
    (dependencies.buildDoctorReportFn ?? (() => buildForgeDoctorReport({ rootDir })))(),
    (dependencies.inspectBackendsFn ?? inspectBackends)(rootDir),
    isOpenClawBridgeRunning(url),
    (dependencies.loadStageSnapshotFn ?? ((stageInput) => loadDesktopRuntimeStageSnapshot(stageInput)))({
      rootDir,
    }),
  ]);

  return {
    actions: OPENCLAW_ACTIONS,
    backends,
    doctor,
    openclaw: {
      actions: OPENCLAW_ACTIONS,
      host,
      port,
      root_dir: rootDir,
      running,
      url,
    },
    schema_version: "0.1",
    stage,
  };
}

export async function startOpenClawBridgeServer(
  input: StartOpenClawBridgeOptions = {},
  dependencies: OpenClawBridgeDependencies = {},
): Promise<StartedOpenClawBridgeServer> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const manifest = createDesktopRuntimeManifest({ rootDir });
  const host = input.host?.trim() || manifest.openclaw.host;
  const port = input.port ?? manifest.openclaw.port;
  const runtimeContext = {
    dependencies,
    host,
    port,
    rootDir,
  };
  const server = createServer(async (request, response) => {
    await routeOpenClawRequest(request, response, runtimeContext);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo | null;
  const resolvedPort = address?.port ?? port;
  const resolvedHost = address?.address && address.address !== "::" ? address.address : host;
  runtimeContext.host = resolvedHost;
  runtimeContext.port = resolvedPort;

  return {
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
    host: resolvedHost,
    port: resolvedPort,
    rootDir,
    server,
    url: `http://${resolvedHost}:${resolvedPort}`,
  };
}

async function routeOpenClawRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: {
    dependencies: OpenClawBridgeDependencies;
    host: string;
    port: number;
    rootDir: string;
  },
): Promise<void> {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = requestUrl.pathname;
  const method = request.method ?? "GET";

  if (method === "GET" && pathname === "/health") {
    sendJson(response, 200, {
      bridge: "openclaw",
      generated_at: new Date().toISOString(),
      root_dir: context.rootDir,
      schema_version: "0.1",
      status: "ok",
      url: `http://${context.host}:${context.port}`,
    });
    return;
  }

  if (method === "GET" && pathname === "/manifest") {
    const manifest = await inspectOpenClawBridge({
      host: context.host,
      port: context.port,
      rootDir: context.rootDir,
    }, context.dependencies);
    manifest.openclaw = {
      ...manifest.openclaw,
      host: context.host,
      port: context.port,
      running: true,
      url: `http://${context.host}:${context.port}`,
    };
    sendJson(response, 200, manifest);
    return;
  }

  if (method === "POST" && pathname === "/invoke") {
    const payload = await readJsonBody(request);
    const action = typeof payload.action === "string" ? payload.action as OpenClawActionId : null;

    if (!action) {
      sendJson(response, 422, { reason: "Missing action." });
      return;
    }

    try {
      const result = await invokeOpenClawAction(action, payload.input, context);
      sendJson(response, 200, {
        action,
        output: result,
        schema_version: "0.1",
        status: "completed",
      });
    } catch (error) {
      sendJson(response, 422, {
        action,
        reason: error instanceof Error ? error.message : "OpenClaw action failed.",
        status: "failed",
      });
    }
    return;
  }

  sendJson(response, 404, { error: "Not Found" });
}

async function invokeOpenClawAction(
  action: OpenClawActionId,
  rawInput: unknown,
  context: {
    dependencies: OpenClawBridgeDependencies;
    rootDir: string;
  },
): Promise<unknown> {
  const input = isRecord(rawInput) ? rawInput : {};

  if (action === "doctor") {
    return (context.dependencies.buildDoctorReportFn ?? (() => buildForgeDoctorReport({ rootDir: context.rootDir })))();
  }

  if (action === "probe") {
    return {
      backends: await (context.dependencies.inspectBackendsFn ?? inspectBackends)(context.rootDir),
      schema_version: "0.1",
    };
  }

  if (action === "paths.validate") {
    return (context.dependencies.validatePathsFn ?? validateForgePaths)(context.rootDir);
  }

  if (action === "prompt.build") {
    const model = readOptionalString(input, ["model"]);
    const theme = readOptionalString(input, ["theme"]);
    return (context.dependencies.buildPromptBundleFn ?? buildForgePromptBundle)({
      desc_ko: readRequiredString(input, ["desc_ko", "desc", "prompt"], "desc_ko"),
      ollamaClient: new OllamaBackend({ autoStart: true, rootDir: context.rootDir }),
      ...(model ? { model } : {}),
      ...(theme ? { theme } : {}),
    });
  }

  if (action === "image.generate") {
    const negativePrompt = readOptionalString(input, ["negative_prompt"]);
    const outputDir = readOptionalString(input, ["output_dir"]);
    const seed = readOptionalNumber(input, "seed");
    const theme = readOptionalString(input, ["theme"]);
    return (context.dependencies.runImageGenerateFn ?? runImageGenerate)({
      aspect_ratio: readAspectRatio(input, "aspect_ratio", "9:16"),
      batch_count: readPositiveInteger(input, "batch_count", 1),
      model: readImageModel(input, "model", "sdxl"),
      prompt: readRequiredString(input, ["prompt", "desc_ko"], "prompt"),
      resolution: readImageResolution(input, "resolution", "2k"),
      rootDir: context.rootDir,
      simulate: readBoolean(input, "simulate", false),
      ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
      ...(outputDir ? { outputDir } : {}),
      ...(seed !== undefined ? { seed } : {}),
      ...(theme ? { theme } : {}),
    });
  }

  if (action === "image.sketch") {
    const outputDir = readOptionalString(input, ["output_dir"]);
    const theme = readOptionalString(input, ["theme"]);
    return (context.dependencies.runSketchToImageFn ?? runSketchToImage)({
      desc_ko: readRequiredString(input, ["desc_ko", "desc"], "desc_ko"),
      rootDir: context.rootDir,
      simulate: readBoolean(input, "simulate", false),
      sketchPath: readRequiredString(input, ["sketchPath", "sketch_path"], "sketchPath"),
      ...(outputDir ? { outputDir } : {}),
      ...(theme ? { theme } : {}),
    });
  }

  if (action === "video.from-image") {
    const outputDir = readOptionalString(input, ["output_dir"]);
    const theme = readOptionalString(input, ["theme"]);
    return (context.dependencies.runVideoFromImageFn ?? runVideoFromImage)({
      desc_ko: readRequiredString(input, ["desc_ko", "desc"], "desc_ko"),
      imagePath: readRequiredString(input, ["imagePath", "image_path"], "imagePath"),
      model: readVideoModel(input, "model", "wan22"),
      quality: readVideoQuality(input, "quality", "production"),
      rootDir: context.rootDir,
      simulate: readBoolean(input, "simulate", false),
      ...(outputDir ? { outputDir } : {}),
      ...(theme ? { theme } : {}),
    });
  }

  if (action === "video.from-text") {
    const outputDir = readOptionalString(input, ["output_dir"]);
    const theme = readOptionalString(input, ["theme"]);
    return (context.dependencies.runVideoFromTextFn ?? runVideoFromText)({
      desc_ko: readRequiredString(input, ["desc_ko", "desc"], "desc_ko"),
      model: readVideoModel(input, "model", "wan22"),
      quality: readVideoQuality(input, "quality", "production"),
      rootDir: context.rootDir,
      simulate: readBoolean(input, "simulate", false),
      ...(outputDir ? { outputDir } : {}),
      ...(theme ? { theme } : {}),
    });
  }

  throw new Error(`Unsupported OpenClaw action: ${action}.`);
}

async function isOpenClawBridgeRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw.length > 0 ? JSON.parse(raw) as Record<string, unknown> : {};
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRequiredString(
  input: Record<string, unknown>,
  keys: string[],
  label: string,
): string {
  const value = readOptionalString(input, keys);
  if (!value) {
    throw new Error(`Missing required field: ${label}.`);
  }

  return value;
}

function readOptionalString(
  input: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function readOptionalNumber(
  input: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = input[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readPositiveInteger(
  input: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = input[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function readBoolean(
  input: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const value = input[key];
  return typeof value === "boolean" ? value : fallback;
}

function readAspectRatio(
  input: Record<string, unknown>,
  key: string,
  fallback: "1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "3:2" | "21:9",
): "1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "3:2" | "21:9" {
  const value = input[key];

  return value === "1:1"
    || value === "3:4"
    || value === "4:3"
    || value === "16:9"
    || value === "9:16"
    || value === "2:3"
    || value === "3:2"
    || value === "21:9"
    ? value
    : fallback;
}

function readImageModel(
  input: Record<string, unknown>,
  key: string,
  fallback: "sdxl" | "flux",
): "sdxl" | "flux" {
  const value = input[key];
  return value === "sdxl" || value === "flux" ? value : fallback;
}

function readImageResolution(
  input: Record<string, unknown>,
  key: string,
  fallback: "1k" | "2k" | "4k",
): "1k" | "2k" | "4k" {
  const value = input[key];
  return value === "1k" || value === "2k" || value === "4k" ? value : fallback;
}

function readVideoModel(
  input: Record<string, unknown>,
  key: string,
  fallback: "wan22" | "ltx2",
): "wan22" | "ltx2" {
  const value = input[key];
  return value === "wan22" || value === "ltx2" ? value : fallback;
}

function readVideoQuality(
  input: Record<string, unknown>,
  key: string,
  fallback: "draft" | "production",
): "draft" | "production" {
  const value = input[key];
  return value === "draft" || value === "production" ? value : fallback;
}
