import type { ForgeDoctorResult } from "../forge/contracts.js";

export function renderForgeDoctorOutput(result: ForgeDoctorResult, json: boolean): string {
  if (json) {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  const lines = [
    `Forge doctor status: ${result.status}`,
    "",
    "Backends:",
  ];

  for (const backend of result.backends) {
    const status = backend.available ? "available" : "missing";
    lines.push(`- ${backend.name}: ${status}`);
    lines.push(`  Path: ${backend.detectedPath ?? "not found"}`);
    lines.push(`  Version: ${backend.version ?? "unknown"}`);
    if (!backend.available) {
      lines.push(`  Install guide: ${backend.installGuideUrl}`);
    }
  }

  lines.push(
    "",
    "System:",
    `- GPU: ${formatGpu(result)}`,
    `- RAM: ${result.system.ram.total_gb} GB total / ${result.system.ram.free_gb} GB free`,
    `- Disk (${result.system.disk.mount}): ${formatDisk(result)}`,
  );

  if (result.system.configured_hardware?.gpu?.name || result.system.configured_hardware?.cpu?.name) {
    lines.push(
      `- Configured profile: ${result.system.configured_hardware.gpu?.name ?? "unknown GPU"} / ${result.system.configured_hardware.cpu?.name ?? "unknown CPU"}`,
    );
  }

  lines.push(`Warnings: ${result.warnings.length}`);

  return `${lines.join("\n")}\n`;
}

function formatGpu(result: ForgeDoctorResult): string {
  if (!result.system.gpu) {
    return "not detected";
  }

  const gpu = result.system.gpu;
  const free = gpu.free_vram_gb === null ? "unknown free VRAM" : `${gpu.free_vram_gb} GB free`;
  return `${gpu.name} (${gpu.total_vram_gb} GB total / ${free})`;
}

function formatDisk(result: ForgeDoctorResult): string {
  const { total_gb, free_gb } = result.system.disk;

  if (total_gb === null || free_gb === null) {
    return "not detected";
  }

  return `${total_gb} GB total / ${free_gb} GB free`;
}
