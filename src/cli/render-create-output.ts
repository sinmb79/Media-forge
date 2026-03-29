import type { CreateResult } from "../domain/contracts.js";

export function renderCreateOutput(result: CreateResult, json: boolean): string {
  if (json) {
    return JSON.stringify(result, null, 2);
  }

  const lines = [
    `Profile: ${result.profile}`,
    `Output path: ${result.output_path}`,
  ];

  return `${lines.join("\n")}\n`;
}
