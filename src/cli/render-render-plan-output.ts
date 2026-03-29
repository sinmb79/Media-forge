import type { RenderPlan } from "../domain/contracts.js";

export function renderRenderPlanOutput(result: RenderPlan, json: boolean): string {
  if (json) {
    return JSON.stringify(result, null, 2);
  }

  const lines = [
    `Render engine: ${result.engine}`,
    `Output file: ${result.output_filename}`,
    `Segments: ${result.segments.length}`,
    `Warnings: ${result.warnings.length}`,
  ];

  return `${lines.join("\n")}\n`;
}
