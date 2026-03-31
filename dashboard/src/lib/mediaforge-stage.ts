import path from "node:path";

import {
  loadDesktopRuntimeStageSnapshot,
  stageDesktopLocalRuntime,
} from "../../../dist/src/desktop/runtime-staging.js";

export async function loadRuntimeStageSnapshotForDashboard() {
  const rootDir = path.resolve(process.cwd(), "..");
  return loadDesktopRuntimeStageSnapshot({ rootDir });
}

export async function stageLocalRuntimeForDashboard() {
  const rootDir = path.resolve(process.cwd(), "..");
  return stageDesktopLocalRuntime({ rootDir });
}
