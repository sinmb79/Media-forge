import * as path from "node:path";

import { ProPainterBackend } from "../../backends/propainter.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export interface RemoveObjectResult {
  backend: "propainter";
  output_path: string;
  request_id: string;
  status: "completed" | "simulated";
}

export async function runRemoveObject(
  input: {
    fp16?: boolean;
    height?: number;
    inputPath: string;
    maskPath: string;
    outputDir?: string;
    outputPath?: string;
    rootDir?: string;
    simulate?: boolean;
    width?: number;
  },
  dependencies: {
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
): Promise<RemoveObjectResult> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const requestId = createRequestId({
    inputPath: input.inputPath,
    maskPath: input.maskPath,
    operation: "remove-object",
  });
  const outputPath = input.outputPath ?? path.resolve(
    rootDir,
    input.outputDir ?? "outputs",
    `${path.basename(input.inputPath, path.extname(input.inputPath))}-remove-object${path.extname(input.inputPath) || ".mp4"}`,
  );

  if (input.simulate) {
    return {
      backend: "propainter",
      output_path: outputPath,
      request_id: requestId,
      status: "simulated",
    };
  }

  const propainter = dependencies.propainter ?? new ProPainterBackend();
  await propainter.run({
    inputPath: input.inputPath,
    maskPath: input.maskPath,
    outputPath,
    ...(input.fp16 !== undefined ? { fp16: input.fp16 } : {}),
    ...(input.height !== undefined ? { height: input.height } : {}),
    ...(input.width !== undefined ? { width: input.width } : {}),
  });

  return {
    backend: "propainter",
    output_path: outputPath,
    request_id: requestId,
    status: "completed",
  };
}
