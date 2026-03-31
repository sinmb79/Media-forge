import { defaultExecFile, type ExecFileLike } from "./process-runner.js";
import { inspectBackends } from "./registry.js";
import type {
  BackendExecutionRequest,
  BackendExecutionResult,
  IBackend,
} from "./types.js";

export interface TTSBackendOptions {
  execFileFn?: ExecFileLike;
  executablePath?: string;
}

export class TTSBackend implements IBackend {
  readonly name = "edge-tts" as const;
  private readonly options: TTSBackendOptions;

  constructor(options: TTSBackendOptions = {}) {
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
      this.options.executablePath ?? "edge-tts",
      request.args ?? [],
      request.cwd ? { cwd: request.cwd } : {},
    );
  }

  async synthesize(text: string, lang: string, voice: string | undefined, output: string): Promise<string> {
    const selectedVoice = voice ?? resolveDefaultVoice(lang);
    await this.execute({
      args: ["--text", text, "--voice", selectedVoice, "--write-media", output],
    });
    return output;
  }
}

function resolveDefaultVoice(lang: string): string {
  if (lang.toLowerCase().startsWith("ko")) {
    return "ko-KR-SunHiNeural";
  }

  return "en-US-AriaNeural";
}

async function lookupBackendStatus(name: IBackend["name"]) {
  const statuses = await inspectBackends();
  return statuses.find((status) => status.name === name) ?? null;
}
