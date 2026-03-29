import type { ConfigResult } from "../domain/contracts.js";

export function renderConfigOutput(result: ConfigResult, json: boolean): string {
  if (json) {
    return JSON.stringify(result, null, 2);
  }

  const lines = [
    `Default profile: ${result.default_profile}`,
    `Profiles: ${result.profiles.length}`,
    `Commands: ${result.supported_commands.join(", ")}`,
  ];

  return `${lines.join("\n")}\n`;
}
