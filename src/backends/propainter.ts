import { access, copyFile, mkdir } from "node:fs/promises";
import * as path from "node:path";

import { defaultExecFile, type ExecFileLike } from "./process-runner.js";
import { inspectBackends } from "./registry.js";
import type {
  BackendExecutionRequest,
  BackendExecutionResult,
  IBackend,
} from "./types.js";

export interface ProPainterRunInput {
  fp16?: boolean;
  height?: number;
  inputPath: string;
  maskPath: string;
  outputPath: string;
  width?: number;
}

export interface ProPainterBackendOptions {
  execFileFn?: ExecFileLike;
  pythonPath?: string;
  resolveRuntime?: () => Promise<{ cwd?: string; pythonPath: string; scriptPath: string }>;
  rootDir?: string;
  scriptPath?: string;
}

export class ProPainterBackend implements IBackend {
  readonly name = "propainter" as const;
  private readonly options: ProPainterBackendOptions;

  constructor(options: ProPainterBackendOptions = {}) {
    this.options = options;
  }

  async isAvailable(): Promise<boolean> {
    const status = await lookupBackendStatus(this.name);
    return status?.available ?? false;
  }

  async getVersion(): Promise<string | null> {
    return null;
  }

  async execute(request: BackendExecutionRequest): Promise<BackendExecutionResult> {
    const runtime = this.options.resolveRuntime
      ? await this.options.resolveRuntime()
      : await resolveProPainterRuntime(this.options);
    const cwd = request.cwd ?? runtime.cwd;

    return (this.options.execFileFn ?? defaultExecFile)(
      runtime.pythonPath,
      [runtime.scriptPath, ...(request.args ?? [])],
      cwd
        ? { cwd }
        : undefined,
    );
  }

  async run(input: ProPainterRunInput): Promise<string> {
    const [width, height] = resolveProPainterFrameSize(input.width, input.height);
    const requestedOutputPath = path.resolve(input.outputPath);
    const outputRoot = path.join(
      path.dirname(requestedOutputPath),
      `${path.basename(requestedOutputPath, path.extname(requestedOutputPath))}-propainter`,
    );

    await mkdir(outputRoot, { recursive: true });
    const preparedInputPath = await prepareInputForProPainter(
      input.inputPath,
      outputRoot,
      width,
      height,
      this.options.rootDir,
    );
    const execution = await this.execute({
      args: [
        "--video",
        preparedInputPath,
        "--mask",
        input.maskPath,
        "--output",
        outputRoot,
        "--width",
        String(width),
        "--height",
        String(height),
        ...(input.fp16 ?? true ? ["--fp16"] : []),
      ],
    });
    ensureSuccessfulExecution(execution);

    const generatedOutputPath = path.join(
      outputRoot,
      resolveProPainterVideoName(preparedInputPath),
      "inpaint_out.mp4",
    );

    await copyFile(generatedOutputPath, requestedOutputPath);
    return requestedOutputPath;
  }
}

export function resolveProPainterFrameSize(width?: number, height?: number): [number, number] {
  return [width ?? 576, height ?? 320];
}

function resolveProPainterVideoName(inputPath: string): string {
  const normalizedInput = path.resolve(inputPath);
  return path.basename(normalizedInput, path.extname(normalizedInput));
}

async function prepareInputForProPainter(
  inputPath: string,
  outputRoot: string,
  width: number,
  height: number,
  rootDir?: string,
): Promise<string> {
  if (!isVideoPath(inputPath)) {
    return inputPath;
  }

  const framesDir = path.join(
    outputRoot,
    `${path.basename(inputPath, path.extname(inputPath))}-frames`,
  );
  await mkdir(framesDir, { recursive: true });
  const ffmpegPath = await lookupBackendExecutablePath("ffmpeg", rootDir) ?? "ffmpeg";
  const extraction = await defaultExecFile(
    ffmpegPath,
    [
      "-y",
      "-i",
      inputPath,
      "-vf",
      `scale=${width}:${height}`,
      path.join(framesDir, "%05d.png"),
    ],
  );
  ensureSuccessfulExecution(extraction);
  return framesDir;
}

function ensureSuccessfulExecution(result: BackendExecutionResult): void {
  if (result.exitCode === 0) {
    return;
  }

  const detail = [result.stderr, result.stdout]
    .map((value) => value.trim())
    .find((value) => value.length > 0);
  throw new Error(detail ? `ProPainter failed: ${detail}` : "ProPainter failed.");
}

function isVideoPath(inputPath: string): boolean {
  return [".mp4", ".mov", ".avi", ".mkv", ".webm"].includes(path.extname(inputPath).toLowerCase());
}

async function lookupBackendStatus(name: IBackend["name"]) {
  const statuses = await inspectBackends();
  return statuses.find((status) => status.name === name) ?? null;
}

async function lookupBackendExecutablePath(name: IBackend["name"], rootDir?: string) {
  const statuses = await inspectBackends(rootDir);
  return statuses.find((status) => status.name === name)?.detectedPath ?? null;
}

async function resolveProPainterRuntime(
  options: ProPainterBackendOptions,
): Promise<{ cwd?: string; pythonPath: string; scriptPath: string }> {
  if (options.pythonPath && options.scriptPath) {
    return {
      ...(options.rootDir ? { cwd: options.rootDir } : {}),
      pythonPath: options.pythonPath,
      scriptPath: options.scriptPath,
    };
  }

  const status = await lookupBackendStatus("propainter");
  const installDir = status?.detectedPath ?? null;

  if (!installDir) {
    return {
      ...(options.rootDir ? { cwd: options.rootDir } : {}),
      pythonPath: options.pythonPath ?? "python",
      scriptPath: options.scriptPath ?? "inference_propainter.py",
    };
  }

  const configuredPython = options.pythonPath
    ?? await resolveExistingPath([
      path.join(installDir, ".venv", "Scripts", "python.exe"),
      path.join(installDir, ".venv", "bin", "python"),
    ])
    ?? "python";
  const configuredScript = options.scriptPath ?? path.join(installDir, "inference_propainter.py");

  return {
    cwd: installDir,
    pythonPath: configuredPython,
    scriptPath: configuredScript,
  };
}

async function resolveExistingPath(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}
