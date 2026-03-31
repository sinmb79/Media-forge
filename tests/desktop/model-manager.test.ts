import * as assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import { DesktopModelManager } from "../../desktop/main/model-manager.js";
import { createDesktopRuntimeManifest } from "../../src/desktop/runtime-manifest.js";

test("DesktopModelManager reports installed and missing required models from the models directory", async () => {
  const installDir = makeTempInstallDir();
  const manifest = createDesktopRuntimeManifest({
    installDir,
    platform: "win32",
    rootDir: "C:\\Users\\sinmb\\workspace\\mediaforge",
  });
  const sdxlPath = path.join(
    manifest.paths.models_dir,
    "checkpoints",
    "sd_xl_base_1.0.safetensors",
  );

  await mkdir(path.dirname(sdxlPath), { recursive: true });
  await writeFile(sdxlPath, "placeholder");

  const manager = new DesktopModelManager({ manifest });
  const catalog = await manager.getCatalog();
  const requiredStatus = await manager.getRequiredModelStatus();

  assert.equal(catalog.find((model) => model.id === "sdxl-base")?.installed, true);
  assert.equal(catalog.find((model) => model.id === "wan22-q4")?.installed, false);
  assert.equal(requiredStatus.completed, false);
  assert.deepEqual(requiredStatus.installed_ids, ["sdxl-base"]);
  assert.deepEqual(requiredStatus.missing_ids, ["wan22-q4"]);
});

function makeTempInstallDir(): string {
  return path.join(
    os.tmpdir(),
    `mediaforge-install-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
}
