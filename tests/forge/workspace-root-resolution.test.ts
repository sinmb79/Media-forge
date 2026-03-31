import * as assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import { inspectBackends } from "../../src/backends/registry.js";
import { loadForgeDefaults } from "../../src/forge/config/load-forge-defaults.js";
import { loadWorkflowTemplate } from "../../src/forge/workflows/load-workflow-template.js";

const dashboardDir = path.resolve(process.cwd(), "dashboard");

test("loadForgeDefaults resolves MediaForge config from the dashboard app directory", async () => {
  const defaults = await loadForgeDefaults(dashboardDir);

  assert.equal(defaults.forge?.output_dir, "outputs");
  assert.equal(defaults.ollama?.default_port, 11434);
});

test("inspectBackends resolves the backend catalog from the dashboard app directory", async () => {
  const statuses = await inspectBackends(dashboardDir, {
    platform: "win32",
    env: { USERPROFILE: "C:/Users/test" },
    pathExists: async () => false,
    runCommand: async () => ({ exitCode: 1, stdout: "", stderr: "missing" }),
  });

  assert.deepEqual(
    statuses.map((status) => status.name),
    ["comfyui", "ffmpeg", "python", "ollama", "propainter"],
  );
  assert.ok(statuses.every((status) => status.available === false));
});

test("loadWorkflowTemplate resolves workflow files from the dashboard app directory", async () => {
  const workflow = await loadWorkflowTemplate("sdxl_controlnet_scribble", {
    negative_prompt: "blurry",
    output_path: "outputs/test-image.png",
    positive_prompt: "forest princess",
    sketch_path: "tests/fixtures/sketch-placeholder.png",
  }, dashboardDir);

  assert.equal(typeof workflow, "object");
  assert.notEqual(workflow, null);
});

test("loadForgeDefaults prefers config-stage overrides when present", async () => {
  const rootDir = path.join(os.tmpdir(), `mediaforge-config-stage-${Date.now()}`);
  await mkdir(path.join(rootDir, "config"), { recursive: true });
  await mkdir(path.join(rootDir, "config-stage"), { recursive: true });
  await writeFile(path.join(rootDir, "config", "backend-paths.yaml"), JSON.stringify({ backends: {} }));
  await writeFile(path.join(rootDir, "config", "hardware-profile.yaml"), JSON.stringify({}));
  await writeFile(path.join(rootDir, "config", "defaults.yaml"), JSON.stringify({
    forge: { output_dir: "outputs" },
    ollama: { default_model: "qwen3:14b" },
  }));
  await writeFile(path.join(rootDir, "config-stage", "defaults.yaml"), JSON.stringify({
    forge: { output_dir: "stage-outputs" },
    ollama: { default_model: "qwen3.5:latest" },
  }));

  const defaults = await loadForgeDefaults(rootDir);

  assert.equal(defaults.forge?.output_dir, "stage-outputs");
  assert.equal(defaults.ollama?.default_model, "qwen3.5:latest");
});

test("inspectBackends prefers config-stage backend path overrides when present", async () => {
  const rootDir = path.join(os.tmpdir(), `mediaforge-backend-stage-${Date.now()}`);
  await mkdir(path.join(rootDir, "config"), { recursive: true });
  await mkdir(path.join(rootDir, "config-stage"), { recursive: true });
  await writeFile(path.join(rootDir, "config", "backend-paths.yaml"), JSON.stringify({
    backends: {
      comfyui: { configured_paths: ["C:/fallback/ComfyUI"], entry_file: "main.py", install_guide_url: "https://example.com/comfyui" },
      ffmpeg: { configured_paths: ["C:/fallback/ffmpeg.exe"], executables: ["ffmpeg"], install_guide_url: "https://example.com/ffmpeg" },
      python: { configured_paths: ["C:/fallback/python.exe"], executables: ["python"], install_guide_url: "https://example.com/python" },
      ollama: { configured_paths: ["C:/fallback/ollama.exe"], executables: ["ollama"], install_guide_url: "https://example.com/ollama" },
      propainter: { configured_paths: ["C:/fallback/ProPainter"], entry_file: "inference_propainter.py", install_guide_url: "https://example.com/propainter" },
    },
  }));
  await writeFile(path.join(rootDir, "config", "hardware-profile.yaml"), JSON.stringify({}));
  await writeFile(path.join(rootDir, "config", "defaults.yaml"), JSON.stringify({ forge: {} }));
  await writeFile(path.join(rootDir, "config-stage", "backend-paths.yaml"), JSON.stringify({
    backends: {
      comfyui: { configured_paths: ["D:/preferred/ComfyUI"], entry_file: "main.py", install_guide_url: "https://example.com/comfyui" },
      ffmpeg: { configured_paths: ["D:/preferred/ffmpeg.exe"], executables: ["ffmpeg"], install_guide_url: "https://example.com/ffmpeg" },
      python: { configured_paths: ["D:/preferred/python.exe"], executables: ["python"], install_guide_url: "https://example.com/python" },
      ollama: { configured_paths: ["D:/preferred/ollama.exe"], executables: ["ollama"], install_guide_url: "https://example.com/ollama" },
      propainter: { configured_paths: ["D:/preferred/ProPainter"], entry_file: "inference_propainter.py", install_guide_url: "https://example.com/propainter" },
    },
  }));

  const statuses = await inspectBackends(rootDir, {
    env: {},
    pathExists: async (targetPath) => targetPath.replace(/\\/g, "/").startsWith("D:/preferred"),
    platform: "win32",
    runCommand: async () => ({ exitCode: 1, stderr: "", stdout: "" }),
  });

  assert.equal(statuses[0]?.detectedPath, "D:/preferred/ComfyUI");
  assert.ok(statuses.every((status) => status.available));
});
