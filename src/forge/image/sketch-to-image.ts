import * as path from "node:path";

import { ComfyUIBackend } from "../../backends/comfyui.js";
import { OllamaBackend } from "../../backends/ollama.js";
import { buildForgePromptBundle } from "../../prompt/forge-prompt-builder.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { loadWorkflowTemplate } from "../workflows/load-workflow-template.js";

export interface SketchToImageOptions {
  desc_ko: string;
  description?: string;
  controlnet_mode?: "scribble" | "canny" | "lineart";
  style_strength?: number;
  model?: "sdxl" | "flux";
  resolution?: "1k" | "2k";
  outputDir?: string;
  rootDir?: string;
  simulate?: boolean;
  sketchPath: string;
  theme?: string | null;
}

export interface SketchToImageResult {
  output_path: string;
  prompt_id?: string;
  prompt_bundle: Awaited<ReturnType<typeof buildForgePromptBundle>>;
  request_id: string;
  status: "simulated" | "completed";
  workflow_id: string;
}

export async function runSketchToImage(
  options: SketchToImageOptions,
  dependencies: {
    comfyClient?: ComfyUIBackend;
    ollamaClient?: OllamaBackend;
  } = {},
): Promise<SketchToImageResult> {
  const requestId = createRequestId({
    desc_ko: options.desc_ko,
    sketchPath: options.sketchPath,
    theme: options.theme ?? null,
  });
  const rootDir = resolveMediaForgeRoot(options.rootDir ?? process.cwd());
  const promptBundle = await buildForgePromptBundle({
    desc_ko: options.desc_ko,
    ollamaClient: dependencies.ollamaClient ?? new OllamaBackend({ autoStart: true, rootDir }),
    theme: options.theme,
  });
  const workflowId = "sdxl_controlnet_scribble";
  const outputPath = path.resolve(rootDir, options.outputDir ?? "outputs", `${requestId}-image.png`);

  if (options.simulate) {
    return {
      output_path: outputPath,
      prompt_bundle: promptBundle,
      request_id: requestId,
      status: "simulated",
      workflow_id: workflowId,
    };
  }

  const workflow = await loadWorkflowTemplate(workflowId, {
    negative_prompt: promptBundle.image_negative,
    output_path: outputPath,
    positive_prompt: promptBundle.image_prompt,
    sketch_path: options.sketchPath,
  }, rootDir);
  const comfyClient = dependencies.comfyClient ?? new ComfyUIBackend({ autoStart: true, rootDir });
  const queued = await comfyClient.queueWorkflow(workflow);
  const status = await comfyClient.waitForCompletion(queued.prompt_id);
  const firstOutput = status.outputs[0];

  if (!firstOutput) {
    throw new Error("ComfyUI sketch-to-image workflow finished without image outputs.");
  }

  await comfyClient.saveDownloadedOutput(firstOutput, outputPath);

  return {
    output_path: outputPath,
    prompt_bundle: promptBundle,
    prompt_id: queued.prompt_id,
    request_id: requestId,
    status: "completed",
    workflow_id: workflowId,
  };
}
