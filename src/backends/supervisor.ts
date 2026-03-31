import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import * as path from "node:path";

import { loadForgeDefaults, type ForgeDefaultsConfig } from "../forge/config/load-forge-defaults.js";
import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";
import { inspectBackends, loadBackendPathCatalog } from "./registry.js";
import type { BackendName, BackendPathCatalog, BackendStatus } from "./types.js";

export interface BackendEnsureResult {
  name: BackendName;
  args: string[];
  command: string | null;
  cwd: string | null;
  pid: number | null;
  ready: boolean;
  ready_url: string | null;
  reason: string | null;
  started: boolean;
  status: "missing" | "ready" | "started";
}

export interface BackendLaunchOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface BackendSupervisorDependencies {
  env?: NodeJS.ProcessEnv;
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
  inspectBackendsFn?: typeof inspectBackends;
  loadBackendPathCatalogFn?: typeof loadBackendPathCatalog;
  loadForgeDefaultsFn?: typeof loadForgeDefaults;
  pathExists?: (targetPath: string) => Promise<boolean>;
  platform?: NodeJS.Platform;
  sleepFn?: (ms: number) => Promise<void>;
  spawnProcess?: (
    command: string,
    args: string[],
    options: BackendLaunchOptions,
  ) => Promise<{ pid: number | null }>;
}

interface BackendLaunchSpec {
  args: string[];
  command: string;
  cwd: string;
  readyUrl: string;
}

const SERVICE_BACKENDS = new Set<BackendName>(["comfyui", "ollama"]);

export async function ensureBackendReady(
  name: BackendName,
  input: {
    rootDir?: string;
    timeoutMs?: number;
  } = {},
  dependencies: BackendSupervisorDependencies = {},
): Promise<BackendEnsureResult> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const inspect = dependencies.inspectBackendsFn ?? inspectBackends;
  const loadDefaults = dependencies.loadForgeDefaultsFn ?? loadForgeDefaults;
  const defaults = await loadDefaults(rootDir);
  const statuses = await inspect(rootDir);
  const status = statuses.find((entry) => entry.name === name) ?? null;

  if (!SERVICE_BACKENDS.has(name)) {
    return buildExecutableBackendResult(name, status);
  }

  const readyUrl = buildReadyUrl(name, defaults);
  if (await isBackendReady(readyUrl, dependencies.fetchFn)) {
    return {
      name,
      args: [],
      command: null,
      cwd: null,
      pid: null,
      ready: true,
      ready_url: readyUrl,
      reason: "Backend service is already responding.",
      started: false,
      status: "ready",
    };
  }

  const launchSpec = await resolveBackendLaunchSpec(name, rootDir, statuses, defaults, dependencies);
  if (!launchSpec) {
    return {
      name,
      args: [],
      command: null,
      cwd: null,
      pid: null,
      ready: false,
      ready_url: readyUrl,
      reason: buildMissingLaunchReason(name),
      started: false,
      status: "missing",
    };
  }

  let pid: number | null = null;

  try {
    const launched = await (dependencies.spawnProcess ?? defaultSpawnProcess)(
      launchSpec.command,
      launchSpec.args,
      {
        cwd: launchSpec.cwd,
        env: dependencies.env ?? process.env,
      },
    );
    pid = launched.pid;
  } catch (error) {
    return {
      name,
      args: launchSpec.args,
      command: launchSpec.command,
      cwd: launchSpec.cwd,
      pid,
      ready: false,
      ready_url: launchSpec.readyUrl,
      reason: error instanceof Error ? error.message : "Failed to launch backend service.",
      started: false,
      status: "missing",
    };
  }

  const timeoutMs = Math.max(1_000, input.timeoutMs ?? 30_000);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    if (await isBackendReady(launchSpec.readyUrl, dependencies.fetchFn)) {
      return {
        name,
        args: launchSpec.args,
        command: launchSpec.command,
        cwd: launchSpec.cwd,
        pid,
        ready: true,
        ready_url: launchSpec.readyUrl,
        reason: "Backend service started successfully.",
        started: true,
        status: "started",
      };
    }

    await (dependencies.sleepFn ?? sleep)(500);
  }

  return {
    name,
    args: launchSpec.args,
    command: launchSpec.command,
    cwd: launchSpec.cwd,
    pid,
    ready: false,
    ready_url: launchSpec.readyUrl,
    reason: `Timed out waiting for ${name} to become ready.`,
    started: true,
    status: "missing",
  };
}

export async function ensureBackendsReady(
  names: BackendName[],
  input: {
    rootDir?: string;
    timeoutMs?: number;
  } = {},
  dependencies: BackendSupervisorDependencies = {},
): Promise<BackendEnsureResult[]> {
  const results: BackendEnsureResult[] = [];

  for (const name of names) {
    results.push(await ensureBackendReady(name, input, dependencies));
  }

  return results;
}

