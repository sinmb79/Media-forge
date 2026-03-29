import { statfs } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

import { inspectBackends } from "../../backends/registry.js";
import { loadJsonConfigFile } from "../config/load-json-config.js";
import type {
  DiskInfo,
  ForgeDoctorResult,
  GpuInfo,
  HardwareProfile,
  RamInfo,
} from "../contracts.js";

export interface ForgeDoctorDependencies {
  rootDir: string;
  inspectBackends(): Promise<ForgeDoctorResult["backends"]>;
  loadHardwareProfile(): Promise<HardwareProfile | null>;
  getGpuInfo(): Promise<GpuInfo | null>;
  getRamInfo(): RamInfo;
  getDiskInfo(targetPath: string): Promise<DiskInfo>;
}

export async function buildForgeDoctorReport(
  dependencies?: Partial<ForgeDoctorDependencies>,
): Promise<ForgeDoctorResult> {
  const rootDir = dependencies?.rootDir ?? process.cwd();
  const inspectBackendsFn = dependencies?.inspectBackends ?? (() => inspectBackends(rootDir));
  const loadHardwareProfileFn = dependencies?.loadHardwareProfile
    ?? (() => loadHardwareProfile(rootDir));
  const getGpuInfoFn = dependencies?.getGpuInfo ?? detectGpuInfo;
  const getRamInfoFn = dependencies?.getRamInfo ?? detectRamInfo;
  const getDiskInfoFn = dependencies?.getDiskInfo ?? detectDiskInfo;

  const [backends, configuredHardware, gpuInfo, diskInfo] = await Promise.all([
    inspectBackendsFn(),
    loadHardwareProfileFn(),
    getGpuInfoFn(),
    getDiskInfoFn(rootDir),
  ]);

  const warnings = backends
    .filter((backend) => backend.available === false)
    .map((backend) => `Backend unavailable: ${backend.name} (${backend.installGuideUrl})`);

  const status = warnings.length > 0 ? "warning" : "ok";

  return {
    schema_version: "0.1",
    status,
    backends,
    system: {
      gpu: gpuInfo,
      ram: getRamInfoFn(),
      disk: diskInfo,
      configured_hardware: configuredHardware,
    },
    warnings,
  };
}

async function loadHardwareProfile(rootDir: string): Promise<HardwareProfile | null> {
  try {
    const filePath = path.resolve(rootDir, "config", "hardware-profile.yaml");
    return await loadJsonConfigFile<HardwareProfile>(filePath);
  } catch {
    return null;
  }
}

async function detectGpuInfo(): Promise<GpuInfo | null> {
  const result = spawnSync("nvidia-smi", [
    "--query-gpu=name,memory.total,memory.free",
    "--format=csv,noheader,nounits",
  ], {
    encoding: "utf8",
  });

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  const [namePart, totalPart, freePart] = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)
    ?.split(",")
    .map((part) => part.trim()) ?? [];

  if (!namePart || !totalPart) {
    return null;
  }

  return {
    name: namePart,
    total_vram_gb: toGb(Number(totalPart), 1024),
    free_vram_gb: freePart ? toGb(Number(freePart), 1024) : null,
  };
}

function detectRamInfo(): RamInfo {
  return {
    total_gb: toGb(os.totalmem()),
    free_gb: toGb(os.freemem()),
  };
}

async function detectDiskInfo(targetPath: string): Promise<DiskInfo> {
  try {
    const stats = await statfs(targetPath);
    return {
      mount: path.parse(path.resolve(targetPath)).root,
      total_gb: toGb(stats.blocks * stats.bsize),
      free_gb: toGb(stats.bavail * stats.bsize),
    };
  } catch {
    return {
      mount: path.parse(path.resolve(targetPath)).root,
      total_gb: null,
      free_gb: null,
    };
  }
}

function toGb(value: number, divisor: number = 1024 ** 3): number {
  return Math.round((value / divisor) * 10) / 10;
}
