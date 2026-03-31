import { access } from "node:fs/promises";
import * as path from "node:path";

import type { BackendName, CommandResult } from "../backends/types.js";
import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";
import type { DesktopDashboardLaunchPlan, DesktopRuntimeManifest } from "./runtime-manifest.js";

export interface DesktopResolvedRuntimePaths {
  dashboardServerEntry: string;
  engineCliEntry: string;
  runtimeRoot: string;
}

export interface DesktopNodeLaunchPlan extends DesktopDashboardLaunchPlan {
  env: NodeJS.ProcessEnv;
}

export async function resolveDesktopNodeExecutable(input: {
  env?: NodeJS.ProcessEnv;
  packaged: boolean;
  resourcesPath?: string;
  runCommand?: (command: string, args: string[]) => Promise<CommandResult>;
}): Promise<string> {
  const runtimeRoot = input.packaged
    ? path.resolve(input.resourcesPath ?? path.resolve(path.dirname(process.execPath), "resources"))
    : resolveMediaForgeRoot();
  const bundledNodePath = path.join(
    runtimeRoot,
    "runtime",
    "node",
    process.platform === "win32" ? "node.exe" : path.join("bin", "node"),
  );

  if (await pathExists(bundledNodePath)) {
    return bundledNodePath;
  }

  const locateCommand = process.platform === "win32" ? "where" : "which";
  const locateNode = input.runCommand ?? defaultRunCommand;
  const env = input.env ?? process.env;
  const result = await locateNode(locateCommand, ["node"]);
  if (result.exitCode === 0) {
    const executable = result.stdout
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find((value) => value.length > 0);

    if (executable) {
      return executable;
    }
  }

  if (env.npm_node_execpath) {
    return env.npm_node_execpath;
  }

  return process.execPath;
}

export async function resolveDesktopRuntimePaths(input: {
  packaged: boolean;
  resourcesPath?: string;
  rootDir?: string;
}): Promise<DesktopResolvedRuntimePaths> {
  const runtimeRoot = input.packaged
    ? path.resolve(input.resourcesPath ?? path.resolve(path.dirname(process.execPath), "resources"))
    : resolveMediaForgeRoot(input.rootDir ?? process.cwd());

  const dashboardServerEntry = await resolveFirstExistingPath(
    input.packaged
      ? [
        path.join(runtimeRoot, "dashboard", "server.js"),
        path.join(runtimeRoot, "dashboard-standalone", "server.js"),
      ]
      : [
        path.join(runtimeRoot, "dashboard", ".next", "standalone", "server.js"),
        path.join(runtimeRoot, "dashboard", ".next", "standalone", "dashboard", "server.js"),
      ],
    "Unable to resolve a built dashboard server entry.",
  );
  const engineCliEntry = await resolveFirstExistingPath(
    input.packaged
      ? [
        path.join(runtimeRoot, "engine", "src", "cli", "index.js"),
      ]
      : [
        path.join(runtimeRoot, "dist", "src", "cli", "index.js"),
      ],
    "Unable to resolve the MediaForge engine CLI entry.",
  );

  return {
    dashboardServerEntry,
    engineCliEntry,
    runtimeRoot,
  };
}

export function buildDesktopBackendEnsurePlan(
  manifest: DesktopRuntimeManifest,
  paths: DesktopResolvedRuntimePaths,
  backend: BackendName,
  electronExecutable: string = process.execPath,
): DesktopNodeLaunchPlan {
  return {
    args: [
      paths.engineCliEntry,
      "forge",
      "backend",
      "ensure",
      backend,
      "--json",
    ],
    command: electronExecutable,
    cwd: paths.runtimeRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      MEDIAFORGE_ROOT: paths.runtimeRoot,
    },
    url: manifest.dashboard.url,
  };
}

export function buildDesktopDashboardServerPlan(
  manifest: DesktopRuntimeManifest,
  paths: DesktopResolvedRuntimePaths,
  electronExecutable: string = process.execPath,
): DesktopNodeLaunchPlan {
  return {
    args: [paths.dashboardServerEntry],
    command: electronExecutable,
    cwd: path.dirname(paths.dashboardServerEntry),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: manifest.dashboard.host,
      MEDIAFORGE_ROOT: paths.runtimeRoot,
      PORT: String(manifest.dashboard.port),
    },
    url: manifest.dashboard.url,
  };
}

export function buildDesktopOpenClawBridgePlan(
  manifest: DesktopRuntimeManifest,
  paths: DesktopResolvedRuntimePaths,
  electronExecutable: string = process.execPath,
): DesktopNodeLaunchPlan {
  return {
    args: [
      paths.engineCliEntry,
      "forge",
      "agent",
      "openclaw",
      "serve",
      "--host",
      manifest.openclaw.host,
      "--port",
      String(manifest.openclaw.port),
    ],
    command: electronExecutable,
    cwd: paths.runtimeRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      MEDIAFORGE_ROOT: paths.runtimeRoot,
    },
    url: manifest.openclaw.url,
  };
}

async function resolveFirstExistingPath(
  candidates: string[],
  failureMessage: string,
): Promise<string> {
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(failureMessage);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function defaultRunCommand(command: string, args: string[]): Promise<CommandResult> {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(command, args, {
    encoding: "utf8",
  });

  return {
    exitCode: result.status ?? 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}
