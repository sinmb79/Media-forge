export type BackendName = "comfyui" | "edge-tts" | "ffmpeg" | "python" | "ollama" | "propainter";

export type BackendDetectionSource = "config" | "path" | "missing";

export interface BackendCatalogEntry {
  configured_paths?: string[];
  executables?: string[];
  entry_file?: string;
  version_args?: string[];
  install_guide_url: string;
}

export interface BackendPathCatalog {
  backends: Record<BackendName, BackendCatalogEntry>;
}

export interface BackendStatus {
  name: BackendName;
  available: boolean;
  detectedPath: string | null;
  version: string | null;
  installGuideUrl: string;
  source: BackendDetectionSource;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface BackendExecutionRequest {
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  payload?: unknown;
}

export interface BackendExecutionResult extends CommandResult {}

export interface IBackend {
  name: BackendName;
  isAvailable(): Promise<boolean>;
  getVersion(): Promise<string | null>;
  execute(request: BackendExecutionRequest): Promise<BackendExecutionResult>;
}
