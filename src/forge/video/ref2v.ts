import * as path from "node:path";

import { ComfyUIBackend } from "../../backends/comfyui.js";
import { resolveLLMClient } from "../../backends/resolve-llm-client.js";
import { buildForgePromptBundle, type ForgePromptClient } from "../../prompt/forge-prompt-builder.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { loadJsonConfigFile } from "../config/load-json-config.js";
import type { HardwareProfile } from "../contracts.js";
import { loadWorkflowTemplate } from "../workflows/load-workflow-template.js";
import { buildVideoGenerationPlan, type ForgeVideoQuality } from "./build-video-generation-plan.js";
import type { ForgeVideoResult } from "./from-image.js";

export interface SkyReelsRef2VOptions {
  desc_ko: string;
  duration_sec?: number;
  outputDir?: string;
  quality: ForgeVideoQuality;
  referencePaths: string[];
  rootDir?: string;
  seed?: number;
  simulate?: boolean;
  theme?: string | null;
}

export async function runSkyReelsRef2V(
  input: SkyReelsRef2VOptions,
  dependencies: {
    comfyClient?: ComfyUIBackend;
    freeVramGb?: number | null;
    hardwareProfile?: HardwareProfile | null;
    ollamaClient?: ForgePromptClient;
  } = {},
): Promise<ForgeVideoResult> {
  const requestId = createRequestId(input);
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const promptBundle = await buildForgePromptBundle({
    desc_ko: input.desc_ko,
    ollamaClient: dependencies.ollamaClient ?? await resolveLLMClient({ rootDir }),
    theme: input.theme,
  });
  const hardwareProfile = dependencies.hardwareProfile ?? await loadHardwareProfile(rootDir);
  const plan = await buildVideoGenerationPlan({
    desc_ko: input.desc_ko,
    freeVramGb: dependencies.freeVramGb ?? hardwareProfile?.gpu?.vram_gb ?? null,
    hardwareProfile,
    mode: "ref2v",
    model: "skyreels-ref2v",
    quality: input.quality,
    referencePaths: input.referencePaths,
  });
  const outputPath = path.resolve(rootDir, input.outputDir ?? "outputs", `${requestId}.mp4`);

  if (input.simulate) {
    return {
      output_path: outputPath,
      prompt_bundle: promptBundle,
      request_id: requestId,
      status: "simulated",
      workflow_id: plan.workflow_id,
    };
  }

  const workflow = await loadWorkflowTemplate(plan.workflow_id, {
    duration_sec: input.duration_sec ?? 5,
    negative_prompt: promptBundle.video_negative,
    output_path: outputPath,
    prompt: promptBundle.video_prompt,
    reference_paths: input.referencePaths.join(","),
    seed: input.seed ?? -1,
  }, rootDir);
  const comfyClient = dependencies.comfyClient ?? new ComfyUIBackend({ autoStart: true, rootDir });
  const queued = await comfyClient.queueWorkflow(workflow);
  const status = await comfyClient.waitForCompletion(queued.prompt_id);
  const firstOutput = status.outputs[0];

  if (!firstOutput) {
    throw new Error("ComfyUI SkyReels Ref2V workflow finished without video outputs.");
  }

  await comfyClient.saveDownloadedOutput(firstOutput, outputPath);

  return {
    output_path: outputPath,
    prompt_bundle: promptBundle,
    request_id: requestId,
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
