import * as assert from "node:assert/strict";
import { test } from "node:test";

import { bootstrapMediaForgeRuntime } from "../../src/forge/runtime/bootstrap.js";
import type { BackendEnsureResult } from "../../src/backends/supervisor.js";

function createEnsureResult(
  overrides: Partial<BackendEnsureResult> & Pick<BackendEnsureResult, "name">,
): BackendEnsureResult {
  const { name, ...rest } = overrides;

  return {
    args: [],
    command: null,
    cwd: null,
    name,
    pid: null,
    ready: true,
    ready_url: null,
    reason: null,
    started: false,
    status: "ready",
    ...rest,
  };
}

test("bootstrapMediaForgeRuntime aggregates backend readiness", async () => {
  const result = await bootstrapMediaForgeRuntime(
    {
      rootDir: "C:/workspace/mediaforge",
    },
    {
      ensureBackendsReadyFn: async () => [
        createEnsureResult({ name: "comfyui", ready: true }),
        createEnsureResult({ name: "ollama", ready: true, started: true, status: "started" }),
        createEnsureResult({ name: "ffmpeg", ready: true }),
      ],
    },
  );

  assert.equal(result.status, "ready");
  assert.equal(result.backend_summary.ready_count, 3);
  assert.equal(result.backend_summary.started_count, 1);
  assert.equal(result.dashboard?.status, "disabled");
});

test("bootstrapMediaForgeRuntime reports partial readiness and can start a dashboard service", async () => {
  let startedDashboard = false;

  const result = await bootstrapMediaForgeRuntime(
    {
      dashboard: {
        enabled: true,
        host: "127.0.0.1",
        port: 3000,
      },
      rootDir: "C:/workspace/mediaforge",
    },
    {
      ensureBackendsReadyFn: async () => [
        createEnsureResult({ name: "comfyui", ready: true }),
        createEnsureResult({ name: "ollama", ready: false, reason: "timed out", status: "missing" }),
      ],
      startDashboardServerFn: async () => {
        startedDashboard = true;
        return {
          close: async () => undefined,
          host: "127.0.0.1",
          port: 3000,
          rootDir: "C:/workspace/mediaforge",
          server: {} as never,
          url: "http://127.0.0.1:3000",
        };
      },
    },
  );

  assert.equal(startedDashboard, true);
  assert.equal(result.status, "partial");
  assert.equal(result.dashboard?.status, "started");
  assert.equal(result.dashboard?.url, "http://127.0.0.1:3000");
  assert.equal(result.backend_summary.ready_count, 1);
  assert.equal(result.backend_summary.total_count, 2);
});
