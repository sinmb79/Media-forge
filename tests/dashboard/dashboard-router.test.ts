import * as assert from "node:assert/strict";
import { test } from "node:test";

import { startDashboardServer } from "../../src/dashboard/server/create-dashboard-server.js";
import { DashboardJobQueue } from "../../src/dashboard/services/dashboard-job-queue.js";

test("dashboard server serves the shell, health, outputs, and action acceptance", async () => {
  const queue = new DashboardJobQueue();
  queue.createJob({
    id: "existing-job",
    kind: "prompt-build",
    label: "Prompt Build",
  });
  queue.updateMetadata("existing-job", {
    details: "Prompt result verified.",
    expected_artifact: false,
    phase: "verification",
    result_kind: "non_file",
    summary: "Generated and verified",
  });
  const started = await startDashboardServer({
    actionService: {
      enqueueAction(action: string) {
        return {
          action,
          job_id: "job-1",
          label: "Prompt Build",
          status: "queued",
        };
      },
    } as never,
    healthService: {
      async getSnapshot() {
        return {
          schema_version: "0.1",
          workspace_root: process.cwd(),
          doctor: {
            schema_version: "0.1",
            status: "ok",
            backends: [
              {
                name: "ollama",
                available: true,
                detectedPath: "C:\\Tools\\ollama.exe",
                version: "0.17.7",
                installGuideUrl: "https://ollama.com",
                source: "path",
              },
            ],
            system: {
              gpu: null,
              ram: {
                total_gb: 32,
                free_gb: 20,
              },
              disk: {
                mount: "C:\\",
                total_gb: 1000,
                free_gb: 400,
              },
              configured_hardware: null,
            },
            warnings: [],
          },
          paths: {
            schema_version: "0.1",
            status: "ok",
            files: [],
            warnings: [],
          },
          generated_at: new Date().toISOString(),
        };
      },
    } as never,
    jobQueue: queue,
    outputStore: {
      getOutputsRoot() {
        return `${process.cwd()}\\outputs`;
      },
      async listRecent() {
        return [
          {
            id: "output-1",
            name: "clip.mp4",
            path: `${process.cwd()}\\outputs\\clip.mp4`,
            relativePath: "clip.mp4",
            extension: ".mp4",
            kind: "video",
            modifiedAt: new Date().toISOString(),
            sizeBytes: 12,
            url: "/outputs/clip.mp4",
          },
        ];
      },
    } as never,
    port: 0,
  });

  try {
    const shellResponse = await fetch(`${started.url}/`);
    const shellHtml = await shellResponse.text();
    assert.equal(shellResponse.status, 200);
    assert.match(shellHtml, /MediaForge Studio/);

    const healthResponse = await fetch(`${started.url}/api/health`);
    const healthPayload = await healthResponse.json() as {
      workspace_root?: string;
      doctor?: { backends?: Array<{ name?: string }> };
    };
    assert.equal(healthResponse.status, 200);
    assert.equal(healthPayload.workspace_root, process.cwd());
    assert.equal(healthPayload.doctor?.backends?.[0]?.name, "ollama");

    const outputsResponse = await fetch(`${started.url}/api/outputs`);
    const outputsPayload = await outputsResponse.json() as {
      items?: Array<{ kind?: string }>;
    };
    assert.equal(outputsResponse.status, 200);
    assert.equal(outputsPayload.items?.[0]?.kind, "video");

    const actionResponse = await fetch(`${started.url}/api/actions/prompt-build`, {
      method: "POST",
      body: JSON.stringify({ desc: "테스트" }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const actionPayload = await actionResponse.json() as {
      action?: string;
      job_id?: string;
    };
    assert.equal(actionResponse.status, 202);
    assert.equal(actionPayload.action, "prompt-build");
    assert.equal(actionPayload.job_id, "job-1");

    const jobsResponse = await fetch(`${started.url}/api/jobs`);
    const jobsPayload = await jobsResponse.json() as {
      items?: Array<{
        expected_artifact?: boolean;
        phase?: string;
        result_kind?: string;
        summary?: string;
      }>;
    };
    assert.equal(jobsResponse.status, 200);
    assert.equal(Array.isArray(jobsPayload.items), true);
    assert.equal(jobsPayload.items?.[0]?.phase, "verification");
    assert.equal(jobsPayload.items?.[0]?.result_kind, "non_file");
    assert.equal(jobsPayload.items?.[0]?.expected_artifact, false);
  } finally {
    await started.close();
  }
});

test("dashboard router returns 422 when action preflight is blocked", async () => {
  const queue = new DashboardJobQueue();
  const started = await startDashboardServer({
    actionService: {
      async enqueueAction() {
        return {
          action: "video-from-text",
          status: "blocked",
          reason: "ComfyUI is required.",
          missing_backends: ["comfyui"],
          missing_inputs: [],
          next_steps: ["Install ComfyUI and retry."],
        };
      },
    } as never,
    healthService: {
      async getSnapshot() {
        throw new Error("Not used");
      },
    } as never,
    jobQueue: queue,
    outputStore: {
      getOutputsRoot() {
        return `${process.cwd()}\\outputs`;
      },
      async listRecent() {
        return [];
      },
    } as never,
    port: 0,
  });

  try {
    const response = await fetch(`${started.url}/api/actions/video-from-text`, {
      method: "POST",
      body: JSON.stringify({ desc: "장면 설명" }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const payload = await response.json() as {
      status?: string;
      missing_backends?: string[];
    };

    assert.equal(response.status, 422);
    assert.equal(payload.status, "blocked");
    assert.deepEqual(payload.missing_backends, ["comfyui"]);
  } finally {
    await started.close();
  }
});
