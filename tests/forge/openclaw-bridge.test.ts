import * as assert from "node:assert/strict";
import { test } from "node:test";

import { startOpenClawBridgeServer } from "../../src/forge/agent/openclaw-bridge.js";

test("startOpenClawBridgeServer exposes bridge health and manifest", async () => {
  const server = await startOpenClawBridgeServer({
    host: "127.0.0.1",
    port: 0,
    rootDir: "C:\\Users\\sinmb\\workspace\\mediaforge",
  }, {
    buildDoctorReportFn: async () => ({
      backends: [],
      media_stack: {
        capabilities: [],
        comfyui_root: null,
        custom_nodes_dir: null,
        models_dir: null,
        ready: false,
        warnings: [],
      },
      schema_version: "0.1",
      status: "ok",
      system: {
        configured_hardware: null,
        disk: { free_gb: 100, mount: "C:\\", total_gb: 200 },
        gpu: null,
        ram: { free_gb: 16, total_gb: 32 },
      },
      warnings: [],
    }),
    inspectBackendsFn: async () => [],
    loadStageSnapshotFn: async () => ({
      backend_config_path: "C:\\stage\\config\\backend-paths.yaml",
      backend_config_staged: true,
      backend_overrides: [],
      default_ollama_model: "qwen3.5:9b",
      node_runtime_path: "C:\\stage\\runtime\\node\\node.exe",
      node_runtime_staged: true,
      openclaw_profile_path: "C:\\stage\\openclaw\\bridge.json",
      openclaw_profile_staged: true,
      openclaw_url: "http://127.0.0.1:4319",
      ready: true,
      root_dir: "C:\\Users\\sinmb\\workspace\\mediaforge",
      schema_version: "0.1",
      stage_dir: "C:\\stage",
    }),
    validatePathsFn: async () => ({
      files: [],
      schema_version: "0.1",
      status: "ok",
      warnings: [],
    }),
  });

  try {
    const healthResponse = await fetch(`${server.url}/health`);
    const manifestResponse = await fetch(`${server.url}/manifest`);
    const health = await healthResponse.json() as { status?: string; bridge?: string };
    const manifest = await manifestResponse.json() as {
      actions?: Array<{ id: string }>;
      openclaw?: { url?: string };
      stage?: { ready?: boolean };
    };

    assert.equal(healthResponse.status, 200);
    assert.equal(health.status, "ok");
    assert.equal(health.bridge, "openclaw");
    assert.equal(manifest.openclaw?.url, server.url);
    assert.equal(manifest.stage?.ready, true);
    assert.ok(manifest.actions?.some((action) => action.id === "prompt.build"));
  } finally {
    await server.close();
  }
});
