import * as path from "node:path";

import { defaultExecFile, type ExecFileLike } from "../../backends/process-runner.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export async function runRemoveBackground(
  input: {
    inputPath: string;
    rootDir?: string;
    outputDir?: string;
    simulate?: boolean;
  },
  dependencies: {
    execFileFn?: ExecFileLike;
    pythonCommand?: string;
  } = {},
): Promise<{
    backend: "python";
    operation: "remove-bg";
    output_path: string;
    request_id: string;
    status: "simulated" | "completed";
  }> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const requestId = createRequestId({
    inputPath: input.inputPath,
    operation: "remove-bg",
  });
  const outputPath = path.resolve(
    rootDir,
    input.outputDir ?? "outputs",
    `${path.basename(input.inputPath, path.extname(input.inputPath))}-remove-bg.png`,
  );

  if (input.simulate) {
    return {
      backend: "python",
      operation: "remove-bg",
      output_path: outputPath,
      request_id: requestId,
      status: "simulated",
    };
  }

  await (dependencies.execFileFn ?? defaultExecFile)(
    dependencies.pythonCommand ?? "python",
    ["-m", "rembg", "i", input.inputPath, outputPath],
  );

  return {
    backend: "python",
    operation: "remove-bg",
    output_path: outputPath,
    request_id: requestId,
    status: "completed",
  };
}
