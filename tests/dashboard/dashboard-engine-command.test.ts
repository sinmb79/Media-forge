import * as assert from "node:assert/strict";
import { test } from "node:test";

import { dashboardEngineCommand } from "../../src/cli/dashboard-engine-command.js";
import { runCli } from "../helpers/run-cli.js";

test("engine dashboard --json returns launch metadata", () => {
  const result = runCli(["dashboard", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    command?: string;
    status?: string;
    url?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.command, "dashboard");
  assert.equal(parsed.status, "ready");
  assert.match(parsed.url ?? "", /^http:\/\/127\.0\.0\.1:3210/);
});

test("engine dashboard --port 3211 --json honors custom port", () => {
  const result = runCli(["dashboard", "--port", "3211", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    port?: number;
    url?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.port, 3211);
  assert.match(parsed.url ?? "", /3211/);
});

test("dashboardEngineCommand starts the runtime bootstrap and opens the browser when requested", async () => {
  const openedUrls: string[] = [];
  let bootstrapCalls = 0;

  const result = await dashboardEngineCommand(
    {
      host: "127.0.0.1",
      json: false,
      open: true,
      port: 3456,
    },
    {
      bootstrapRuntime: async () => {
        bootstrapCalls += 1;
        return {
          backend_summary: {
            ready_count: 3,
            requested_backends: ["comfyui", "ollama", "ffmpeg"],
            results: [],
            started_count: 1,
            total_count: 3,
          },
          dashboard: {
            enabled: true,
            host: "127.0.0.1",
            port: 3456,
            reason: null,
            status: "started",
            url: "http://127.0.0.1:3456",
          },
          root_dir: "C:/workspace/mediaforge",
          status: "ready",
        };
      },
      openInBrowser: (url) => {
        openedUrls.push(url);
      },
    },
  );

  assert.equal(bootstrapCalls, 1);
  assert.equal(result.exitCode, 0);
  assert.equal(result.keepAlive, true);
  assert.match(result.output, /Backends ready: 3\/3/);
  assert.deepEqual(openedUrls, ["http://127.0.0.1:3456"]);
});

test("dashboardEngineCommand reports bootstrap status in json mode without starting the server", async () => {
  let bootstrapCalls = 0;

  const result = await dashboardEngineCommand(
    {
      host: "127.0.0.1",
      json: true,
      open: false,
      port: 3000,
    },
    {
      bootstrapRuntime: async () => {
        bootstrapCalls += 1;
        return {
          backend_summary: {
            ready_count: 2,
            requested_backends: ["comfyui", "ollama", "ffmpeg"],
            results: [],
            started_count: 0,
            total_count: 3,
          },
          dashboard: {
            enabled: false,
            host: null,
            port: null,
            reason: null,
            status: "disabled",
            url: null,
          },
          root_dir: "C:/workspace/mediaforge",
          status: "partial",
        };
      },
    },
  );
  const parsed = JSON.parse(result.output) as {
    backend_summary?: { ready_count?: number };
    status?: string;
  };

  assert.equal(bootstrapCalls, 1);
  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "partial");
  assert.equal(parsed.backend_summary?.ready_count, 2);
});
