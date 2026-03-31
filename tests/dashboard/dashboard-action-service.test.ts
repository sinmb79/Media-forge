import * as assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import type { BackendStatus } from "../../src/backends/types.js";
import { DashboardActionService } from "../../src/dashboard/services/dashboard-action-service.js";
import { DashboardJobQueue } from "../../src/dashboard/services/dashboard-job-queue.js";

test("DashboardActionService blocks prompt build when description is missing", async () => {
  const queue = new DashboardJobQueue();
  const service = new DashboardActionService(queue, {
    inspectBackends: async () => [],
  });

  const result = await service.enqueueAction("prompt-build", {});

  assert.equal(result.status, "blocked");
  assert.match(result.reason, /description/i);
  assert.deepEqual(result.missing_inputs, ["desc"]);
  assert.equal(queue.listJobs().length, 0);
});

test("DashboardActionService blocks video from text when comfyui is unavailable", async () => {
  const queue = new DashboardJobQueue();
  const service = new DashboardActionService(queue, {
    inspectBackends: async () => ([
      unavailableBackend("comfyui"),
      availableBackend("ollama"),
    ]),
  });

  const result = await service.enqueueAction("video-from-text", {
    desc: "공주가 숲을 걷는다",
  });

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.missing_backends, ["comfyui"]);
  assert.equal(queue.listJobs().length, 0);
});

test("DashboardActionService blocks voice change when ffmpeg is unavailable", async () => {
  const queue = new DashboardJobQueue();
  const service = new DashboardActionService(queue, {
    inspectBackends: async () => ([
      unavailableBackend("ffmpeg"),
      availableBackend("python"),
    ]),
  });

  const result = await service.enqueueAction("audio-run", {
    input: "C:\\temp\\voice.wav",
    subcommand: "voice-change",
  });

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.missing_backends, ["ffmpeg"]);
  assert.equal(queue.listJobs().length, 0);
});

test("DashboardActionService marks non-file actions as verified success", async () => {
  const queue = new DashboardJobQueue();
  const service = new DashboardActionService(queue, {
    inspectBackends: async () => [availableBackend("ollama")],
    runners: {
      "prompt-build": async () => ({
        image_prompt: "a castle in the forest",
        source: "ollama",
      }),
    },
  });

  const accepted = await service.enqueueAction("prompt-build", {
    desc: "공주가 숲에서 호수를 발견한다",
  });

  assert.equal(accepted.status, "queued");
  if (accepted.status !== "queued") {
    throw new Error("Expected the action to be queued.");
  }
  const job = await waitForJob(queue, accepted.job_id);

  assert.equal(job.status, "succeeded");
  assert.equal(job.phase, "verification");
  assert.equal(job.result_kind, "non_file");
  assert.equal(job.expected_artifact, false);
  assert.equal(job.artifact_exists, null);
  assert.match(job.summary, /verified/i);
});

test("DashboardActionService fails verification when a file action has no output_path", async () => {
  const queue = new DashboardJobQueue();
  const service = new DashboardActionService(queue, {
    inspectBackends: async () => [availableBackend("comfyui"), availableBackend("ollama")],
    runners: {
      "image-sketch": async () => ({
        status: "completed",
        workflow_id: "sdxl_controlnet_scribble",
      }),
    },
  });

  const accepted = await service.enqueueAction("image-sketch", {
    desc: "한국어 설명",
    sketchPath: "tests/fixtures/sketch-placeholder.png",
  });

  assert.equal(accepted.status, "queued");
  if (accepted.status !== "queued") {
    throw new Error("Expected the action to be queued.");
  }
  const job = await waitForJob(queue, accepted.job_id);

  assert.equal(job.status, "failed");
  assert.equal(job.phase, "verification");
  assert.equal(job.result_kind, "file");
  assert.equal(job.expected_artifact, true);
  assert.equal(job.artifact_exists, false);
  assert.match(job.summary, /no output file was created/i);
});

test("DashboardActionService verifies file outputs when the artifact exists", async () => {
  const rootDir = await makeTempRoot();
  const outputPath = path.resolve(rootDir, "outputs", "verified.mp4");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, "video");

  const queue = new DashboardJobQueue();
  const service = new DashboardActionService(queue, {
    inspectBackends: async () => [availableBackend("comfyui"), availableBackend("ollama")],
    rootDir,
    runners: {
      "video-from-text": async () => ({
        output_path: outputPath,
        status: "completed",
        workflow_id: "wan22_t2v_gguf",
      }),
    },
  });

  const accepted = await service.enqueueAction("video-from-text", {
    desc: "안개 낀 숲속의 마법 호수",
  });

  if (accepted.status !== "queued") {
    throw new Error("Expected the action to be queued.");
  }
  const job = await waitForJob(queue, accepted.job_id);

  assert.equal(job.status, "succeeded");
  assert.equal(job.phase, "verification");
  assert.equal(job.artifact_path, outputPath);
  assert.equal(job.artifact_exists, true);

  await rm(rootDir, { force: true, recursive: true });
});

function availableBackend(name: BackendStatus["name"]): BackendStatus {
  return {
    name,
    available: true,
    detectedPath: `C:\\Tools\\${name}.exe`,
    version: "1.0.0",
    installGuideUrl: `https://example.com/${name}`,
    source: "path",
  };
}

function unavailableBackend(name: BackendStatus["name"]): BackendStatus {
  return {
    name,
    available: false,
    detectedPath: null,
    version: null,
    installGuideUrl: `https://example.com/${name}`,
    source: "missing",
  };
}

async function waitForJob(queue: DashboardJobQueue, jobId: string) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const job = queue.listJobs().find((item) => item.id === jobId);
    if (job && (job.status === "succeeded" || job.status === "failed")) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(`Timed out waiting for job ${jobId}`);
}

async function makeTempRoot(): Promise<string> {
  const rootDir = path.resolve(
    os.tmpdir(),
    `mediaforge-dashboard-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  await mkdir(rootDir, { recursive: true });
  return rootDir;
}
