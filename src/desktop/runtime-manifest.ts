import * as path from "node:path";

import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";
import type { BackendName } from "../backends/types.js";

export interface DesktopBundledBackend {
  auto_start: boolean;
  health_check: string | null;
  id: BackendName;
  label: string;
  relative_path: string;
}

export interface DesktopModelPreset {
  id: string;
  label: string;
  required: boolean;
  size_gb: number;
}

export interface DesktopRuntimeManifest {
  app_name: string;
  auto_start_backends: BackendName[];
  backends: Record<"comfyui" | "ffmpeg" | "ollama", DesktopBundledBackend>;
  dashboard: {
    host: string;
    port: number;
    url: string;
  };
  openclaw: {
    auto_start: boolean;
    host: string;
    port: number;
    url: string;
  };
  executable_name: string;
  install_dir: string;
  installer_name: string;
  models: {
    optional: DesktopModelPreset[];
    required: DesktopModelPreset[];
  };
  paths: {
    data_dir: string;
    engines_dir: string;
    logs_dir: string;
    models_dir: string;
  };
  root_dir: string;
  system_requirements: {
    min_disk_gb: number;
    min_ram_gb: number;
    recommended_vram_gb: number;
  };
}

export interface DesktopDashboardLaunchPlan {
  args: string[];
  command: string;
  cwd: string;
  url: string;
}

export function createDesktopRuntimeManifest(input: {
  dashboardHost?: string;
  dashboardPort?: number;
  env?: NodeJS.ProcessEnv;
  installDir?: string;
  platform?: NodeJS.Platform;
  rootDir?: string;
} = {}): DesktopRuntimeManifest {
  const platform = input.platform ?? process.platform;
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const installDir = input.installDir ?? defaultInstallDir(platform);
  const env = input.env ?? process.env;
  const dashboardHost = input.dashboardHost ?? env.MEDIAFORGE_DASHBOARD_HOST ?? "127.0.0.1";
  const dashboardPort = input.dashboardPort ?? parseDashboardPort(env.MEDIAFORGE_DASHBOARD_PORT);
  const openclawPort = parseDashboardPort(env.MEDIAFORGE_OPENCLAW_PORT, 4318);

  return {
    app_name: "MediaForge",
    auto_start_backends: ["comfyui", "ollama", "ffmpeg"],
    backends: {
      comfyui: {
        auto_start: true,
        health_check: "http://127.0.0.1:8188/system_stats",
        id: "comfyui",
        label: "ComfyUI",
        relative_path: path.join("engines", "comfyui", "main.py"),
      },
      ffmpeg: {
        auto_start: true,
        health_check: null,
        id: "ffmpeg",
        label: "FFmpeg",
        relative_path: path.join("engines", "ffmpeg", "bin", platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
      },
      ollama: {
        auto_start: true,
        health_check: "http://127.0.0.1:11434/api/tags",
        id: "ollama",
        label: "Ollama",
        relative_path: path.join("engines", "ollama", platform === "win32" ? "ollama.exe" : "ollama"),
      },
    },
    dashboard: {
      host: dashboardHost,
      port: dashboardPort,
      url: `http://${dashboardHost}:${dashboardPort}`,
    },
    openclaw: {
      auto_start: true,
      host: dashboardHost,
      port: openclawPort,
      url: `http://${dashboardHost}:${openclawPort}`,
    },
    executable_name: platform === "win32" ? "MediaForge.exe" : "MediaForge",
    install_dir: installDir,
    installer_name: platform === "win32" ? "MediaForge-Setup.exe" : "MediaForge-Setup",
    models: {
      optional: [
        { id: "wan22-q8", label: "Wan 2.2 Q8", required: false, size_gb: 14 },
        { id: "flux-q8", label: "Flux GGUF Q8", required: false, size_gb: 12 },
        { id: "ltx2-q4", label: "LTX-2 Q4", required: false, size_gb: 10 },
      ],
      required: [
        { id: "sdxl-base", label: "SD XL Base 1.0", required: true, size_gb: 6.5 },
        { id: "wan22-q4", label: "Wan 2.2 Q4", required: true, size_gb: 8 },
      ],
    },
    paths: {
      data_dir: path.join(installDir, "data"),
      engines_dir: path.join(installDir, "engines"),
      logs_dir: path.join(installDir, "logs"),
      models_dir: path.join(installDir, "models"),
    },
    root_dir: rootDir,
    system_requirements: {
      min_disk_gb: 40,
      min_ram_gb: 16,
      recommended_vram_gb: 12,
    },
  };
}

function parseDashboardPort(rawValue: string | undefined, fallback: number = 3210): number {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function resolveBundledBinaryPath(
  manifest: DesktopRuntimeManifest,
  backend: keyof DesktopRuntimeManifest["backends"],
): string {
  return path.join(manifest.install_dir, manifest.backends[backend].relative_path);
}

export function buildDesktopDashboardLaunchPlan(
  manifest: DesktopRuntimeManifest,
  input: {
    cliEntryRelativePath?: string;
    nodeExecutable?: string;
  } = {},
): DesktopDashboardLaunchPlan {
  const cliEntry = input.cliEntryRelativePath ?? path.join("dist", "src", "cli", "index.js");

  return {
    args: [
      path.join(manifest.root_dir, cliEntry),
      "dashboard",
      "--host",
      manifest.dashboard.host,
      "--port",
      String(manifest.dashboard.port),
    ],
    command: input.nodeExecutable ?? process.execPath,
    cwd: manifest.root_dir,
    url: manifest.dashboard.url,
  };
}

function defaultInstallDir(platform: NodeJS.Platform): string {
  if (platform === "win32") {
    return "C:\\MediaForge";
  }

  if (platform === "darwin") {
    return "/Applications/MediaForge";
  }

  return "/opt/mediaforge";
}
