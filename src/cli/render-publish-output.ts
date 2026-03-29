import type { PublishPlan } from "../domain/contracts.js";

export function renderPublishOutput(result: PublishPlan, json: boolean): string {
  if (json) {
    return JSON.stringify(result, null, 2);
  }

  const lines = [
    `Publish platform: ${result.platform}`,
    `Title: ${result.title}`,
    `Hashtags: ${result.hashtags.length}`,
    `Warnings: ${result.warnings.length}`,
  ];

  return `${lines.join("\n")}\n`;
}