async function resolveBackendLaunchSpec(
  name: BackendName,
  rootDir: string,
  statuses: BackendStatus[],
  defaults: ForgeDefaultsConfig,
  dependencies: BackendSupervisorDependencies,
): Promise<BackendLaunchSpec | null> {
  if (name === "comfyui") {
    const comfyStatus = statuses.find((entry) => entry.name === "comfyui") ?? null;
    const comfyRoot = comfyStatus?.available && comfyStatus.detectedPath
      ? comfyStatus.detectedPath
      : await resolveConfiguredBackendPath("comfyui", rootDir, dependencies);

    if (!comfyRoot) {
      return null;
    }

    const pythonPath = await resolvePythonExecutable(comfyRoot, statuses, dependencies);
    return {
      args: ["main.py", "--listen", "127.0.0.1", "--port", String(defaults.comfyui?.default_port ?? 8188)],
      command: pythonPath,
      cwd: comfyRoot,
      readyUrl: buildServiceReadyUrl(name, defaults),
    };
  }

  if (name === "ollama") {
    const ollamaStatus = statuses.find((entry) => entry.name === "ollama") ?? null;
    const executablePath = ollamaStatus?.available && ollamaStatus.detectedPath
      ? ollamaStatus.detectedPath
      : await resolveConfiguredBackendPath("ollama", rootDir, dependencies);

    if (!executablePath) {
      return null;
    }

    return {
      args: ["serve"],
      command: executablePath,
      cwd: path.dirname(executablePath),
      readyUrl: buildServiceReadyUrl(name, defaults),
    };
  }

  return null;
}

async function resolveConfiguredBackendPath(
  name: BackendName,
  rootDir: string,
  dependencies: BackendSupervisorDependencies,
): Promise<string | null> {
  const loadCatalog = dependencies.loadBackendPathCatalogFn ?? loadBackendPathCatalog;
  let catalog: BackendPathCatalog;

  try {
    catalog = await loadCatalog(rootDir);
  } catch {
    return null;
  }

  const candidates = catalog.backends[name]?.configured_paths ?? [];

  for (const candidate of candidates) {
    const expanded = expandConfiguredPath(candidate, dependencies.env ?? process.env);
    if (await (dependencies.pathExists ?? defaultPathExists)(expanded)) {
      return expanded;
    }
  }

  return null;
}

async function resolvePythonExecutable(
  comfyRoot: string,
  statuses: BackendStatus[],
  dependencies: BackendSupervisorDependencies,
): Promise<string> {
  const localCandidates = [
    path.join(comfyRoot, ".venv", "Scripts", "python.exe"),
    path.join(comfyRoot, ".venv", "bin", "python"),
  ];

  for (const candidate of localCandidates) {
    if (await (dependencies.pathExists ?? defaultPathExists)(candidate)) {
      return candidate;
    }
  }

  return statuses.find((entry) => entry.name === "python" && entry.available)?.detectedPath ?? "python";
}

function buildExecutableBackendResult(name: BackendName, status: BackendStatus | null): BackendEnsureResult {
  if (status?.available) {
    return {
      name,
      args: [],
      command: null,
      cwd: null,
      pid: null,
      ready: true,
      ready_url: null,
      reason: "Backend is available and requires no background service.",
      started: false,
      status: "ready",
    };
  }

  return {
    name,
    args: [],
    command: null,
    cwd: null,
    pid: null,
    ready: false,
    ready_url: null,
    reason: "Backend executable is missing.",
    started: false,
    status: "missing",
  };
}

function buildReadyUrl(name: BackendName, defaults: ForgeDefaultsConfig): string | null {
  if (name === "comfyui") {
    return `http://127.0.0.1:${defaults.comfyui?.default_port ?? 8188}/system_stats`;
  }

  if (name === "ollama") {
    return `http://127.0.0.1:${defaults.ollama?.default_port ?? 11434}/api/tags`;
  }

  return null;
}

function buildServiceReadyUrl(name: "comfyui" | "ollama", defaults: ForgeDefaultsConfig): string {
  return buildReadyUrl(name, defaults) ?? "http://127.0.0.1";
}

async function isBackendReady(
  readyUrl: string | null,
  fetchFn: BackendSupervisorDependencies["fetchFn"],
): Promise<boolean> {
  if (!readyUrl) {
    return false;
  }

  try {
    const response = await (fetchFn ?? fetch)(readyUrl, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

function buildMissingLaunchReason(name: BackendName): string {
  if (name === "comfyui") {
    return "Unable to resolve a configured path for ComfyUI.";
  }

  if (name === "ollama") {
    return "Unable to resolve an executable path for Ollama.";
  }

  return "Backend launch metadata is unavailable.";
}

function expandConfiguredPath(configuredPath: string, env: NodeJS.ProcessEnv): string {
  return configuredPath
    .replace(/%([^%]+)%/g, (_match, name: string) => env[name] ?? `%${name}%`)
    .replace(/\$([A-Z_]+)/gi, (_match, name: string) => env[name] ?? `$${name}`);
}

async function defaultPathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function defaultSpawnProcess(
  command: string,
  args: string[],
  options: BackendLaunchOptions,
): Promise<{ pid: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      detached: true,
      env: options.env,
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve({ pid: child.pid ?? null });
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
