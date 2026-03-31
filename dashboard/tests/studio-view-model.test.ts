import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOpenClawBridgeView,
  buildRuntimeStageView,
  buildSetupSnapshotView,
  buildSystemSnapshotView,
} from "../src/lib/studio-view-model";

test("buildSystemSnapshotView summarizes local hardware and backend availability", () => {
  const view = buildSystemSnapshotView({
    doctor: {
      backends: [
        { name: "comfyui", available: true },
        { name: "ffmpeg", available: false },
        { name: "ollama", available: true },
      ],
      system: {
        gpu: { name: "RTX 4080 Super", total_vram_gb: 16, free_vram_gb: 12.4 },
        ram: { total_gb: 32, free_gb: 18.2 },
        disk: { total_gb: 1000, free_gb: 412.5, mount: "C:\\" },
      },
      warnings: ["Backend unavailable: ffmpeg"],
    },
    generated_at: "2026-03-30T00:00:00.000Z",
    paths: { warnings: [] },
    schema_version: "0.1",
    workspace_root: "C:\\Users\\sinmb\\workspace\\mediaforge",
  });

  assert.equal(view.gpuHeadline, "RTX 4080 Super");
  assert.equal(view.vramLabel, "여유 12.4GB / 총 16GB");
  assert.equal(view.ramLabel, "여유 18.2GB / 총 32GB");
  assert.equal(view.diskLabel, "여유 412.5GB");
  assert.deepEqual(view.missingBackends, ["ffmpeg"]);
  assert.equal(view.backendReadyCount, 2);
  assert.equal(view.backendTotalCount, 3);
});

test("buildSystemSnapshotView handles missing GPU information gracefully", () => {
  const view = buildSystemSnapshotView({
    doctor: {
      backends: [],
      system: {
        gpu: null,
        ram: { total_gb: 32, free_gb: 20 },
        disk: { total_gb: null, free_gb: null, mount: "C:\\" },
      },
      warnings: [],
    },
    generated_at: "2026-03-30T00:00:00.000Z",
    paths: { warnings: ["defaults missing"] },
    schema_version: "0.1",
    workspace_root: "C:\\Users\\sinmb\\workspace\\mediaforge",
  });

  assert.equal(view.gpuHeadline, "GPU를 찾지 못했습니다");
  assert.equal(view.vramLabel, "VRAM 정보를 확인할 수 없습니다");
  assert.equal(view.pathWarningCount, 1);
});

test("buildSetupSnapshotView summarizes setup progress and missing prerequisites", () => {
  const view = buildSetupSnapshotView({
    backends_ready: true,
    default_ollama_model: "qwen3:14b",
    installed_ollama_models: ["qwen3.5:9b"],
    ollama_model_ready: false,
    required_model_status: {
      completed: true,
      installed_ids: ["sdxl-base", "wan22-q4"],
      missing_ids: [],
      remaining_download_gb: 0,
    },
    state: {
      completed: false,
      current_step: "ollama_model",
      progress_percent: 75,
    },
    system_ready: true,
  });

  assert.equal(view.progressLabel, "75%");
  assert.equal(view.stepLabel, "Ollama 모델 설치");
  assert.equal(view.defaultModelLabel, "qwen3:14b");
  assert.equal(view.missingRequiredModelsLabel, "필수 모델이 모두 준비되었습니다");
  assert.equal(view.installedOllamaModelsLabel, "qwen3.5:9b");
});

test("buildRuntimeStageView summarizes staged private runtime resources", () => {
  const view = buildRuntimeStageView({
    backend_config_path: "C:\\stage\\config\\backend-paths.yaml",
    backend_config_staged: true,
    backend_overrides: [
      { configured_path: "C:\\Users\\sinmb\\ComfyUI", name: "comfyui", staged: true },
      { configured_path: null, name: "propainter", staged: false },
    ],
    default_ollama_model: "qwen3.5:9b",
    node_runtime_path: "C:\\stage\\runtime\\node\\node.exe",
    node_runtime_staged: true,
    openclaw_profile_path: "C:\\stage\\openclaw\\bridge.json",
    openclaw_profile_staged: true,
    openclaw_url: "http://127.0.0.1:4318",
    ready: true,
    root_dir: "C:\\Users\\sinmb\\workspace\\mediaforge",
    schema_version: "0.1",
    stage_dir: "C:\\Users\\sinmb\\workspace\\mediaforge\\desktop\\stage",
  });

  assert.equal(view.readyLabel, "준비 완료");
  assert.equal(view.nodeRuntimeLabel, "스테이징됨");
  assert.equal(view.backendConfigLabel, "스테이징됨");
  assert.equal(view.backendOverrideCount, 1);
  assert.equal(view.openclawProfileLabel, "스테이징됨");
});

test("buildOpenClawBridgeView exposes bridge status for settings UI", () => {
  const view = buildOpenClawBridgeView({
    actions: [
      { expects_artifact: false, id: "prompt.build", label: "Build prompt bundle" },
      { expects_artifact: true, id: "video.from-text", label: "Text to video" },
    ],
    backends: [],
    doctor: {
      backends: [],
      status: "ok",
      system: {
        configured_hardware: null,
        disk: { free_gb: 100, mount: "C:\\", total_gb: 200 },
        gpu: null,
        ram: { free_gb: 16, total_gb: 32 },
      },
      warnings: [],
    },
    openclaw: {
      actions: [],
      host: "127.0.0.1",
      port: 4318,
      root_dir: "C:\\Users\\sinmb\\workspace\\mediaforge",
      running: true,
      url: "http://127.0.0.1:4318",
    },
    schema_version: "0.1",
    stage: {
      backend_config_path: "C:\\stage\\config\\backend-paths.yaml",
      backend_config_staged: true,
      backend_overrides: [],
      default_ollama_model: "qwen3.5:9b",
      node_runtime_path: "C:\\stage\\runtime\\node\\node.exe",
      node_runtime_staged: true,
      openclaw_profile_path: "C:\\stage\\openclaw\\bridge.json",
      openclaw_profile_staged: true,
      openclaw_url: "http://127.0.0.1:4318",
      ready: true,
      root_dir: "C:\\Users\\sinmb\\workspace\\mediaforge",
      schema_version: "0.1",
      stage_dir: "C:\\Users\\sinmb\\workspace\\mediaforge\\desktop\\stage",
    },
  });

  assert.equal(view.statusLabel, "실행 중");
  assert.equal(view.actionCountLabel, "2");
  assert.equal(view.urlLabel, "http://127.0.0.1:4318");
});
