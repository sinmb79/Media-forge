import { openDashboardInBrowser, startDashboardServer } from "../dashboard/server/create-dashboard-server.js";
import { EXIT_CODE_SUCCESS } from "./exit-codes.js";

export async function dashboardEngineCommand(options: {
  host?: string | null;
  json: boolean;
  open: boolean;
  port?: number | null;
}): Promise<{ exitCode: number; keepAlive?: boolean; output: string }> {
  const host = options.host?.trim() || "127.0.0.1";
  const port = Number.isFinite(options.port) && options.port ? options.port : 3210;
  const url = `http://${host}:${port}`;

  if (options.json) {
    return {
      exitCode: EXIT_CODE_SUCCESS,
      output: `${JSON.stringify({
        auto_open: options.open,
        command: "dashboard",
        host,
        port,
        schema_version: "0.1",
        status: "ready",
        url,
      }, null, 2)}\n`,
    };
  }

  const started = await startDashboardServer({
    host,
    port,
  });

  if (options.open) {
    openDashboardInBrowser(started.url);
  }

  return {
    exitCode: EXIT_CODE_SUCCESS,
    keepAlive: true,
    output: [
      "MediaForge dashboard is running.",
      `URL: ${started.url}`,
      "Press Ctrl+C to stop.",
    ].join("\n") + "\n",
  };
}
