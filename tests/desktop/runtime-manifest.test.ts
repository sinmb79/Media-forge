import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildDesktopDashboardLaunchPlan,
  createDesktopRuntimeManifest,
  resolveBundledBinaryPath,
} from "../../src/desktop/runtime-manifest.js";

test("createDesktopRuntimeManifest exposes Windows installer defaults", () => {
  const manifest = createDesktopRuntimeManifest({
    platform: "win32",
    rootDir: "C:\\Users\\sinmb\\workspace\\mediaforge",
  });

  assert.equal(manifest.app_name, "MediaForge");
  assert.equal(manifest.executable_name, "MediaForge.exe");
  assert.equal(manifest.installer_name, "MediaForge-Setup.exe");
  assert.equal(manifest.install_dir, "C:\\MediaForge");
  assert.equal(manifest.dashboard.url, "http://127.0.0.1:3210");
  assert.deepEqual(manifest.auto_start_backends, ["comfyui", "ollama", "ffmpeg"]);
  assert.ok(manifest.models.required.some((model) => model.id === "sdxl-base"));
  assert.ok(manifest.backends.comfyui.auto_start);
});

test("resolveBundledBinaryPath joins install dir with backend relative path", () => {
  const manifest = createDesktopRuntimeManifest({
    installDir: "D:\\Apps\\MediaForge",
    platform: "win32",
    rootDir: "C:\\Users\\sinmb\\workspace\\mediaforge",
  });

  assert.equal(
    resolveBundledBinaryPath(manifest, "ffmpeg"),
    "D:\\Apps\\MediaForge\\engines\\ffmpeg\\bin\\ffmpeg.exe",
  );
});

test("buildDesktopDashboardLaunchPlan points at the compiled engine CLI", () => {
  const manifest = createDesktopRuntimeManifest({
    platform: "win32",
    rootDir: "C:\\Users\\sinmb\\workspace\\mediaforge",
  });

  const plan = buildDesktopDashboardLaunchPlan(manifest, {
    nodeExecutable: "node.exe",
  });

  assert.equal(plan.command, "node.exe");
  assert.ok(plan.args.includes("dashboard"));
  assert.ok(plan.args.includes("--host"));
  assert.ok(plan.args.includes("--port"));
  assert.ok(plan.args.some((value) => value.endsWith("dist\\src\\cli\\index.js")));
  assert.equal(plan.cwd, "C:\\Users\\sinmb\\workspace\\mediaforge");
});

test("createDesktopRuntimeManifest honors dashboard host and port overrides from env-like input", () => {
  const manifest = createDesktopRuntimeManifest({
    env: {
      MEDIAFORGE_DASHBOARD_HOST: "127.0.0.1",
      MEDIAFORGE_DASHBOARD_PORT: "3321",
      MEDIAFORGE_OPENCLAW_PORT: "4319",
    },
    platform: "win32",
    rootDir: "C:\\Users\\sinmb\\workspace\\mediaforge",
  });

  assert.equal(manifest.dashboard.port, 3321);
  assert.equal(manifest.dashboard.url, "http://127.0.0.1:3321");
  assert.equal(manifest.openclaw.port, 4319);
  assert.equal(manifest.openclaw.url, "http://127.0.0.1:4319");
});
