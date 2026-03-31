import * as path from "node:path";

import { ComfyUIBackend } from "../../backends/comfyui.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { loadWorkflowTemplate } from "../workflows/load-workflow-template.js";

export async function runImageInpaint(
  input: {
    inputPath: string;
    maskPath: string;
    prompt: string;
    rootDir?: string;
    outputDir?: string;
    simulate?: boolean;
  },
  dependencies: {
    comfyClient?: ComfyUIBackend;
  } = {},
): Promise<{
    operation: "inpaint";
    output_path: string;
    request_id: string;
    status: "simulated" | "completed";
    workflow_id: string;
  }> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const requestId = createRequestId({
    inputPath: input.inputPath,
    operation: "inpaint",
    prompt: input.prompt,
  });
  const outputPath = path.resolve(
    rootDir,
    input.outputDir ?? "outputs",
    `${path.basename(input.inputPath, path.extname(input.inputPath))}-inpaint.png`,
  );
  const workflowId = "sdxl_inpaint";

  if (input.simulate) {
    return {
      operation: "inpaint",
      output_path: outputPath,
      request_id: requestId,
      status: "simulated",
      workflow_id: workflowId,
    };
  }

  const workflow = await loadWorkflowTemplate(
    workflowId,
    {
      image_path: input.inputPath,
      mask_path: input.maskPath,
      output_path: outputPath,
      prompt: input.prompt,
    },
    rootDir,
  );
  const comfyClient = dependencies.comfyClient ?? new ComfyUIBackend({ autoStart: true, rootDir });
  const queued = await comfyClient.queueWorkflow(workflow);
  const status = await comfyClient.waitForCompletion(queued.prompt_id);
  const firstOutput = status.outputs[0];

  if (!firstOutput) {
    throw new Error("ComfyUI inpaint workflow finished without image outputs.");
  }

  await comfyClient.saveDownloadedOutput(firstOutput, outputPath);

  return {
    operation: "inpaint",
    output_path: outputPath,
    request_id: requestId,
    status: "completed",
    workflow_id: workflowId,
  };
}
