import * as assert from "node:assert/strict";
import { test } from "node:test";

import { ensureBackendReady } from "../../src/backends/supervisor.js";
import type { BackendStatus } from "../../src/backends/types.js";
import type { ForgeDefaultsConfig } from "../../src/forge/config/load-forge-defaults.js";

function createStatus(overrides: Partial<BackendStatus> & Pick<BackendStatus, "name">): BackendStatus {
  return {
    available: false,
    detectedPath: null,
    installGuideUrl: "https://example.com/install",
    source: "missing",
    version: null,
    ...overrides,
  };
}

test("ensureBackendReady reports a running service without spawning", async () => {
  let spawnCalls = 0;
  const defaults: ForgeDefaultsConfig = {
    comfyui: {
      default_port: 8188,
    },
  };

  const result = await ensureBackendReady("comfyui", {
    rootDir: "C:/workspace/mediaforge",
  }, {
    fetchFn: async () => new Response("{}", { status: 200 }),
    inspectBackendsFn: async () => [
      createStatus({
        available: true,
        detectedPath: "C:/Users/test/ComfyUI",
        name: "comfyui",
        source: "config",
      }),
      createStatus({
        available: true,
        detectedPath: "C:/Python312/python.exe",
        name: "python",
        source: "path",
      }),
    ],
    loadForgeDefaultsFn: async () => defaults,
    sleepFn: async () => undefined,
    spawnProcess: async () => {
      spawnCalls += 1;
      return { pid: 101 };
    },
  });

  assert.equal(result.ready, true);
  assert.equal(result.started, false);
  assert.equal(result.status, "ready");
  assert.equal(result.ready_url, "http://127.0.0.1:8188/system_stats");
  assert.equal(spawnCalls, 0);
});

test("ensureBackendReady starts ComfyUI through its local venv python", async () => {
  const defaults: ForgeDefaultsConfig = {
    comfyui: {
      default_port: 8188,
    },
  };
  const spawnRequests: Array<{ args: string[]; command: string; cwd?: string }> = [];
  let fetchAttempts = 0;

  const result = await ensureBackendReady("comfyui", {
    rootDir: "C:/workspace/mediaforge",
  }, {
    fetchFn: async () => {
      fetchAttempts += 1;
      if (fetchAttempts < 3) {
        throw new Error("connect ECONNREFUSED");
      }

      return new Response("{}", { status: 200 });
    },
    inspectBackendsFn: async () => [
      createStatus({
        available: true,
        detectedPath: "C:/Tools/ComfyUI",
        name: "comfyui",
        source: "config",
      }),
      createStatus({
        available: true,
        detectedPath: "C:/Python312/python.exe",
        name: "python",
        source: "path",
      }),
    ],
    loadForgeDefaultsFn: async () => defaults,
    pathExists: async (targetPath) => {
      return targetPath.replace(/\\/g, "/") === "C:/Tools/ComfyUI/.venv/Scripts/python.exe";
    },
    sleepFn: async () => undefined,
    spawnProcess: async (command, args, options) => {
      spawnRequests.push({ args, command, ...(options.cwd ? { cwd: options.cwd } : {}) });
      return { pid: 4321 };
    },
  });

  assert.equal(result.ready, true);
  assert.equal(result.started, true);
  assert.equal(result.status, "started");
  assert.equal(result.pid, 4321);
  assert.equal(spawnRequests[0]?.command.replace(/\\/g, "/"), "C:/Tools/ComfyUI/.venv/Scripts/python.exe");
  assert.equal(spawnRequests[0]?.cwd?.replace(/\\/g, "/"), "C:/Tools/ComfyUI");
  assert.deepEqual(spawnRequests[0]?.args, ["main.py", "--listen", "127.0.0.1", "--port", "8188"]);
});

test("ensureBackendReady treats executable-only backends as ready without launching", async () => {
  const result = await ensureBackendReady("ffmpeg", {
    rootDir: "C:/workspace/mediaforge",
  }, {
    inspectBackendsFn: async () => [
      createStatus({
        available: true,
        detectedPath: "C:/ffmpeg/bin/ffmpeg.exe",
        name: "ffmpeg",
        source: "config",
      }),
    ],
    loadForgeDefaultsFn: async () => ({}),
  });

  assert.equal(result.ready, true);
  assert.equal(result.started, false);
  assert.equal(result.status, "ready");
  assert.equal(result.command, null);
  assert.match(result.reason ?? "", /no background service/i);
});

test("ensureBackendReady reports missing service launch metadata when ComfyUI is not installed", async () => {
  const result = await ensureBackendReady("comfyui", {
    rootDir: "C:/workspace/mediaforge",
  }, {
    fetchFn: async () => {
      throw new Error("connect ECONNREFUSED");
    },
    inspectBackendsFn: async () => [
      createStatus({
        name: "comfyui",
      }),
      createStatus({
        available: true,
        detectedPath: "C:/Python312/python.exe",
        name: "python",
        source: "path",
      }),
    ],
    loadForgeDefaultsFn: async () => ({
      comfyui: {
        default_port: 8188,
      },
    }),
    sleepFn: async () => undefined,
  });

  assert.equal(result.ready, false);
  assert.equal(result.started, false);
  assert.equal(result.status, "missing");
  assert.match(result.reason ?? "", /configured path/i);
});
