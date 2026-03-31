import type {
  DesktopRuntimeStageSnapshot,
  DesktopSetupSnapshot,
  MediaForgeHealthSnapshot,
  OpenClawBridgeSnapshot,
} from "./mediaforge-types";

export interface StudioSystemSnapshotView {
  backendReadyCount: number;
  backendTotalCount: number;
  diskLabel: string;
  gpuHeadline: string;
  missingBackends: string[];
  pathWarningCount: number;
  ramLabel: string;
  updatedAtLabel: string;
  vramLabel: string;
  workspacePath: string;
}

export interface StudioSetupSnapshotView {
  defaultModelLabel: string;
  installedOllamaModelsLabel: string;
  missingRequiredModelsLabel: string;
  progressLabel: string;
  stepLabel: string;
}

export interface StudioRuntimeStageView {
  backendConfigLabel: string;
  backendOverrideCount: number;
  defaultModelLabel: string;
  nodeRuntimeLabel: string;
  openclawProfileLabel: string;
  readyLabel: string;
}

export interface StudioOpenClawView {
  actionCountLabel: string;
  statusLabel: string;
  urlLabel: string;
}

export function buildSystemSnapshotView(
  snapshot: MediaForgeHealthSnapshot,
): StudioSystemSnapshotView {
  const readyBackends = snapshot.doctor.backends.filter((backend) => backend.available);
  const missingBackends = snapshot.doctor.backends
    .filter((backend) => !backend.available)
    .map((backend) => backend.name);

  return {
    backendReadyCount: readyBackends.length,
    backendTotalCount: snapshot.doctor.backends.length,
    diskLabel: formatDiskLabel(snapshot.doctor.system.disk.free_gb),
    gpuHeadline: snapshot.doctor.system.gpu?.name ?? "GPU를 찾지 못했습니다",
    missingBackends,
    pathWarningCount: snapshot.paths.warnings.length,
    ramLabel: formatUsageLabel(snapshot.doctor.system.ram.free_gb, snapshot.doctor.system.ram.total_gb, "RAM 정보를 확인할 수 없습니다"),
    updatedAtLabel: formatTimestamp(snapshot.generated_at),
    vramLabel: snapshot.doctor.system.gpu
      ? formatUsageLabel(
        snapshot.doctor.system.gpu.free_vram_gb,
        snapshot.doctor.system.gpu.total_vram_gb,
        "VRAM 정보를 확인할 수 없습니다",
      )
      : "VRAM 정보를 확인할 수 없습니다",
    workspacePath: snapshot.workspace_root,
  };
}

export function buildSetupSnapshotView(
  snapshot: DesktopSetupSnapshot,
): StudioSetupSnapshotView {
  return {
    defaultModelLabel: snapshot.default_ollama_model,
    installedOllamaModelsLabel: snapshot.installed_ollama_models.join(", ") || "설치된 Ollama 모델이 없습니다",
    missingRequiredModelsLabel: snapshot.required_model_status.missing_ids.length > 0
      ? snapshot.required_model_status.missing_ids.join(", ")
      : "필수 모델이 모두 준비되었습니다",
    progressLabel: `${snapshot.state.progress_percent}%`,
    stepLabel: SETUP_STEP_LABELS[snapshot.state.current_step],
  };
}

export function buildRuntimeStageView(
  snapshot: DesktopRuntimeStageSnapshot,
): StudioRuntimeStageView {
  return {
    backendConfigLabel: snapshot.backend_config_staged ? "스테이징됨" : "없음",
    backendOverrideCount: snapshot.backend_overrides.filter((backend) => backend.staged).length,
    defaultModelLabel: snapshot.default_ollama_model,
    nodeRuntimeLabel: snapshot.node_runtime_staged ? "스테이징됨" : "없음",
    openclawProfileLabel: snapshot.openclaw_profile_staged ? "스테이징됨" : "없음",
    readyLabel: snapshot.ready ? "준비 완료" : "대기 중",
  };
}

export function buildOpenClawBridgeView(
  snapshot: OpenClawBridgeSnapshot,
): StudioOpenClawView {
  return {
    actionCountLabel: String(snapshot.actions.length),
    statusLabel: snapshot.openclaw.running ? "실행 중" : "중지됨",
    urlLabel: snapshot.openclaw.url,
  };
}

const SETUP_STEP_LABELS: Record<DesktopSetupSnapshot["state"]["current_step"], string> = {
  complete: "설치 완료",
  engine_install: "번들 백엔드 설치",
  model_download: "필수 모델 다운로드",
  ollama_model: "Ollama 모델 설치",
  system_check: "시스템 요구사항 확인",
};

function formatDiskLabel(freeGb: number | null): string {
  if (freeGb === null) {
    return "디스크 정보를 확인할 수 없습니다";
  }

  return `여유 ${trimNumber(freeGb)}GB`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatUsageLabel(
  freeValue: number | null,
  totalValue: number | null,
  fallback: string,
): string {
  if (freeValue === null || totalValue === null) {
    return fallback;
  }

  return `여유 ${trimNumber(freeValue)}GB / 총 ${trimNumber(totalValue)}GB`;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
