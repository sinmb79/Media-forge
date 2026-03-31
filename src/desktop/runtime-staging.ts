import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import {
  inspectBackends,
  loadBackendPathCatalog,
} from "../backends/registry.js";
import type {
  BackendName,
  BackendPathCatalog,
  BackendStatus,
} from "../backends/types.js";
import {
  loadForgeDefaults,
  type ForgeDefaultsConfig,
} from "../forge/config/load-forge-defaults.js";
import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";
import {
  createDesktopRuntimeManifest,
  type DesktopRuntimeManifest,
} from "./runtime-manifest.js";
import { resolveDesktopNodeExecutable } from "./runtime-launcher.js";

export interface DesktopStagedBackendOverride {
  configured_path: string | null;
  name: BackendName;
  staged: boolean;
}

export interface DesktopRuntimeStageSnapshot {
  backend_config_path: string;
  backend_config_staged: boolean;
  backend_overrides: DesktopStagedBackendOverride[];
  default_ollama_model: string;
  node_runtime_path: string;
  node_runtime_staged: boolean;
  openclaw_profile_path: string;
  openclaw_profile_staged: boolean;
  openclaw_url: string;
  ready: boolean;
  root_dir: string;
  schema_version: "0.1";
  stage_dir: string;
}

export interface DesktopRuntimeStageInput {
  rootDir?: string;
  stageDir?: string;
}

export interface DesktopRuntimeStageDependencies {
  env?: NodeJS.ProcessEnv;
  inspectBackendsFn?: typeof inspectBackends;
  installedOllamaModels?: () => Promise<string[]>;
  loadBackendPathCatalogFn?: typeof loadBackendPathCatalog;
  loadForgeDefaultsFn?: typeof loadForgeDefaults;
  resolveNodeExecutableFn?: typeof resolveDesktopNodeExecutable;
}

export async function loadDesktopRuntimeStageSnapshot(
  input: DesktopRuntimeStageInput = {},
  dependencies: DesktopRuntimeStageDependencies = {},
): Promise<DesktopRuntimeStageSnapshot> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const stageDir = path.resolve(input.stageDir ?? path.join(rootDir, "desktop", "stage"));
  const manifest = createDesktopRuntimeManifest({
    env: dependencies.env ?? process.env,
    rootDir,
  });
  const backendConfigPath = path.join(stageDir, "config", "backend-paths.yaml");
  const defaultsPath = path.join(stageDir, "config", "defaults.yaml");
  const nodeRuntimePath = path.join(
    stageDir,
    "runtime",
    "node",
    process.platform === "win32" ? "node.exe" : "node",
  );
  const openclawProfilePath = path.join(stageDir, "openclaw", "bridge.json");
  const [backendConfigStaged, nodeRuntimeStaged, openclawProfileStaged] = await Promise.all([
    pathExists(backendConfigPath),
    pathExists(nodeRuntimePath),
    pathExists(openclawProfilePath),
  ]);

  const backendOverrides = backendConfigStaged
    ? await readBackendOverrides(backendConfigPath)
    : [];
  const defaultOllamaModel = await readDefaultOllamaModel(defaultsPath, rootDir);

  return {
    backend_config_path: backendConfigPath,
    backend_config_staged: backendConfigStaged,
    backend_overrides: backendOverrides,
    default_ollama_model: defaultOllamaModel,
    node_runtime_path: nodeRuntimePath,
    node_runtime_staged: nodeRuntimeStaged,
    openclaw_profile_path: openclawProfilePath,
    openclaw_profile_staged: openclawProfileStaged,
    openclaw_url: manifest.openclaw.url,
    ready: backendConfigStaged && nodeRuntimeStaged && openclawProfileStaged,
    root_dir: rootDir,
    schema_version: "0.1",
    stage_dir: stageDir,
  };
}

