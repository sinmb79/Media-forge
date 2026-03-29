import * as path from "node:path";

import { ComfyUIBackend } from "../../backends/comfyui.js";
import { createRequestId } from "../../shared/request-id.js";
import { loadWorkflowTemplate } from "../workflows/load-workflow-template.js";

export interface UpscaleMediaResult {
  output_path: string;
  request_id: string;
  scale: number;
  status: "completed" | "simulated";
  workflow_id: string;
}

export async function runUpscaleMedia(
  input: {
    inputPath: string;
    outputDir?: string;
    rootDir?: string;
    scale: number;
    simulate?: boolean;
  },
  dependencies: {
    comfyClient?: ComfyUIBackend;
  } = {},
): Promise<UpscaleMediaResult> {
  const rootDir = input.rootDir ?? process.cwd();
  const requestId = createRequestId({
    inputPath: input.inputPath,
    operation: "upscale",
    scale: input.scale,
  });
  const outputPath = path.resolve(
    rootDir,
    input.outputDir ?? "outputs",
    `${path.basename(input.inputPath, path.extname(input.inputPath))}-upscale${path.extname(input.inputPath) || ".mp4"}`,
  );
  const workflowId = "realesrgan_upscale";

  if (input.simulate) {
    return {
      output_path: outputPath,
      request_id: requestId,
      scale: input.scale,
      status: "simulated",
      workflow_id: workflowId,
    };
  }

  const workflow = await loadWorkflowTemplate(
    workflowId,
    {
      input_path: input.inputPath,
      output_path: outputPath,
      scale: input.scale,
    },
    rootDir,
  );
  const comfyClient = dependencies.comfyClient ?? new ComfyUIBackend({ rootDir });
  const queued = await comfyClient.queueWorkflow(workflow);
  const status = await comfyClient.waitForCompletion(queued.prompt_id);
  const firstOutput = status.outputs[0];

  if (!firstOutput) {
    throw new Error("ComfyUI upscale workflow finished without outputs.");
  }

  await comfyClient.saveDownloadedOutput(firstOutput, outputPath);

  return {
    output_path: outputPath,
    request_id: requestId,
    scale: input.scale,
    status: "completed",
    workflow_id: workflowId,
  };
}
