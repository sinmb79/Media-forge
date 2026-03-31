import * as path from "node:path";

import { ComfyUIBackend } from "../../backends/comfyui.js";
import { buildForgePromptBundle, type ForgePromptClient } from "../../prompt/forge-prompt-builder.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { resolveLLMClient } from "../../backends/resolve-llm-client.js";
import { loadWorkflowTemplate } from "../workflows/load-workflow-template.js";

export interface Img2ImgOptions {
  input_path: string;
  prompt?: string;
  style: "anime" | "ghibli" | "realistic" | "watercolor" | "oil" | "pixel";
  strength: number;
  model: "sdxl" | "flux";
  outputDir?: string;
  rootDir?: string;
  simulate?: boolean;
}

export interface Img2ImgResult {
  output_path: string;
  prompt_bundle: Awaited<ReturnType<typeof buildForgePromptBundle>>;
  request_id: string;
  status: "simulated" | "completed";
  workflow_id: string;
}

export async function runImg2Img(
  options: Img2ImgOptions,
  dependencies: {
    comfyClient?: ComfyUIBackend;
    ollamaClient?: ForgePromptClient;
  } = {},
): Promise<Img2ImgResult> {
  const rootDir = resolveMediaForgeRoot(options.rootDir ?? process.cwd());
  const requestId = createRequestId({
    input_path: options.input_path,
    prompt: options.prompt ?? options.style,
    style: options.style,
  });
  const promptBundle = await buildForgePromptBundle({
    desc_ko: options.prompt ?? `${options.style} style transformation`,
    ollamaClient: dependencies.ollamaClient ?? await resolveLLMClient({ rootDir }),
    theme: options.style,
  });

  const outputPath = path.resolve(rootDir, options.outputDir ?? "outputs", `${requestId}-styled.png`);
  const workflowId = options.model === "flux" ? "flux_img2img" : "sdxl_img2img";

  if (options.simulate !== false) {
    return {
      output_path: outputPath,
      prompt_bundle: promptBundle,
      request_id: requestId,
      status: "simulated",
      workflow_id: workflowId,
    };
  }

  const workflow = await loadWorkflowTemplate(
    workflowId,
    {
      input_path: options.input_path,
      output_path: outputPath,
      positive_prompt: promptBundle.image_prompt,
      strength: options.strength,
    },
    rootDir,
  );
  const comfyClient = dependencies.comfyClient ?? new ComfyUIBackend({ autoStart: true, rootDir });
  const queued = await comfyClient.queueWorkflow(workflow);
  const status = await comfyClient.waitForCompletion(queued.prompt_id);
  const firstOutput = status.outputs[0];

  if (!firstOutput) {
    throw new Error("ComfyUI img2img workflow finished without image outputs.");
  }

  await comfyClient.saveDownloadedOutput(firstOutput, outputPath);

  return {
    output_path: outputPath,
    prompt_bundle: promptBundle,
    request_id: requestId,
    status: "completed",
    workflow_id: workflowId,
  };
}
