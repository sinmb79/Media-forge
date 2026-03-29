import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { buildRequestScaffold } from "../create/build-request-scaffold.js";
import {
  EXIT_CODE_INTERNAL_ERROR,
  EXIT_CODE_SUCCESS,
} from "./exit-codes.js";
import { renderCreateOutput } from "./render-create-output.js";

export async function createEngineCommand(
  profileId: string,
  outputPath: string,
  options: { json: boolean },
): Promise<{ exitCode: number; output: string }> {
  try {
    const result = buildRequestScaffold(profileId, outputPath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result.request, null, 2)}\n`, "utf8");

    return {
      exitCode: EXIT_CODE_SUCCESS,
      output: renderCreateOutput(result, options.json),
    };
  } catch (error) {
    return {
      exitCode: EXIT_CODE_INTERNAL_ERROR,
      output: options.json
        ? JSON.stringify(
            {
              fatal_error: error instanceof Error ? error.message : "Unknown error",
            },
            null,
            2,
          )
        : `Fatal error: ${error instanceof Error ? error.message : "Unknown error"}\n`,
    };
  }
}
