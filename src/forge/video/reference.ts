import * as path from "node:path";

import { ComfyUIBackend } from "../../backends/comfyui.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { loadWorkflowTemplate } from "../workflows/load-workflow-template.js";

export interface VideoReferenceOptions {
  referencePath: string;
  prompt: string;
  rootDir?: string;
  outputDir?: string;
  simulate?: boolean;
}

export interface VideoReferenceResult {
  operation: "reference";
  output_path: string;
  request_id: string;
  status: "simulated" | "completed";
  workflow_id: string;
}

export async function runVideoReference(
  input: VideoReferenceOptions,
  dependencies: {
    comfyClient?: Pick<ComfyUIBackend, "queueWorkflow" | "saveDownloadedOutput" | "waitForCompletion">;
  } = {},
): Promise<VideoReferenceResult> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const requestId = createRequestId({
    prompt: input.prompt,
    referencePath: input.referencePath,
  });
  const outputPath = path.resolve(rootDir, input.outputDir ?? "outputs", `${requestId}-reference.mp4`);

  const workflowId = "wan22_reference_video";

  if (input.simulate !== false) {
    return {
      operation: "reference",
      output_path: outputPath,
      request_id: requestId,
      status: "simulated",
      workflow_id: workflowId,
    };
  }

  const workflow = await loadWorkflowTemplate(
    workflowId,
    {
      output_path: outputPath,
      prompt: input.prompt,
      reference_path: input.referencePath,
    },
    rootDir,
  );
  const comfyClient = dependencies.comfyClient ?? new ComfyUIBackend({ autoStart: true, rootDir });
  const queued = await comfyClient.queueWorkflow(workflow);
  const status = await comfyClient.waitForCompletion(queued.prompt_id);
  const firstOutput = status.outputs[0];

  if (!firstOutput) {
    throw new Error("ComfyUI reference workflow finished without video outputs.");
  }

  await comfyClient.saveDownloadedOutput(firstOutput, outputPath);

  return {
    operation: "reference",
    output_path: outputPath,
    request_id: requestId,
    status: "completed",
    workflow_id: workflowId,
  };
}
