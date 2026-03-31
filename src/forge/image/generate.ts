import * as path from "node:path";

import { ComfyUIBackend } from "../../backends/comfyui.js";
import { buildForgePromptBundle, type ForgePromptClient } from "../../prompt/forge-prompt-builder.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { resolveLLMClient } from "../../backends/resolve-llm-client.js";
import { loadWorkflowTemplate } from "../workflows/load-workflow-template.js";

export interface ImageGenerateOptions {
  prompt: string;
  negative_prompt?: string;
  model: "sdxl" | "flux";
  resolution: "1k" | "2k" | "4k";
  aspect_ratio: "1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "3:2" | "21:9";
  batch_count: number;
  seed?: number;
  steps?: number;
  cfg_scale?: number;
  outputDir?: string;
  rootDir?: string;
  simulate?: boolean;
  theme?: string | null;
}

export interface ImageGenerateResult {
  output_paths: string[];
  prompt_bundle: Awaited<ReturnType<typeof buildForgePromptBundle>>;
  request_id: string;
  status: "simulated" | "completed";
  workflow_id: string;
}

export async function runImageGenerate(
  options: ImageGenerateOptions,
  dependencies: {
    comfyClient?: ComfyUIBackend;
    ollamaClient?: ForgePromptClient;
  } = {},
): Promise<ImageGenerateResult> {
  const rootDir = resolveMediaForgeRoot(options.rootDir ?? process.cwd());
  const requestId = createRequestId({
    aspect_ratio: options.aspect_ratio,
    model: options.model,
    prompt: options.prompt,
    resolution: options.resolution,
  });
  const promptBundle = await buildForgePromptBundle({
    desc_ko: options.prompt,
    ollamaClient: dependencies.ollamaClient ?? await resolveLLMClient({ rootDir }),
    theme: options.theme,
  });
  const outputDir = path.resolve(rootDir, options.outputDir ?? "outputs");

  const outputPaths = Array.from({ length: Math.max(1, options.batch_count) }, (_, index) =>
    path.resolve(outputDir, `${requestId}-image-${index + 1}.png`));
  const workflowId = options.model === "flux" ? "flux_text_to_image" : "sdxl_text_to_image";

  if (options.simulate !== false) {
    return {
      output_paths: outputPaths,
      prompt_bundle: promptBundle,
      request_id: requestId,
      status: "simulated",
      workflow_id: workflowId,
    };
  }

  const workflow = await loadWorkflowTemplate(
    workflowId,
    {
      batch_count: Math.max(1, options.batch_count),
      cfg_scale: options.cfg_scale ?? 7,
      negative_prompt: options.negative_prompt ?? promptBundle.image_negative,
      output_path: outputPaths[0] ?? path.resolve(outputDir, `${requestId}-image-1.png`),
      positive_prompt: promptBundle.image_prompt,
      seed: options.seed ?? -1,
      steps: options.steps ?? 20,
    },
    rootDir,
  );
  const comfyClient = dependencies.comfyClient ?? new ComfyUIBackend({ autoStart: true, rootDir });
  const queued = await comfyClient.queueWorkflow(workflow);
  const status = await comfyClient.waitForCompletion(queued.prompt_id);
  const savedOutputs = await Promise.all(
    status.outputs.slice(0, outputPaths.length).map((output, index) =>
      comfyClient.saveDownloadedOutput(
        output,
        outputPaths[index] ?? path.resolve(outputDir, `${requestId}-image-${index + 1}.png`),
      )),
  );

  return {
    output_paths: savedOutputs,
    prompt_bundle: promptBundle,
    request_id: requestId,
    status: "completed",
    workflow_id: workflowId,
  };
}
