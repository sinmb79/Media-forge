import * as path from "node:path";

import { defaultExecFile, type ExecFileLike } from "./process-runner.js";
import { inspectBackends } from "./registry.js";
import type {
  BackendExecutionRequest,
  BackendExecutionResult,
  IBackend,
} from "./types.js";

export interface WhisperBackendOptions {
  execFileFn?: ExecFileLike;
  executablePath?: string;
}

export class WhisperBackend implements IBackend {
  readonly name = "python" as const;
  private readonly options: WhisperBackendOptions;

  constructor(options: WhisperBackendOptions = {}) {
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
      this.options.executablePath ?? "whisper",
      request.args ?? [],
      request.cwd ? { cwd: request.cwd } : {},
    );
  }

  async transcribe(input: string, lang: string, outputPath?: string): Promise<string> {
    const resolvedOutput = outputPath ?? path.resolve(
      path.dirname(input),
      `${path.basename(input, path.extname(input))}.srt`,
    );
    await this.execute({
      args: [
        input,
        "--language",
        lang,
        "--task",
        "transcribe",
        "--output_format",
        "srt",
        "--output_dir",
        path.dirname(resolvedOutput),
      ],
    });
    return resolvedOutput;
  }
}

async function lookupBackendStatus(name: IBackend["name"]) {
  const statuses = await inspectBackends();
  return statuses.find((status) => status.name === name) ?? null;
}
