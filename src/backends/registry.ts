import { access, readFile } from "node:fs/promises";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

import type {
  BackendCatalogEntry,
  BackendName,
  BackendPathCatalog,
  BackendStatus,
  CommandResult,
} from "./types.js";

export interface RegistryDependencies {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  pathExists(targetPath: string): Promise<boolean>;
  runCommand(command: string, args: string[]): Promise<CommandResult>;
}

const DEFAULT_DEPENDENCIES: RegistryDependencies = {
  platform: process.platform,
  env: process.env,
  pathExists: defaultPathExists,
  runCommand: defaultRunCommand,
};

export async function loadBackendPathCatalog(rootDir: string): Promise<BackendPathCatalog> {
  const filePath = path.resolve(rootDir, "config", "backend-paths.yaml");
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as BackendPathCatalog;
}

export async function inspectBackends(
  rootDir: string = process.cwd(),
  dependencies?: Partial<RegistryDependencies>,
): Promise<BackendStatus[]> {
  const catalog = await loadBackendPathCatalog(rootDir);
  return detectBackends(catalog, dependencies);
}

export async function detectBackends(
  catalog: BackendPathCatalog,
  dependencies?: Partial<RegistryDependencies>,
): Promise<BackendStatus[]> {
  const resolvedDependencies: RegistryDependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...dependencies,
  };

  const entries = Object.entries(catalog.backends) as Array<[BackendName, BackendCatalogEntry]>;
  const statuses: BackendStatus[] = [];

  for (const [name, entry] of entries) {
    const configuredPath = await detectConfiguredPath(entry, resolvedDependencies);
    if (configuredPath) {
      statuses.push({
        name,
        available: true,
        detectedPath: configuredPath,
        version: null,
        installGuideUrl: entry.install_guide_url,
        source: "config",
      });
      continue;
    }

    const executable = await findExecutable(entry, resolvedDependencies);
    if (executable) {
      statuses.push({
        name,
        available: true,
        detectedPath: executable,
        version: await resolveVersion(executable, entry, resolvedDependencies),
        installGuideUrl: entry.install_guide_url,
        source: "path",
      });
      continue;
    }

    statuses.push({
      name,
      available: false,
      detectedPath: null,
      version: null,
      installGuideUrl: entry.install_guide_url,
      source: "missing",
    });
  }

  return statuses;
}

async function detectConfiguredPath(
  entry: BackendCatalogEntry,
  dependencies: RegistryDependencies,
): Promise<string | null> {
  const candidates = entry.configured_paths ?? [];

  for (const configuredPath of candidates) {
    const expandedPath = expandConfiguredPath(configuredPath, dependencies.env);

    if (!await dependencies.pathExists(expandedPath)) {
      continue;
    }

    if (!entry.entry_file) {
      return expandedPath;
    }

    const entryPath = path.join(expandedPath, entry.entry_file);
    if (await dependencies.pathExists(entryPath)) {
      return expandedPath;
    }
  }

  return null;
}

async function findExecutable(
  entry: BackendCatalogEntry,
  dependencies: RegistryDependencies,
): Promise<string | null> {
  const executableNames = entry.executables ?? [];
  const locator = dependencies.platform === "win32" ? "where" : "which";

  for (const executableName of executableNames) {
    const result = await dependencies.runCommand(locator, [executableName]);

    if (result.exitCode !== 0) {
      continue;
    }

    const firstMatch = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    if (firstMatch) {
      return firstMatch;
    }
  }

  return null;
}

async function resolveVersion(
  executablePath: string,
  entry: BackendCatalogEntry,
  dependencies: RegistryDependencies,
): Promise<string | null> {
  if (!entry.version_args || entry.version_args.length === 0) {
    return null;
  }

  const result = await dependencies.runCommand(executablePath, entry.version_args);
  if (result.exitCode !== 0) {
    return null;
  }

  const versionLine = `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return versionLine ?? null;
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

async function defaultRunCommand(command: string, args: string[]): Promise<CommandResult> {
  const result = spawnSync(command, args, {
    encoding: "utf8",
  });

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}
