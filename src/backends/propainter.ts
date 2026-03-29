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
    return (this.options.execFileFn ?? defaultExecFile)(
      this.options.pythonPath ?? "python",
      [this.options.scriptPath ?? "inference_propainter.py", ...(request.args ?? [])],
      request.cwd ? { cwd: request.cwd } : {},
    );
  }

  async run(input: ProPainterRunInput): Promise<string> {
    const [width, height] = resolveProPainterFrameSize(input.width, input.height);
    await this.execute({
      args: [
        "--video",
        input.inputPath,
        "--mask",
        input.maskPath,
        "--output",
        input.outputPath,
        "--width",
        String(width),
        "--height",
        String(height),
        ...(input.fp16 ?? true ? ["--fp16"] : []),
      ],
    });
    return input.outputPath;
  }
}

export function resolveProPainterFrameSize(width?: number, height?: number): [number, number] {
  return [width ?? 576, height ?? 320];
}

async function lookupBackendStatus(name: IBackend["name"]) {
  const statuses = await inspectBackends();
  return statuses.find((status) => status.name === name) ?? null;
}
