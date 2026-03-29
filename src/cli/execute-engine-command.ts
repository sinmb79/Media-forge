import { writeFile } from "node:fs/promises";

import { resolveAdapter } from "../adapters/video/adapter-registry.js";
import { resolvePlanningContext } from "./resolve-planning-context.js";
import { loadEngineRequest } from "./load-engine-request.js";
import {
  EXIT_CODE_INTERNAL_ERROR,
  EXIT_CODE_SUCCESS,
  EXIT_CODE_VALIDATION_FAILURE,
} from "./exit-codes.js";
import {
  executeVideoGeneration,
  type ExecuteVideoResult,
} from "../execute/execute-video-generation.js";

function renderExecuteOutput(result: ExecuteVideoResult, json: boolean): string {
  if (json) return `${JSON.stringify(result, null, 2)}\n`;

  const lines: string[] = [
    `Execute Result (dry_run: ${result.dry_run})`,
    `Executed at: ${result.executed_at}`,
    `Nodes: ${result.summary.total} total / ${result.summary.success} success / ${result.summary.dry_run} dry_run / ${result.summary.error} error`,
    "",
  ];

  for (const node of result.nodes) {
    lines.push(`  [${node.status}] ${node.node_id} → adapter: ${node.adapter}`);
    if (node.error) lines.push(`    error: ${node.error}`);
  }

  return lines.join("\n") + "\n";
}

export async function executeEngineCommand(
  requestPath: string,
  options: { json: boolean; dry_run: boolean },
): Promise<{ exitCode: number; output: string }> {
  try {
    const loaded = await loadEngineRequest(requestPath);

    if (!loaded.validation.valid || !loaded.request) {
      return {
        exitCode: EXIT_CODE_VALIDATION_FAILURE,
        output: `Validation failed: ${loaded.validation.errors.map((e) => e.message).join(", ")}\n`,
      };
    }

    const context = resolvePlanningContext(loaded.request);
    const result = await executeVideoGeneration(context, {
      dry_run: options.dry_run,
      resolveAdapter,
    });

    const outputPath = requestPath.replace(/\.json$/, ".execute-result.json");
    try {
      await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    } catch {
      // writeFile failure does not affect exit code or output
    }

    return {
      exitCode: EXIT_CODE_SUCCESS,
      output: renderExecuteOutput(result, options.json),
    };
  } catch (error) {
    return {
      exitCode: EXIT_CODE_INTERNAL_ERROR,
      output: `Fatal error: ${error instanceof Error ? error.message : "Unknown error"}\n`,
    };
  }
}
