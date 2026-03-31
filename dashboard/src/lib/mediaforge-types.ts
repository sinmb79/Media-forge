export interface MediaForgeBackendStatus {
  detectedPath?: string | null;
  installGuideUrl?: string;
  name: string;
  available: boolean;
  source?: string;
  version?: string | null;
}

export interface MediaForgeMediaDependencyStatus {
  detected_path: string | null;
  expected_paths: string[];
  id: string;
  install_guide_url: string | null;
  kind: "backend" | "custom_node" | "model";
  label: string;
  ready: boolean;
}

export interface MediaForgeMediaCapabilityStatus {
  dependencies: MediaForgeMediaDependencyStatus[];
  id: string;
  label: string;
  missing_dependencies: string[];
  ready: boolean;
  summary: string;
}

export interface MediaForgeComfyUIMediaStackStatus {
  capabilities: MediaForgeMediaCapabilityStatus[];
  comfyui_root: string | null;
  custom_nodes_dir: string | null;
  models_dir: string | null;
  ready: boolean;
  warnings: string[];
}

export interface MediaForgeDoctorSnapshot {
  status?: string;
  backends: MediaForgeBackendStatus[];
  media_stack?: MediaForgeComfyUIMediaStackStatus;
  system: {
    gpu: {
      name: string;
      total_vram_gb: number;
      free_vram_gb: number | null;
    } | null;
    ram: {
      total_gb: number | null;
      free_gb: number | null;
    };
    disk: {
      mount: string;
      total_gb: number | null;
      free_gb: number | null;
    };
    configured_hardware?: unknown;
  };
  warnings: string[];
}

export interface MediaForgePathsSnapshot {
  warnings: string[];
}

export interface MediaForgeHealthSnapshot {
  schema_version: string;
  workspace_root: string;
  doctor: MediaForgeDoctorSnapshot;
  paths: MediaForgePathsSnapshot;
  generated_at: string;
}

export type DashboardActionName =
  | "doctor"
  | "probe"
  | "paths-validate"
  | "prompt-build"
  | "image-sketch"
  | "video-from-image"
  | "video-from-text"
  | "edit-run"
  | "audio-run"
  | "pipeline-run";

export type DashboardJobStatus = "queued" | "running" | "succeeded" | "failed";
export type DashboardJobPhase = "execution" | "verification";
export type DashboardResultKind = "non_file" | "file";
export type DashboardOutputKind = "image" | "video" | "audio" | "text" | "file";

export interface DashboardJobLogEntry {
  level: "info" | "error";
  message: string;
  timestamp: string;
}

export interface DashboardJobRecord {
  id: string;
  kind: string;
  label: string;
  status: DashboardJobStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: number;
  logs: DashboardJobLogEntry[];
  input: Record<string, unknown>;
  output: unknown;
  error: string | null;
  phase: DashboardJobPhase;
  summary: string;
  details: string;
  result_kind: DashboardResultKind;
  expected_artifact: boolean;
  artifact_path: string | null;
  artifact_exists: boolean | null;
  next_step: string | null;
}

export interface DashboardOutputRecord {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  extension: string;
  kind: DashboardOutputKind;
  modifiedAt: string;
  sizeBytes: number;
  url: string;
}

export interface AssetCardRecord {
  category: string;
  description: string;
  id: string;
  kind: "workflow" | "config" | "output" | "library";
  name: string;
  path: string;
}

export interface DashboardVoicePresetRecord {
  created_at: number;
  emotion: string;
  has_lora: boolean;
  has_ref_sample: boolean;
  id: string;
  name: string;
  notes?: string;
  ref_sample?: string;
  speed: number;
  storage_path: string;
  summary: string;
  updated_at: number;
  voice?: string;
}

export interface DashboardCollectionResponse<T> {
  items: T[];
  schema_version: string;
}

export interface DashboardActionAccepted {
  action: DashboardActionName;
  job_id: string;
  label: string;
  status: "queued";
}

export interface DashboardActionBlocked {
  action: string;
  status: "blocked";
  reason: string;
  missing_backends: string[];
  missing_inputs: string[];
  next_steps: string[];
}

export type DashboardActionResponse = DashboardActionAccepted | DashboardActionBlocked;

export interface UploadedFileRecord {
  filename: string;
  mimeType: string;
  originalName: string;
  path: string;
  relativePath: string;
  sizeBytes: number;
  url: string;
}

export interface BackendEnsureResponse {
  args: string[];
  command: string | null;
  cwd: string | null;
  name: string;
  pid: number | null;
  ready: boolean;
  ready_url: string | null;
  reason: string | null;
  started: boolean;
  status: "missing" | "ready" | "started";
}

export type DesktopSetupStepId =
  | "complete"
  | "engine_install"
  | "model_download"
  | "ollama_model"
  | "system_check";

export interface DesktopSetupStateRecord {
  completed: boolean;
  current_step: DesktopSetupStepId;
  progress_percent: number;
}

export interface DesktopRequiredModelStatusRecord {
  completed: boolean;
  installed_ids: string[];
  missing_ids: string[];
  remaining_download_gb: number;
}

export interface DesktopSetupSnapshot {
  backends_ready: boolean;
  default_ollama_model: string;
  installed_ollama_models: string[];
  ollama_model_ready: boolean;
  required_model_status: DesktopRequiredModelStatusRecord;
  state: DesktopSetupStateRecord;
  system_ready: boolean;
}

export interface DesktopRuntimeStageBackendRecord {
  configured_path: string | null;
  name: string;
  staged: boolean;
}

export interface DesktopRuntimeStageSnapshot {
  backend_config_path: string;
  backend_config_staged: boolean;
  backend_overrides: DesktopRuntimeStageBackendRecord[];
  default_ollama_model: string;
  node_runtime_path: string;
  node_runtime_staged: boolean;
  openclaw_profile_path: string;
  openclaw_profile_staged: boolean;
  openclaw_url: string;
  ready: boolean;
  root_dir: string;
  schema_version: string;
  stage_dir: string;
}

export interface OpenClawActionRecord {
  expects_artifact: boolean;
  id: string;
  label: string;
}

export interface OpenClawBridgeSnapshot {
  actions: OpenClawActionRecord[];
  backends: MediaForgeBackendStatus[];
  doctor: MediaForgeDoctorSnapshot;
  openclaw: {
    actions: OpenClawActionRecord[];
    host: string;
    port: number;
    root_dir: string;
    running: boolean;
    url: string;
  };
  schema_version: string;
  stage: DesktopRuntimeStageSnapshot;
}

export interface VisualTemplateRecord {
  category: "effects" | "music" | "particle";
  engine: string;
  id: string;
  label: string;
  primaryColor: string;
  summary: string;
  tags: string[];
}

export interface VisualTemplateSectionRecord {
  id: VisualTemplateRecord["category"];
  label: string;
  templates: VisualTemplateRecord[];
}

export interface VisualTemplateCatalogPayload {
  featured: VisualTemplateRecord[];
  schema_version: string;
  sections: VisualTemplateSectionRecord[];
  templates: VisualTemplateRecord[];
}

export interface StudioBootstrapPayload {
  assets: AssetCardRecord[];
  health: MediaForgeHealthSnapshot | null;
  jobs: DashboardJobRecord[];
  outputs: DashboardOutputRecord[];
}
