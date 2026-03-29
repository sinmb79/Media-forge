import type { BackendName } from "../../backends/types.js";
import type { HardwareProfile } from "../contracts.js";
import { detectAvailableVramGb, optimizeMemoryPlan, type MemoryOptimizationPlan } from "../memory-optimizer.js";

export type ForgeVideoMode = "from-image" | "from-text" | "long";
export type ForgeVideoModel = "wan22" | "ltx2";
export type ForgeVideoQuality = "draft" | "production";

export interface ForgeVideoGenerationPlanInput {
  desc_ko: string;
  freeVramGb: number | null;
  hardwareProfile: HardwareProfile | null;
  imagePath?: string;
  mode: ForgeVideoMode;
  model: ForgeVideoModel;
  quality: ForgeVideoQuality;
  storyboardPath?: string;
}

export interface ForgeVideoGenerationPlan {
  assets: Record<string, string>;
  backend: BackendName;
  estimated_vram_gb: number;
  memory_profile: MemoryOptimizationPlan["selected_profile"];
  offload_mode: MemoryOptimizationPlan["offload_mode"];
  runtime_flags: string[];
  workflow_id: string;
}

export async function buildVideoGenerationPlan(
  input: ForgeVideoGenerationPlanInput,
): Promise<ForgeVideoGenerationPlan> {
  const memoryPlan = resolveMemoryPlan(input);

  return {
    assets: buildAssets(input),
    backend: "comfyui",
    estimated_vram_gb: memoryPlan.estimated_vram_gb,
    memory_profile: memoryPlan.selected_profile,
    offload_mode: memoryPlan.offload_mode,
    runtime_flags: memoryPlan.flags,
    workflow_id: selectWorkflowId(input, memoryPlan),
  };
}

function selectWorkflowId(
  input: ForgeVideoGenerationPlanInput,
  memoryPlan: MemoryOptimizationPlan,
): string {
  if (input.mode === "long") {
    return "wan22_svi_long";
  }

  if (input.mode === "from-text") {
    return "wan22_t2v_gguf";
  }

  if (input.model === "ltx2") {
    return "ltx2_i2v_gguf_q4";
  }

  if (input.quality === "draft") {
    return "wan22_i2v_gguf_q4";
  }

  if (memoryPlan.selected_profile !== "q8") {
    return "wan22_i2v_gguf_q4";
  }

  return "wan22_i2v_gguf_q8";
}

function buildAssets(input: ForgeVideoGenerationPlanInput): Record<string, string> {
  const assets: Record<string, string> = {
    prompt_text: input.desc_ko,
  };

  if (input.imagePath) {
    assets.image = input.imagePath;
  }

  if (input.storyboardPath) {
    assets.storyboard = input.storyboardPath;
  }

  return assets;
}

function getOffloadThreshold(profile: HardwareProfile | null): number {
  const value = profile?.strategy?.offload_threshold_gb;
  return typeof value === "number" ? value : 14;
}

function resolveMemoryPlan(input: ForgeVideoGenerationPlanInput): MemoryOptimizationPlan {
  const detectedFreeVram = input.freeVramGb
    ?? detectAvailableVramGb()
    ?? input.hardwareProfile?.gpu?.vram_gb
    ?? null;
  const mappedModel = input.model === "ltx2" ? "ltx2" : "wan22";
  const threshold = getOffloadThreshold(input.hardwareProfile);
  const optimized = optimizeMemoryPlan({
    freeVramGb: detectedFreeVram,
    model: mappedModel,
  });

  if (
    input.model !== "ltx2"
    && input.quality === "production"
    && detectedFreeVram !== null
    && detectedFreeVram <= threshold
    && optimized.selected_profile === "q8"
  ) {
    return optimizeMemoryPlan({
      freeVramGb: threshold - 1,
      model: mappedModel,
    });
  }

  return optimized;
}
