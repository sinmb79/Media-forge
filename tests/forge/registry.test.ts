import { test } from "node:test";
import * as assert from "node:assert/strict";

import { detectBackends } from "../../src/backends/registry.js";
import type { BackendPathCatalog } from "../../src/backends/types.js";

const TEST_CATALOG: BackendPathCatalog = {
  backends: {
    comfyui: {
      configured_paths: ["%USERPROFILE%/ComfyUI"],
      entry_file: "main.py",
      install_guide_url: "https://github.com/comfyanonymous/ComfyUI",
    },
    ffmpeg: {
      executables: ["ffmpeg"],
      version_args: ["-version"],
      install_guide_url: "https://ffmpeg.org/download.html",
    },
    python: {
      executables: ["python", "py"],
      version_args: ["--version"],
      install_guide_url: "https://www.python.org/downloads/",
    },
    ollama: {
      executables: ["ollama"],
      version_args: ["--version"],
      install_guide_url: "https://ollama.com/download",
    },
    propainter: {
      configured_paths: ["%USERPROFILE%/ProPainter"],
      entry_file: "inference_propainter.py",
      install_guide_url: "https://github.com/sczhou/ProPainter",
    },
  },
};

test("detectBackends resolves configured paths and PATH executables", async () => {
  const knownPaths = new Set([
    "C:/Users/test/ComfyUI",
    "C:/Users/test/ComfyUI/main.py",
    "C:/Users/test/ProPainter",
    "C:/Users/test/ProPainter/inference_propainter.py",
  ]);

  const statuses = await detectBackends(TEST_CATALOG, {
    platform: "win32",
    env: { USERPROFILE: "C:/Users/test" },
    pathExists: async (targetPath) => knownPaths.has(targetPath.replace(/\\/g, "/")),
    runCommand: async (command, args) => {
      const key = `${command} ${args.join(" ")}`.trim();

      switch (key) {
        case "where ffmpeg":
          return { exitCode: 0, stdout: "C:\\Tools\\ffmpeg.exe\r\n", stderr: "" };
        case "where python":
          return { exitCode: 0, stdout: "C:\\Python312\\python.exe\r\n", stderr: "" };
        case "where ollama":
          return { exitCode: 0, stdout: "C:\\Ollama\\ollama.exe\r\n", stderr: "" };
        case "C:\\Tools\\ffmpeg.exe -version":
          return { exitCode: 0, stdout: "ffmpeg version 7.1-full_build\r\n", stderr: "" };
        case "C:\\Python312\\python.exe --version":
          return { exitCode: 0, stdout: "Python 3.12.8\r\n", stderr: "" };
        case "C:\\Ollama\\ollama.exe --version":
          return { exitCode: 0, stdout: "ollama version 0.6.0\r\n", stderr: "" };
        default:
          return { exitCode: 1, stdout: "", stderr: `Unexpected command: ${key}` };
      }
    },
  });

  assert.equal(statuses.length, 5);
  assert.deepEqual(
    statuses.map((status) => [status.name, status.available, status.source]),
    [
      ["comfyui", true, "config"],
      ["ffmpeg", true, "path"],
      ["python", true, "path"],
      ["ollama", true, "path"],
      ["propainter", true, "config"],
    ],
  );
  assert.equal(statuses[1]?.version, "ffmpeg version 7.1-full_build");
  assert.equal(statuses[2]?.version, "Python 3.12.8");
  assert.equal(statuses[3]?.version, "ollama version 0.6.0");
});

test("detectBackends marks missing installations with guide URLs", async () => {
  const statuses = await detectBackends(TEST_CATALOG, {
    platform: "win32",
    env: { USERPROFILE: "C:/Users/test" },
    pathExists: async () => false,
    runCommand: async () => ({ exitCode: 1, stdout: "", stderr: "not found" }),
  });

  assert.ok(statuses.every((status) => status.available === false));
  assert.ok(
    statuses.every((status) => status.source === "missing" && status.installGuideUrl.startsWith("https://")),
  );
});
