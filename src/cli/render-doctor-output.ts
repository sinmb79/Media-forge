import type { DoctorResult } from "../domain/contracts.js";

export function renderDoctorOutput(result: DoctorResult, json: boolean): string {
  if (json) {
    return JSON.stringify(result, null, 2);
  }

  const lines = [
    `Doctor status: ${result.status}`,
    `Checks: ${result.checks.length}`,
    `Warnings: ${result.warnings.length}`,
  ];

  return `${lines.join("\n")}\n`;
}
