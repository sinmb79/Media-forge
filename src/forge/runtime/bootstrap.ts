import { ensureBackendsReady, type BackendEnsureResult } from "../../backends/supervisor.js";
import type { BackendName } from "../../backends/types.js";
import { startDashboardServer, type StartedDashboardServer } from "../../dashboard/server/create-dashboard-server.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export interface RuntimeBootstrapOptions {
  rootDir?: string;
  ensureBackends?: BackendName[];
  dashboard?: {
    enabled?: boolean;
    host?: string;
    port?: number;
  };
}

export interface RuntimeDashboardState {
  enabled: boolean;
  host: string | null;
  port: number | null;
  reason: string | null;
  status: "disabled" | "failed" | "started";
  url: string | null;
}

export interface RuntimeBootstrapResult {
  backend_summary: {
    ready_count: number;
    requested_backends: BackendName[];
    results: BackendEnsureResult[];
    started_count: number;
    total_count: number;
  };
  dashboard: RuntimeDashboardState;
  dashboard_handle?: StartedDashboardServer;
  root_dir: string;
  status: "partial" | "ready";
}

export interface RuntimeBootstrapDependencies {
  ensureBackendsReadyFn?: typeof ensureBackendsReady;
  startDashboardServerFn?: typeof startDashboardServer;
}

export async function bootstrapMediaForgeRuntime(
  input: RuntimeBootstrapOptions = {},
  dependencies: RuntimeBootstrapDependencies = {},
): Promise<RuntimeBootstrapResult> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const requestedBackends = input.ensureBackends ?? ["comfyui", "ollama", "ffmpeg"];
  const backendResults = await (dependencies.ensureBackendsReadyFn ?? ensureBackendsReady)(requestedBackends, {
    rootDir,
  });
  const readyCount = backendResults.filter((result) => result.ready).length;
  const startedCount = backendResults.filter((result) => result.started).length;
  const dashboardEnabled = input.dashboard?.enabled ?? false;

  let dashboard: RuntimeDashboardState = {
    enabled: dashboardEnabled,
    host: null,
    port: null,
    reason: dashboardEnabled ? "Dashboard startup was not attempted." : null,
    status: dashboardEnabled ? "failed" : "disabled",
    url: null,
  };
  let dashboardHandle: StartedDashboardServer | undefined;

  if (dashboardEnabled) {
    try {
      dashboardHandle = await (dependencies.startDashboardServerFn ?? startDashboardServer)({
        ...(input.dashboard?.host ? { host: input.dashboard.host } : {}),
        ...(input.dashboard?.port ? { port: input.dashboard.port } : {}),
        rootDir,
      });
      dashboard = {
        enabled: true,
        host: dashboardHandle.host,
        port: dashboardHandle.port,
        reason: null,
        status: "started",
        url: dashboardHandle.url,
      };
    } catch (error) {
      dashboard = {
        enabled: true,
        host: input.dashboard?.host ?? null,
        port: input.dashboard?.port ?? null,
        reason: error instanceof Error ? error.message : "Failed to start dashboard.",
        status: "failed",
        url: null,
      };
    }
  }

  return {
    backend_summary: {
      ready_count: readyCount,
      requested_backends: requestedBackends,
      results: backendResults,
      started_count: startedCount,
      total_count: backendResults.length,
    },
    dashboard,
    ...(dashboardHandle ? { dashboard_handle: dashboardHandle } : {}),
    root_dir: rootDir,
    status: readyCount === backendResults.length ? "ready" : "partial",
  };
}
