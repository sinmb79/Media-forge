import * as path from "node:path";

import { ComfyUIBackend } from "../../backends/comfyui.js";
import { OllamaBackend } from "../../backends/ollama.js";
import { buildForgePromptBundle } from "../../prompt/forge-prompt-builder.js";
import { createRequestId } from "../../shared/request-id.js";
import { loadJsonConfigFile } from "../config/load-json-config.js";
import type { HardwareProfile } from "../contracts.js";
import { loadWorkflowTemplate } from "../workflows/load-workflow-template.js";
import { buildVideoGenerationPlan, type ForgeVideoQuality } from "./build-video-generation-plan.js";

export async function runVideoFromText(
  input: {
    desc_ko: string;
    outputDir?: string;
    quality: ForgeVideoQuality;
    rootDir?: string;
    simulate?: boolean;
    theme?: string | null;
  },
  dependencies: {
    comfyClient?: ComfyUIBackend;
    freeVramGb?: number | null;
    hardwareProfile?: HardwareProfile | null;
    ollamaClient?: OllamaBackend;
  } = {},
): Promise<{
  output_path: string;
  prompt_bundle: Awaited<ReturnType<typeof buildForgePromptBundle>>;
  request_id: string;
  status: "simulated" | "completed";
  workflow_id: string;
}> {
  const requestId = createRequestId(input);
  const rootDir = input.rootDir ?? process.cwd();
  const promptBundle = await buildForgePromptBundle({
    desc_ko: input.desc_ko,
    ollamaClient: dependencies.ollamaClient ?? new OllamaBackend({ rootDir }),
    theme: input.theme,
  });
  const hardwareProfile = dependencies.hardwareProfile ?? await loadHardwareProfile(rootDir);
  const plan = await buildVideoGenerationPlan({
    desc_ko: input.desc_ko,
    freeVramGb: dependencies.freeVramGb ?? hardwareProfile?.gpu?.vram_gb ?? null,
    hardwareProfile,
    mode: "from-text",
    model: "wan22",
    quality: input.quality,
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
    negative_prompt: promptBundle.video_negative,
    output_path: outputPath,
    prompt: promptBundle.video_prompt,
  }, rootDir);
  const comfyClient = dependencies.comfyClient ?? new ComfyUIBackend({ rootDir });
  const queued = await comfyClient.queueWorkflow(workflow);
  const status = await comfyClient.waitForCompletion(queued.prompt_id);
  const firstOutput = status.outputs[0];

  if (!firstOutput) {
    throw new Error("ComfyUI text-to-video workflow finished without video outputs.");
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
