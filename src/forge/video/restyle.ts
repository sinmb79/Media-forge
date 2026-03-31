import * as path from "node:path";

import { ComfyUIBackend } from "../../backends/comfyui.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { loadWorkflowTemplate } from "../workflows/load-workflow-template.js";

export interface VideoRestyleOptions {
  inputPath: string;
  prompt: string;
  style?: string;
  rootDir?: string;
  outputDir?: string;
  simulate?: boolean;
}

export interface VideoRestyleResult {
  operation: "restyle";
  output_path: string;
  request_id: string;
  status: "simulated" | "completed";
  workflow_id: string;
}

export async function runVideoRestyle(
  input: VideoRestyleOptions,
  dependencies: {
    comfyClient?: Pick<ComfyUIBackend, "queueWorkflow" | "saveDownloadedOutput" | "waitForCompletion">;
  } = {},
): Promise<VideoRestyleResult> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const requestId = createRequestId({
    inputPath: input.inputPath,
    prompt: input.prompt,
    style: input.style ?? null,
  });
  const outputPath = path.resolve(rootDir, input.outputDir ?? "outputs", `${requestId}-restyle.mp4`);

  const workflowId = "wan22_v2v_restyle";

  if (input.simulate !== false) {
    return {
      operation: "restyle",
      output_path: outputPath,
      request_id: requestId,
      status: "simulated",
      workflow_id: workflowId,
    };
  }

  const workflow = await loadWorkflowTemplate(
    workflowId,
    {
      input_path: input.inputPath,
      output_path: outputPath,
      prompt: input.prompt,
      style: input.style ?? "default",
    },
    rootDir,
  );
  const comfyClient = dependencies.comfyClient ?? new ComfyUIBackend({ autoStart: true, rootDir });
  const queued = await comfyClient.queueWorkflow(workflow);
  const status = await comfyClient.waitForCompletion(queued.prompt_id);
  const firstOutput = status.outputs[0];

  if (!firstOutput) {
    throw new Error("ComfyUI restyle workflow finished without video outputs.");
  }

  await comfyClient.saveDownloadedOutput(firstOutput, outputPath);

  return {
    operation: "restyle",
    output_path: outputPath,
    request_id: requestId,
    status: "completed",
    workflow_id: workflowId,
  };
}
