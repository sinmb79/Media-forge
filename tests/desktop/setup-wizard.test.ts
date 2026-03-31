import * as assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateSetupWizardState, loadDesktopSetupSnapshot } from "../../desktop/main/setup-wizard.js";

test("evaluateSetupWizardState blocks on engine installation until bundled backends are ready", () => {
  const state = evaluateSetupWizardState({
    backends_ready: false,
    ollama_model_ready: false,
    required_models_ready: false,
    system_ready: true,
  });

  assert.equal(state.completed, false);
  assert.equal(state.current_step, "engine_install");
  assert.equal(state.progress_percent, 25);
});

test("evaluateSetupWizardState advances to ollama model setup after required models are present", () => {
  const state = evaluateSetupWizardState({
    backends_ready: true,
    ollama_model_ready: false,
    required_models_ready: true,
    system_ready: true,
  });

  assert.equal(state.current_step, "ollama_model");
  assert.equal(state.progress_percent, 75);
});

test("evaluateSetupWizardState marks setup complete when all runtime prerequisites are ready", () => {
  const state = evaluateSetupWizardState({
    backends_ready: true,
    ollama_model_ready: true,
    required_models_ready: true,
    system_ready: true,
  });

  assert.equal(state.completed, true);
  assert.equal(state.current_step, "complete");
  assert.equal(state.progress_percent, 100);
});

test("loadDesktopSetupSnapshot keeps setup on the ollama model step when the default model is missing", async () => {
  const snapshot = await loadDesktopSetupSnapshot({
    backends: [
      { available: true, detectedPath: "C:\\MediaForge\\engines\\comfyui", name: "comfyui", source: "config", version: null },
      { available: true, detectedPath: "C:\\MediaForge\\engines\\ollama\\ollama.exe", name: "ollama", source: "config", version: null },
      { available: true, detectedPath: "C:\\MediaForge\\engines\\ffmpeg\\bin\\ffmpeg.exe", name: "ffmpeg", source: "config", version: null },
    ],
    default_ollama_model: "qwen3:14b",
    installed_ollama_models: ["qwen3.5:9b"],
    required_model_status: {
      completed: true,
      installed_ids: ["sdxl-base", "wan22-q4"],
      missing_ids: [],
      remaining_download_gb: 0,
    },
    system_ready: true,
  });

  assert.equal(snapshot.ollama_model_ready, false);
  assert.equal(snapshot.state.current_step, "ollama_model");
  assert.equal(snapshot.state.progress_percent, 75);
});
