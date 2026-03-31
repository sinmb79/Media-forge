import * as assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import {
  loadDesktopRuntimeStageSnapshot,
  stageDesktopLocalRuntime,
} from "../../src/desktop/runtime-staging.js";

test("stageDesktopLocalRuntime writes a local node runtime and backend path snapshot", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-stage-root-"));
  const stageDir = path.join(rootDir, "desktop", "stage");
  const nodeExecutable = path.join(rootDir, "tools", "node.exe");
  const comfyDir = path.join(rootDir, "installed", "comfyui");
  const ollamaExe = path.join(rootDir, "installed", "ollama", "ollama.exe");
  const ffmpegExe = path.join(rootDir, "installed", "ffmpeg", "bin", "ffmpeg.exe");
  const pythonExe = path.join(rootDir, "installed", "python", "python.exe");

  await mkdir(path.join(rootDir, "config"), { recursive: true });
  await mkdir(path.dirname(nodeExecutable), { recursive: true });
  await mkdir(comfyDir, { recursive: true });
  await mkdir(path.dirname(ollamaExe), { recursive: true });
  await mkdir(path.dirname(ffmpegExe), { recursive: true });
  await mkdir(path.dirname(pythonExe), { recursive: true });
  await writeFile(path.join(rootDir, "config", "backend-paths.yaml"), JSON.stringify({
    backends: {
      comfyui: { configured_paths: ["engines/comfyui"], entry_file: "main.py", install_guide_url: "https://example.com/comfyui" },
      ffmpeg: { configured_paths: ["engines/ffmpeg/bin/ffmpeg.exe"], executables: ["ffmpeg"], install_guide_url: "https://example.com/ffmpeg" },
      python: { configured_paths: ["engines/python/python.exe"], executables: ["python"], install_guide_url: "https://example.com/python" },
      ollama: { configured_paths: ["engines/ollama/ollama.exe"], executables: ["ollama"], install_guide_url: "https://example.com/ollama" },
      propainter: { configured_paths: ["engines/propainter"], entry_file: "inference_propainter.py", install_guide_url: "https://example.com/propainter" },
    },
  }, null, 2));
  await writeFile(path.join(rootDir, "config", "defaults.yaml"), JSON.stringify({
    forge: {},
    ollama: { default_model: "qwen3:14b" },
  }, null, 2));
  await writeFile(path.join(comfyDir, "main.py"), "print('comfy')");
  await writeFile(nodeExecutable, "node-binary");
  await writeFile(ollamaExe, "ollama-binary");
  await writeFile(ffmpegExe, "ffmpeg-binary");
  await writeFile(pythonExe, "python-binary");

  const snapshot = await stageDesktopLocalRuntime({
    rootDir,
    stageDir,
  }, {
    inspectBackendsFn: async () => ([
      { available: true, detectedPath: comfyDir, installGuideUrl: "https://example.com/comfyui", name: "comfyui", source: "config", version: null },
      { available: true, detectedPath: ffmpegExe, installGuideUrl: "https://example.com/ffmpeg", name: "ffmpeg", source: "config", version: null },
      { available: true, detectedPath: pythonExe, installGuideUrl: "https://example.com/python", name: "python", source: "config", version: null },
      { available: true, detectedPath: ollamaExe, installGuideUrl: "https://example.com/ollama", name: "ollama", source: "config", version: null },
      { available: false, detectedPath: null, installGuideUrl: "https://example.com/propainter", name: "propainter", source: "missing", version: null },
    ]),
    installedOllamaModels: async () => ["qwen3.5:9b"],
    resolveNodeExecutableFn: async () => nodeExecutable,
  });

  const stagedNode = path.join(stageDir, "runtime", "node", "node.exe");
  const stagedBackendConfig = path.join(stageDir, "config", "backend-paths.yaml");
  const stagedDefaults = path.join(stageDir, "config", "defaults.yaml");
  const stagedOpenClaw = path.join(stageDir, "openclaw", "bridge.json");
  const backendConfig = JSON.parse(await readFile(stagedBackendConfig, "utf8")) as {
    backends: Record<string, { configured_paths?: string[] }>;
  };
  const defaults = JSON.parse(await readFile(stagedDefaults, "utf8")) as {
    ollama?: { default_model?: string };
  };

  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.node_runtime_staged, true);
  assert.equal(snapshot.openclaw_profile_staged, true);
  assert.equal(snapshot.default_ollama_model, "qwen3.5:9b");
  assert.equal(await readFile(stagedNode, "utf8"), "node-binary");
  assert.equal(backendConfig.backends.comfyui?.configured_paths?.[0], comfyDir);
  assert.equal(backendConfig.backends.ollama?.configured_paths?.[0], ollamaExe);
  assert.equal(defaults.ollama?.default_model, "qwen3.5:9b");
  assert.match(await readFile(stagedOpenClaw, "utf8"), /openclaw/i);
});

test("loadDesktopRuntimeStageSnapshot reports missing staged resources before snapshot creation", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-stage-empty-"));
  const stageDir = path.join(rootDir, "desktop", "stage");

  const snapshot = await loadDesktopRuntimeStageSnapshot({
    rootDir,
    stageDir,
  });

  assert.equal(snapshot.ready, false);
  assert.equal(snapshot.node_runtime_staged, false);
  assert.equal(snapshot.backend_config_staged, false);
  assert.equal(snapshot.openclaw_profile_staged, false);
});
