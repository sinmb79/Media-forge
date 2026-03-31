import path from "node:path";

import { inspectOpenClawBridge } from "../../../dist/src/forge/agent/openclaw-bridge.js";

export async function loadOpenClawSnapshotForDashboard() {
  const rootDir = path.resolve(process.cwd(), "..");
  return inspectOpenClawBridge({ rootDir });
}
