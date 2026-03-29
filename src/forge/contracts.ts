import type { BackendStatus } from "../backends/types.js";
import type { BackendName } from "../backends/types.js";

export interface HardwareProfile {
  gpu?: {
    name?: string;
    vram_gb?: number;
    cuda_compute?: number;
  };
  cpu?: {
    name?: string;
    cores?: number;
    threads?: number;
  };
  ram?: {
    total_gb?: number;
  };
  strategy?: Record<string, unknown>;
}

export interface GpuInfo {
  name: string;
  total_vram_gb: number;
  free_vram_gb: number | null;
}

export interface RamInfo {
  total_gb: number;
  free_gb: number;
}

export interface DiskInfo {
  mount: string;
  total_gb: number | null;
  free_gb: number | null;
}

export interface ForgeDoctorSystemSnapshot {
  gpu: GpuInfo | null;
  ram: RamInfo;
  disk: DiskInfo;
  configured_hardware: HardwareProfile | null;
}

export interface ForgeDoctorResult {
  schema_version: string;
  status: "ok" | "warning" | "error";
  backends: BackendStatus[];
  system: ForgeDoctorSystemSnapshot;
  warnings: string[];
}

export interface ForgeBackendProbeResult {
  schema_version: string;
  backends: BackendStatus[];
  available_count: number;
  unavailable_count: number;
}

export interface ForgeConfigValidationFile {
  name: string;
  filePath: string;
  exists: boolean;
  valid: boolean;
  message: string;
}

export interface ForgePathsValidationResult {
  schema_version: string;
  status: "ok" | "warning" | "error";
  files: ForgeConfigValidationFile[];
  warnings: string[];
}

export type ForgeMode = "sketch_to_video" | "storyboard" | "image_generate" | "video_from_image";

export interface ForgePromptPlan {
  request_id: string;
  mode: ForgeMode;
  theme: string | null;
  source_text: string;
  prompt_seed: string;
  prompt_hints: string[];
}

export interface ForgeRenderPlan {
  request_id: string;
  mode: ForgeMode;
  backend: BackendName;
  workflow_id: string;
  prompt_plan: ForgePromptPlan;
  assets: Record<string, string>;
}

export interface ForgeExecutionJob {
  job_id: string;
  request_id: string;
  backend: BackendName;
  workflow_id: string;
  command_args: string[];
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  retryable: boolean;
  optional: boolean;
}
