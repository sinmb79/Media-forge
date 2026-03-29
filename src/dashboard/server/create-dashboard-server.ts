import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createDashboardRouter } from "./dashboard-router.js";
import { DashboardActionService } from "../services/dashboard-action-service.js";
import { DashboardHealthService } from "../services/dashboard-health-service.js";
import { DashboardJobQueue } from "../services/dashboard-job-queue.js";
import { DashboardOutputStore } from "../services/dashboard-output-store.js";

export interface StartDashboardServerOptions {
  rootDir?: string;
  host?: string;
  port?: number;
  actionService?: DashboardActionService;
  healthService?: DashboardHealthService;
  jobQueue?: DashboardJobQueue;
  outputStore?: DashboardOutputStore;
}

export interface StartedDashboardServer {
  server: Server;
  host: string;
  port: number;
  rootDir: string;
  url: string;
  close(): Promise<void>;
}

export async function startDashboardServer(
  options: StartDashboardServerOptions = {},
): Promise<StartedDashboardServer> {
  const rootDir = options.rootDir ?? process.cwd();
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 3210;
  const jobQueue = options.jobQueue ?? new DashboardJobQueue();
  const outputStore = options.outputStore ?? new DashboardOutputStore(rootDir);
  const healthService = options.healthService ?? new DashboardHealthService(rootDir);
  const actionService = options.actionService ?? new DashboardActionService(jobQueue, rootDir);

  const server = createServer(createDashboardRouter({
    rootDir,
    actionService,
    healthService,
    jobQueue,
    outputStore,
  }));

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo | null;
  const resolvedPort = address?.port ?? port;
  const resolvedHost = address?.address && address.address !== "::" ? address.address : host;
  const url = `http://${resolvedHost}:${resolvedPort}`;

  return {
    server,
    host: resolvedHost,
    port: resolvedPort,
    rootDir,
    url,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

export function openDashboardInBrowser(url: string): void {
  if (process.platform === "win32") {
    const child = spawn("cmd", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return;
  }

  if (process.platform === "darwin") {
    const child = spawn("open", [url], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return;
  }

  const child = spawn("xdg-open", [url], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
