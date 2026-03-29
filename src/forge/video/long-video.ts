import * as path from "node:path";

import { ComfyUIBackend } from "../../backends/comfyui.js";
import { createRequestId } from "../../shared/request-id.js";
import { loadJsonConfigFile } from "../config/load-json-config.js";
import type { HardwareProfile } from "../contracts.js";
import { loadWorkflowTemplate } from "../workflows/load-workflow-template.js";
import { buildVideoGenerationPlan } from "./build-video-generation-plan.js";
import { loadStoryboardDefinition } from "./storyboard.js";

export async function runLongVideoGeneration(
  input: {
    outputDir?: string;
    rootDir?: string;
    simulate?: boolean;
    storyboardPath: string;
  },
  dependencies: {
    comfyClient?: ComfyUIBackend;
    freeVramGb?: number | null;
    hardwareProfile?: HardwareProfile | null;
  } = {},
): Promise<{
  output_path: string;
  request_id: string;
  scene_count: number;
  status: "simulated" | "completed";
  workflow_id: string;
}> {
  const rootDir = input.rootDir ?? process.cwd();
  const storyboard = await loadStoryboardDefinition(path.resolve(rootDir, input.storyboardPath));
  const requestId = createRequestId({
    scene_count: storyboard.scenes.length,
    storyboardPath: input.storyboardPath,
  });
  const hardwareProfile = dependencies.hardwareProfile ?? await loadHardwareProfile(rootDir);
  const plan = await buildVideoGenerationPlan({
    desc_ko: storyboard.scenes.map((scene) => scene.desc).join(" "),
    freeVramGb: dependencies.freeVramGb ?? hardwareProfile?.gpu?.vram_gb ?? null,
    hardwareProfile,
    mode: "long",
    model: "wan22",
    quality: "production",
    storyboardPath: input.storyboardPath,
  });
  const outputPath = path.resolve(rootDir, input.outputDir ?? "outputs", `${requestId}.mp4`);

  if (input.simulate) {
    return {
      output_path: outputPath,
      request_id: requestId,
      scene_count: storyboard.scenes.length,
      status: "simulated",
      workflow_id: plan.workflow_id,
    };
  }

  const workflow = await loadWorkflowTemplate(plan.workflow_id, {
    output_path: outputPath,
    scene_count: storyboard.scenes.length,
    storyboard_json: JSON.stringify(storyboard),
  }, rootDir);
  const comfyClient = dependencies.comfyClient ?? new ComfyUIBackend({ rootDir });
  const queued = await comfyClient.queueWorkflow(workflow);
  const status = await comfyClient.waitForCompletion(queued.prompt_id);
  const firstOutput = status.outputs[0];

  if (!firstOutput) {
    throw new Error("ComfyUI long-video workflow finished without video outputs.");
  }

  await comfyClient.saveDownloadedOutput(firstOutput, outputPath);

  return {
    output_path: outputPath,
    request_id: requestId,
    scene_count: storyboard.scenes.length,
    status: "completed",
    workflow_id: plan.workflow_id,
  };
}

async function loadHardwareProfile(rootDir: string): Promise<HardwareProfile | null> {
  try {
    return await loadJsonConfigFile<HardwareProfile>(
      path.resolve(rootDir, "config", "hardware-profile.yaml"),
    );
  } catch {
    return null;
  }
}
