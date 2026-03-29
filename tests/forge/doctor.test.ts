import { test } from "node:test";
import * as assert from "node:assert/strict";

import type { BackendStatus } from "../../src/backends/types.js";
import { buildForgeDoctorReport } from "../../src/forge/doctor/build-forge-doctor-report.js";
import { runCli } from "../helpers/run-cli.js";

test("buildForgeDoctorReport includes backend warnings and system resources", async () => {
  const statuses: BackendStatus[] = [
    {
      name: "ffmpeg",
      available: true,
      detectedPath: "C:\\Tools\\ffmpeg.exe",
      version: "ffmpeg version 7.1",
      installGuideUrl: "https://ffmpeg.org/download.html",
      source: "path",
    },
    {
      name: "comfyui",
      available: false,
      detectedPath: null,
      version: null,
      installGuideUrl: "https://github.com/comfyanonymous/ComfyUI",
      source: "missing",
    },
  ];

  const result = await buildForgeDoctorReport({
    rootDir: "C:\\Users\\sinmb\\workspace\\mediaforge",
    inspectBackends: async () => statuses,
    loadHardwareProfile: async () => ({
      gpu: { name: "RTX 4080 Super", vram_gb: 16, cuda_compute: 8.9 },
      cpu: { name: "Ryzen 9 7950X3D", cores: 16, threads: 32 },
      ram: { total_gb: 32 },
      strategy: {
        vram_16gb: {
          wan22: "gguf_q8",
        },
      },
    }),
    getGpuInfo: async () => ({
      name: "RTX 4080 Super",
      total_vram_gb: 16,
      free_vram_gb: 11.4,
    }),
    getRamInfo: () => ({
      total_gb: 31.9,
      free_gb: 20.1,
    }),
    getDiskInfo: async () => ({
      mount: "C:\\",
      total_gb: 953.9,
      free_gb: 401.2,
    }),
  });

  assert.equal(result.schema_version, "0.1");
  assert.equal(result.status, "warning");
  assert.equal(result.backends.length, 2);
  assert.equal(result.system.gpu?.total_vram_gb, 16);
  assert.equal(result.system.ram.total_gb, 31.9);
  assert.ok(result.warnings.some((warning) => warning.includes("comfyui")));
});

test("engine forge doctor prints forge report in JSON", () => {
  const result = runCli(["forge", "doctor", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    schema_version?: string;
    backends?: Array<{ name?: string }>;
    system?: { ram?: { total_gb?: number } };
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.schema_version, "0.1");
  assert.ok(parsed.backends?.some((backend) => backend.name === "ffmpeg"));
  assert.equal(typeof parsed.system?.ram?.total_gb, "number");
});

test("engine forge edit simulate path is available", () => {
  const result = runCli([
    "forge",
    "edit",
    "cut",
    "tests/fixtures/video-placeholder.mp4",
    "--start",
    "00:05",
    "--end",
    "00:15",
    "--simulate",
  ]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /simulated/i);
  assert.match(result.stdout, /cut/i);
});

test("engine forge backend probe reports detected backends in JSON", () => {
  const result = runCli(["forge", "backend", "probe", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    schema_version?: string;
    backends?: Array<{ name?: string; available?: boolean }>;
    available_count?: number;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.schema_version, "0.1");
  assert.ok(parsed.backends?.some((backend) => backend.name === "ffmpeg"));
  assert.equal(typeof parsed.available_count, "number");
});

test("engine forge paths validate reports config file validation", () => {
  const result = runCli(["forge", "paths", "validate", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    schema_version?: string;
    status?: string;
    files?: Array<{ name?: string; exists?: boolean; valid?: boolean }>;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.schema_version, "0.1");
  assert.ok(parsed.files?.some((file) => file.name === "backend-paths" && file.exists === true && file.valid === true));
  assert.ok(parsed.status === "ok" || parsed.status === "warning");
});
