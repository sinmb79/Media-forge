import path from "node:path";

import { loadDesktopSetupSnapshot } from "../../../dist/desktop/main/setup-wizard.js";
import { createDesktopRuntimeManifest } from "../../../dist/src/desktop/runtime-manifest.js";

export async function loadSetupSnapshotForDashboard() {
  const rootDir = path.resolve(process.cwd(), "..");
  const manifest = createDesktopRuntimeManifest({ rootDir });

  return loadDesktopSetupSnapshot({ manifest });
}
