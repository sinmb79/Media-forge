import { openDashboardInBrowser, startDashboardServer } from "../dashboard/server/create-dashboard-server.js";
import { bootstrapMediaForgeRuntime } from "../forge/runtime/bootstrap.js";
import { EXIT_CODE_SUCCESS } from "./exit-codes.js";

export async function dashboardEngineCommand(options: {
  host?: string | null;
  json: boolean;
  open: boolean;
  port?: number | null;
}, dependencies: {
  bootstrapRuntime?: typeof bootstrapMediaForgeRuntime;
  openInBrowser?: typeof openDashboardInBrowser;
} = {}): Promise<{ exitCode: number; keepAlive?: boolean; output: string }> {
  const host = options.host?.trim() || "127.0.0.1";
  const port = Number.isFinite(options.port) && options.port ? options.port : 3210;
  const url = `http://${host}:${port}`;
  const bootstrapRuntime = dependencies.bootstrapRuntime ?? bootstrapMediaForgeRuntime;

  if (options.json) {
    const runtime = await bootstrapRuntime({
      dashboard: {
        enabled: false,
        host,
        port,
      },
    });
    return {
      exitCode: EXIT_CODE_SUCCESS,
      output: `${JSON.stringify({
        auto_open: options.open,
        backend_summary: runtime.backend_summary,
        command: "dashboard",
        dashboard: runtime.dashboard,
        host,
        port,
        schema_version: "0.1",
        status: runtime.status,
        url,
      }, null, 2)}\n`,
    };
  }

  const runtime = await bootstrapRuntime({
    dashboard: {
      enabled: true,
      host,
      port,
    },
  });

  if (runtime.dashboard.status !== "started" || !runtime.dashboard.url) {
    return {
      exitCode: 1,
      output: [
        "MediaForge dashboard failed to start.",
        runtime.dashboard.reason ? `Reason: ${runtime.dashboard.reason}` : null,
      ].filter(Boolean).join("\n") + "\n",
    };
  }

  if (options.open) {
    (dependencies.openInBrowser ?? openDashboardInBrowser)(runtime.dashboard.url);
  }

  return {
    exitCode: EXIT_CODE_SUCCESS,
    keepAlive: true,
    output: [
      "MediaForge dashboard is running.",
      `URL: ${runtime.dashboard.url}`,
      `Backends ready: ${runtime.backend_summary.ready_count}/${runtime.backend_summary.total_count}`,
      "Press Ctrl+C to stop.",
    ].join("\n") + "\n",
  };
}
