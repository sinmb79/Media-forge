import * as os from "node:os";
import { spawn } from "node:child_process";

export interface DesktopSystemCheck {
  cpu_model: string;
  disk_note: string;
  platform: NodeJS.Platform;
  ram_gb: number;
  vram_note: string;
}

export async function readDesktopSystemCheck(): Promise<DesktopSystemCheck> {
  return {
    cpu_model: os.cpus()[0]?.model ?? "Unknown CPU",
    disk_note: "Install path validation is handled by the setup wizard.",
    platform: process.platform,
    ram_gb: Math.round((os.totalmem() / (1024 ** 3)) * 10) / 10,
    vram_note: await readVramNote(),
  };
}

async function readVramNote(): Promise<string> {
  if (process.platform !== "win32") {
    return "GPU probing is currently optimized for Windows packaging.";
  }

  return new Promise((resolve) => {
    const child = spawn("nvidia-smi", [
      "--query-gpu=name,memory.total",
      "--format=csv,noheader",
    ], {
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });

    let output = "";
    child.stdout.on("data", (buffer) => {
      output += buffer.toString("utf8");
    });
    child.once("error", () => resolve("nvidia-smi is unavailable."));
    child.once("exit", () => {
      const line = output.split(/\r?\n/).map((value) => value.trim()).find(Boolean);
      resolve(line ?? "GPU information is unavailable.");
    });
  });
}
