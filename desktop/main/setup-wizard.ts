import { inspectBackends } from "../../src/backends/registry.js";
import type { BackendStatus } from "../../src/backends/types.js";
import { loadForgeDefaults } from "../../src/forge/config/load-forge-defaults.js";
import { createDesktopRuntimeManifest, type DesktopRuntimeManifest } from "../../src/desktop/runtime-manifest.js";
import { DesktopModelManager, type DesktopRequiredModelStatus } from "./model-manager.js";

export type SetupWizardStepId =
  | "complete"
  | "engine_install"
  | "model_download"
  | "ollama_model"
  | "system_check";

export interface SetupWizardState {
  completed: boolean;
  current_step: SetupWizardStepId;
  progress_percent: number;
}

export interface SetupWizardEvaluationInput {
  backends_ready: boolean;
  ollama_model_ready: boolean;
  required_models_ready: boolean;
  system_ready: boolean;
}

export interface DesktopSetupSnapshot {
  backends_ready: boolean;
  default_ollama_model: string;
  installed_ollama_models: string[];
  ollama_model_ready: boolean;
  required_model_status: DesktopRequiredModelStatus;
  state: SetupWizardState;
  system_ready: boolean;
}

export interface LoadDesktopSetupSnapshotInput {
  backends?: Array<Pick<BackendStatus, "available" | "name"> & Partial<BackendStatus>>;
  default_ollama_model?: string;
  installed_ollama_models?: string[];
  manifest?: DesktopRuntimeManifest;
  required_model_status?: DesktopRequiredModelStatus;
  system_ready?: boolean;
}

export function getInitialSetupWizardState(): SetupWizardState {
  return evaluateSetupWizardState({
    backends_ready: false,
    ollama_model_ready: false,
    required_models_ready: false,
    system_ready: false,
  });
}

export function evaluateSetupWizardState(
  input: SetupWizardEvaluationInput,
): SetupWizardState {
  if (!input.system_ready) {
    return {
      completed: false,
      current_step: "system_check",
      progress_percent: 0,
    };
  }

  if (!input.backends_ready) {
    return {
      completed: false,
      current_step: "engine_install",
      progress_percent: 25,
    };
  }

  if (!input.required_models_ready) {
    return {
      completed: false,
      current_step: "model_download",
      progress_percent: 50,
    };
  }

  if (!input.ollama_model_ready) {
    return {
      completed: false,
      current_step: "ollama_model",
      progress_percent: 75,
    };
  }

  return {
    completed: true,
    current_step: "complete",
    progress_percent: 100,
  };
}

export async function loadDesktopSetupSnapshot(
  input: LoadDesktopSetupSnapshotInput = {},
): Promise<DesktopSetupSnapshot> {
  const manifest = input.manifest ?? createDesktopRuntimeManifest();
  const backends = input.backends ?? await inspectBackends(manifest.root_dir);
  const requiredModelStatus = input.required_model_status
    ?? await new DesktopModelManager({ manifest }).getRequiredModelStatus();
  const defaults = input.default_ollama_model
    ? null
    : await loadForgeDefaults(manifest.root_dir);
  const defaultOllamaModel = input.default_ollama_model
    ?? defaults?.ollama?.default_model
    ?? "qwen3:14b";
  const installedOllamaModels = input.installed_ollama_models
    ?? await readInstalledOllamaModels(backends, defaultOllamaModel);
  const backendsReady = manifest.auto_start_backends.every((backend) =>
    backends.find((status) => status.name === backend)?.available ?? false
  );
  const ollamaModelReady = installedOllamaModels.includes(defaultOllamaModel);
  const systemReady = input.system_ready ?? true;

  return {
    backends_ready: backendsReady,
    default_ollama_model: defaultOllamaModel,
    installed_ollama_models: installedOllamaModels,
    ollama_model_ready: ollamaModelReady,
    required_model_status: requiredModelStatus,
    state: evaluateSetupWizardState({
      backends_ready: backendsReady,
      ollama_model_ready: ollamaModelReady,
      required_models_ready: requiredModelStatus.completed,
      system_ready: systemReady,
    }),
    system_ready: systemReady,
  };
}

async function readInstalledOllamaModels(
  backends: Array<Pick<BackendStatus, "available" | "name"> & Partial<BackendStatus>>,
  defaultOllamaModel: string,
): Promise<string[]> {
  const ollamaReady = backends.find((backend) => backend.name === "ollama")?.available ?? false;
  if (!ollamaReady) {
    return [];
  }

  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      method: "GET",
    });
    if (!response.ok) {
      return [];
    }

    const payload = await response.json() as {
      models?: Array<{ model?: string; name?: string }>;
    };
    const tags = payload.models
      ?.map((model) => model.name ?? model.model ?? "")
      .filter((value) => value.length > 0)
      ?? [];

    return tags.length > 0 ? tags : [defaultOllamaModel];
  } catch {
    return [];
  }
}