export async function stageDesktopLocalRuntime(
  input: DesktopRuntimeStageInput = {},
  dependencies: DesktopRuntimeStageDependencies = {},
): Promise<DesktopRuntimeStageSnapshot> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const stageDir = path.resolve(input.stageDir ?? path.join(rootDir, "desktop", "stage"));
  const manifest = createDesktopRuntimeManifest({
    env: dependencies.env ?? process.env,
    rootDir,
  });
  const inspectBackendsFn = dependencies.inspectBackendsFn ?? inspectBackends;
  const loadCatalog = dependencies.loadBackendPathCatalogFn ?? loadBackendPathCatalog;
  const loadDefaultsFn = dependencies.loadForgeDefaultsFn ?? loadForgeDefaults;
  const resolveNodeExecutableFn = dependencies.resolveNodeExecutableFn ?? resolveDesktopNodeExecutable;
  const [statuses, catalog, defaults, nodeExecutable] = await Promise.all([
    inspectBackendsFn(rootDir),
    loadCatalog(rootDir),
    loadDefaultsFn(rootDir).catch(() => ({} as ForgeDefaultsConfig)),
    resolveNodeExecutableFn({
      env: dependencies.env ?? process.env,
      packaged: false,
    }),
  ]);
  const installedModels = await readInstalledOllamaModels(
    statuses.some((status) => status.name === "ollama" && status.available),
    dependencies.installedOllamaModels,
  );
  const resolvedDefaultModel = resolveDefaultOllamaModel(
    defaults.ollama?.default_model,
    installedModels,
  );
  const stagedCatalog = buildStagedBackendCatalog(catalog, statuses);
  const stagedDefaults = buildStagedDefaults(defaults, resolvedDefaultModel);
  const runtimeNodeTarget = path.join(
    stageDir,
    "runtime",
    "node",
    process.platform === "win32" ? "node.exe" : "node",
  );
  const backendConfigTarget = path.join(stageDir, "config", "backend-paths.yaml");
  const defaultsTarget = path.join(stageDir, "config", "defaults.yaml");
  const openclawTarget = path.join(stageDir, "openclaw", "bridge.json");

  await mkdir(path.dirname(runtimeNodeTarget), { recursive: true });
  await mkdir(path.dirname(backendConfigTarget), { recursive: true });
  await mkdir(path.dirname(openclawTarget), { recursive: true });
  await cp(nodeExecutable, runtimeNodeTarget, { force: true, recursive: false });
  await writeFile(backendConfigTarget, `${JSON.stringify(stagedCatalog, null, 2)}\n`, "utf8");
  await writeFile(defaultsTarget, `${JSON.stringify(stagedDefaults, null, 2)}\n`, "utf8");
  await writeFile(openclawTarget, `${JSON.stringify(buildOpenClawStageProfile(manifest), null, 2)}\n`, "utf8");

  return loadDesktopRuntimeStageSnapshot({ rootDir, stageDir }, dependencies);
}

async function readBackendOverrides(
  backendConfigPath: string,
): Promise<DesktopStagedBackendOverride[]> {
  try {
    const parsed = JSON.parse(await readFile(backendConfigPath, "utf8")) as BackendPathCatalog;
    return (Object.entries(parsed.backends) as Array<[BackendName, BackendPathCatalog["backends"][BackendName]]>)
      .map(([name, entry]) => ({
        configured_path: entry.configured_paths?.[0] ?? null,
        name,
        staged: Boolean(entry.configured_paths?.[0]),
      }));
  } catch {
    return [];
  }
}

async function readDefaultOllamaModel(
  stagedDefaultsPath: string,
  rootDir: string,
): Promise<string> {
  const targetPath = await pathExists(stagedDefaultsPath)
    ? stagedDefaultsPath
    : path.resolve(rootDir, "config", "defaults.yaml");

  try {
    const parsed = JSON.parse(await readFile(targetPath, "utf8")) as ForgeDefaultsConfig;
    return parsed.ollama?.default_model ?? "qwen3:14b";
  } catch {
    return "qwen3:14b";
  }
}

function buildStagedBackendCatalog(
  catalog: BackendPathCatalog,
  statuses: BackendStatus[],
): BackendPathCatalog {
  const stagedCatalog: BackendPathCatalog = {
    backends: { ...catalog.backends },
  };

  for (const status of statuses) {
    const entry = stagedCatalog.backends[status.name];
    if (!entry) {
      continue;
    }

    const configuredPaths = entry.configured_paths ?? [];
    const overridePath = status.available ? status.detectedPath : null;
    entry.configured_paths = [
      ...(overridePath ? [overridePath] : []),
      ...configuredPaths.filter((configuredPath) => configuredPath !== overridePath),
    ];
  }

  return stagedCatalog;
}

function buildStagedDefaults(
  defaults: ForgeDefaultsConfig,
  defaultOllamaModel: string,
): ForgeDefaultsConfig {
  return {
    ...defaults,
    ollama: {
      ...defaults.ollama,
      default_model: defaultOllamaModel,
    },
  };
}

function buildOpenClawStageProfile(
  manifest: DesktopRuntimeManifest,
): Record<string, unknown> {
  return {
    auto_start: true,
    host: manifest.openclaw.host,
    name: "openclaw",
    port: manifest.openclaw.port,
    protocol: "rest-json",
    schema_version: "0.1",
    url: manifest.openclaw.url,
  };
}

async function readInstalledOllamaModels(
  ollamaAvailable: boolean,
  override?: DesktopRuntimeStageDependencies["installedOllamaModels"],
): Promise<string[]> {
  if (override) {
    return override();
  }

  if (!ollamaAvailable) {
    return [];
  }

  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      method: "GET",
    });
    if (!response.ok) {
      return [];
    }

    const payload = await response.json() as {
      models?: Array<{ model?: string; name?: string }>;
    };

    return payload.models
      ?.map((model) => model.name ?? model.model ?? "")
      .filter((value) => value.length > 0)
      ?? [];
  } catch {
    return [];
  }
}

function resolveDefaultOllamaModel(
  configuredModel: string | undefined,
  installedModels: string[],
): string {
  if (configuredModel && installedModels.includes(configuredModel)) {
    return configuredModel;
  }

  if (installedModels.length > 0) {
    return installedModels[0] ?? "qwen3:14b";
  }

  return configuredModel ?? "qwen3:14b";
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
