import * as path from "node:path";

import { ComfyUIBackend } from "../../backends/comfyui.js";
import { createRequestId } from "../../shared/request-id.js";
import { loadWorkflowTemplate } from "../workflows/load-workflow-template.js";
import { runRemoveObject } from "./remove-object.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export interface RemoveWatermarkResult {
  backend: "comfyui" | "propainter";
  output_path: string;
  request_id: string;
  status: "completed" | "simulated";
  workflow_id: string | null;
}

export async function runRemoveWatermark(
  input: {
    inputPath: string;
    maskPath?: string;
    outputDir?: string;
    rootDir?: string;
    simulate?: boolean;
  },
  dependencies: {
    comfyClient?: ComfyUIBackend;
    propainter?: {
      run(input: {
        fp16?: boolean;
        height?: number;
        inputPath: string;
        maskPath: string;
        outputPath: string;
        width?: number;
      }): Promise<string>;
    };
  } = {},
): Promise<RemoveWatermarkResult> {
  if (!isImagePath(input.inputPath)) {
    const videoResult = await runRemoveObject(
      {
        inputPath: input.inputPath,
        maskPath: input.maskPath ?? resolveAutoMaskPath(input.inputPath, input.rootDir),
        ...(input.outputDir ? { outputDir: input.outputDir } : {}),
        ...(input.rootDir ? { rootDir: input.rootDir } : {}),
        ...(input.simulate !== undefined ? { simulate: input.simulate } : {}),
      },
      dependencies.propainter
        ? {
          propainter: dependencies.propainter,
        }
        : {},
    );

    return {
      backend: "propainter",
      output_path: videoResult.output_path,
      request_id: videoResult.request_id,
      status: videoResult.status,
      workflow_id: null,
    };
  }

  const rootDir = input.rootDir ?? process.cwd();
  const requestId = createRequestId({
    inputPath: input.inputPath,
    operation: "remove-watermark",
  });
  const outputPath = path.resolve(
    rootDir,
    input.outputDir ?? "outputs",
    `${path.basename(input.inputPath, path.extname(input.inputPath))}-remove-watermark${path.extname(input.inputPath) || ".png"}`,
  );
  const workflowId = "watermark_remove_image";

  if (input.simulate) {
    return {
      backend: "comfyui",
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
      output_path: outputPath,
    },
    rootDir,
  );
  const comfyClient = dependencies.comfyClient ?? new ComfyUIBackend({ rootDir });
  const queued = await comfyClient.queueWorkflow(workflow);
  const status = await comfyClient.waitForCompletion(queued.prompt_id);
  const firstOutput = status.outputs[0];

  if (!firstOutput) {
    throw new Error("ComfyUI watermark removal finished without image outputs.");
  }

  await comfyClient.saveDownloadedOutput(firstOutput, outputPath);

  return {
    backend: "comfyui",
    output_path: outputPath,
    request_id: requestId,
    status: "completed",
    workflow_id: workflowId,
  };
}

function isImagePath(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function resolveAutoMaskPath(inputPath: string, rootDir: string | undefined): string {
  const baseRoot = rootDir ?? process.cwd();
  return path.resolve(
    baseRoot,
    "outputs",
    `${path.basename(inputPath, path.extname(inputPath))}-watermark-mask.png`,
  );
}
