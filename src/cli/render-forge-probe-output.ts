import type { ForgeBackendProbeResult } from "../forge/contracts.js";

export function renderForgeProbeOutput(result: ForgeBackendProbeResult, json: boolean): string {
  if (json) {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  const lines = [
    `Forge backend probe: ${result.available_count} available / ${result.unavailable_count} unavailable`,
  ];

  for (const backend of result.backends) {
    lines.push(`- ${backend.name}: ${backend.available ? "available" : "missing"}`);
    lines.push(`  Path: ${backend.detectedPath ?? "not found"}`);
    lines.push(`  Version: ${backend.version ?? "unknown"}`);
  }

  return `${lines.join("\n")}\n`;
}
