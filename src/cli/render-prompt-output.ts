import type { PromptResult } from "../domain/contracts.js";

export function renderPromptOutput(result: PromptResult, json: boolean): string {
  if (json) {
    return JSON.stringify(result, null, 2);
  }

  const lines = [
    `Engine: ${result.engine}`,
    `Quality score: ${result.quality_score}`,
    `Warnings: ${result.warnings.length}`,
    `Main prompt: ${result.main_prompt}`,
  ];

  return `${lines.join("\n")}\n`;
}
