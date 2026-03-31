import path from "node:path";

import { DashboardActionService } from "../../../dist/src/dashboard/services/dashboard-action-service.js";
import { DashboardHealthService } from "../../../dist/src/dashboard/services/dashboard-health-service.js";
import { DashboardJobQueue } from "../../../dist/src/dashboard/services/dashboard-job-queue.js";
import { DashboardOutputStore } from "../../../dist/src/dashboard/services/dashboard-output-store.js";

const rootDir = path.resolve(process.cwd(), "..");

export interface MediaForgeRuntime {
  actionService: DashboardActionService;
  healthService: DashboardHealthService;
  jobQueue: DashboardJobQueue;
  outputStore: DashboardOutputStore;
  rootDir: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __mediaforgeRuntime__: MediaForgeRuntime | undefined;
}

export function getMediaForgeRuntime(): MediaForgeRuntime {
  if (!globalThis.__mediaforgeRuntime__) {
    const jobQueue = new DashboardJobQueue();
    const outputStore = new DashboardOutputStore(rootDir);
    const healthService = new DashboardHealthService(rootDir);
    const actionService = new DashboardActionService(jobQueue, rootDir);

    globalThis.__mediaforgeRuntime__ = {
      actionService,
      healthService,
      jobQueue,
      outputStore,
      rootDir,
    };
  }

  return globalThis.__mediaforgeRuntime__;
}
