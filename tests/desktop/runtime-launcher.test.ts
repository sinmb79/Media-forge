import * as assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import {
  buildDesktopBackendEnsurePlan,
  buildDesktopDashboardServerPlan,
  buildDesktopOpenClawBridgePlan,
  resolveDesktopRuntimePaths,
  resolveDesktopNodeExecutable,
} from "../../src/desktop/runtime-launcher.js";
import { createDesktopRuntimeManifest } from "../../src/desktop/runtime-manifest.js";

test("resolveDesktopRuntimePaths finds workspace dashboard standalone output", async () => {
  const rootDir = await makeTempRoot();
  const serverPath = path.join(rootDir, "dashboard", ".next", "standalone", "dashboard", "server.js");
  const engineCli = path.join(rootDir, "dist", "src", "cli", "index.js");
  const configPath = path.join(rootDir, "config", "defaults.yaml");

  await mkdir(path.dirname(serverPath), { recursive: true });
  await mkdir(path.dirname(engineCli), { recursive: true });
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(serverPath, "console.log('server');");
  await writeFile(engineCli, "console.log('engine');");
  await writeFile(configPath, "{}");

  const paths = await resolveDesktopRuntimePaths({
    packaged: false,
    rootDir,
  });

  assert.equal(paths.runtimeRoot, rootDir);
  assert.equal(paths.dashboardServerEntry, serverPath);
  assert.equal(paths.engineCliEntry, engineCli);
});

test("resolveDesktopRuntimePaths uses packaged resources when packaged", async () => {
  const resourcesPath = path.join(
    os.tmpdir(),
    `mediaforge-desktop-resources-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  const serverPath = path.join(resourcesPath, "dashboard", "server.js");
  const engineCli = path.join(resourcesPath, "engine", "src", "cli", "index.js");
  const configPath = path.join(resourcesPath, "config", "defaults.yaml");

  await mkdir(path.dirname(serverPath), { recursive: true });
  await mkdir(path.dirname(engineCli), { recursive: true });
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(serverPath, "console.log('server');");
  await writeFile(engineCli, "console.log('engine');");
  await writeFile(configPath, "{}");

  const paths = await resolveDesktopRuntimePaths({
    packaged: true,
    resourcesPath,
    rootDir: "C:\\Users\\sinmb\\workspace\\mediaforge",
  });

  assert.equal(paths.runtimeRoot, resourcesPath);
  assert.equal(paths.dashboardServerEntry, serverPath);
  assert.equal(paths.engineCliEntry, engineCli);
});

test("buildDesktopBackendEnsurePlan runs the bundled engine in node mode", async () => {
  const manifest = createDesktopRuntimeManifest({
    platform: "win32",
    rootDir: "C:\\Users\\sinmb\\workspace\\mediaforge",
  });
  const plan = buildDesktopBackendEnsurePlan(
    manifest,
    {
      dashboardServerEntry: "C:\\MediaForge\\dashboard\\server.js",
      engineCliEntry: "C:\\MediaForge\\engine\\src\\cli\\index.js",
      runtimeRoot: "C:\\MediaForge",
    },
    "comfyui",
    "MediaForge.exe",
  );

  assert.equal(plan.command, "MediaForge.exe");
  assert.ok(plan.args.includes("forge"));
  assert.ok(plan.args.includes("backend"));
  assert.ok(plan.args.includes("ensure"));
  assert.ok(plan.args.includes("comfyui"));
  assert.equal(plan.cwd, "C:\\MediaForge");
  assert.equal(plan.env.MEDIAFORGE_ROOT, "C:\\MediaForge");
  assert.equal(plan.env.ELECTRON_RUN_AS_NODE, "1");
});

test("buildDesktopDashboardServerPlan prepares a packaged Next standalone server", () => {
  const manifest = createDesktopRuntimeManifest({
    dashboardPort: 3400,
    platform: "win32",
    rootDir: "C:\\Users\\sinmb\\workspace\\mediaforge",
  });
  const plan = buildDesktopDashboardServerPlan(
    manifest,
    {
      dashboardServerEntry: "C:\\MediaForge\\dashboard\\server.js",
      engineCliEntry: "C:\\MediaForge\\engine\\src\\cli\\index.js",
      runtimeRoot: "C:\\MediaForge",
    },
    "MediaForge.exe",
  );

  assert.equal(plan.command, "MediaForge.exe");
  assert.deepEqual(plan.args, ["C:\\MediaForge\\dashboard\\server.js"]);
  assert.equal(plan.cwd, "C:\\MediaForge\\dashboard");
  assert.equal(plan.env.ELECTRON_RUN_AS_NODE, "1");
  assert.equal(plan.env.PORT, "3400");
  assert.equal(plan.env.HOSTNAME, "127.0.0.1");
  assert.equal(plan.url, "http://127.0.0.1:3400");
});

test("buildDesktopOpenClawBridgePlan prepares a local bridge process for agents", () => {
  const manifest = createDesktopRuntimeManifest({
    env: {
      MEDIAFORGE_OPENCLAW_PORT: "4319",
    },
    platform: "win32",
    rootDir: "C:\\Users\\sinmb\\workspace\\mediaforge",
  });
  const plan = buildDesktopOpenClawBridgePlan(
    manifest,
    {
      dashboardServerEntry: "C:\\MediaForge\\dashboard\\server.js",
      engineCliEntry: "C:\\MediaForge\\engine\\src\\cli\\index.js",
      runtimeRoot: "C:\\MediaForge",
    },
    "node.exe",
  );

  assert.equal(plan.command, "node.exe");
  assert.ok(plan.args.includes("agent"));
  assert.ok(plan.args.includes("openclaw"));
  assert.ok(plan.args.includes("serve"));
  assert.ok(plan.args.includes("--port"));
  assert.ok(plan.args.includes("4319"));
  assert.equal(plan.env.MEDIAFORGE_ROOT, "C:\\MediaForge");
  assert.equal(plan.url, "http://127.0.0.1:4319");
});

test("resolveDesktopNodeExecutable prefers a bundled Node runtime when packaged", async () => {
  const resourcesPath = path.join(
    os.tmpdir(),
    `mediaforge-desktop-node-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  const bundledNode = path.join(resourcesPath, "runtime", "node", "node.exe");

  await mkdir(path.dirname(bundledNode), { recursive: true });
  await writeFile(bundledNode, "");

  const executable = await resolveDesktopNodeExecutable({
    packaged: true,
    resourcesPath,
  });

  assert.equal(executable, bundledNode);
});

test("resolveDesktopNodeExecutable falls back to a system node executable when no bundle exists", async () => {
  const resourcesPath = path.join(
    os.tmpdir(),
    `mediaforge-desktop-node-missing-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  const executable = await resolveDesktopNodeExecutable({
    env: { Path: "C:\\Program Files\\nodejs" },
    packaged: true,
    resourcesPath,
    runCommand: async () => ({
      exitCode: 0,
      stderr: "",
      stdout: "C:\\Program Files\\nodejs\\node.exe\r\n",
    }),
  });

  assert.equal(executable, "C:\\Program Files\\nodejs\\node.exe");
});

async function makeTempRoot(): Promise<string> {
  const rootDir = path.resolve(
    os.tmpdir(),
    `mediaforge-desktop-root-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  await mkdir(rootDir, { recursive: true });
  return rootDir;
}
