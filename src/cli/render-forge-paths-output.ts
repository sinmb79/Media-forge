import type { ForgePathsValidationResult } from "../forge/contracts.js";

export function renderForgePathsOutput(result: ForgePathsValidationResult, json: boolean): string {
  if (json) {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  const lines = [
    `Forge path validation: ${result.status}`,
  ];

  for (const file of result.files) {
    lines.push(`- ${file.name}: ${file.valid ? "valid" : "invalid"}`);
    lines.push(`  Path: ${file.filePath}`);
    lines.push(`  Message: ${file.message}`);
  }

  lines.push(`Warnings: ${result.warnings.length}`);

  return `${lines.join("\n")}\n`;
}
