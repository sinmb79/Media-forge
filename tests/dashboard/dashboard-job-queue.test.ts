import * as assert from "node:assert/strict";
import { test } from "node:test";

import { DashboardJobQueue } from "../../src/dashboard/services/dashboard-job-queue.js";

test("DashboardJobQueue tracks lifecycle updates and logs", () => {
  const queue = new DashboardJobQueue();
  const events: string[] = [];
  const unsubscribe = queue.subscribe((event) => {
    events.push(`${event.type}:${event.job.status}`);
  });

  queue.createJob({
    id: "job-1",
    kind: "prompt-build",
    label: "Prompt Build",
  });
  queue.markRunning("job-1");
  queue.updateMetadata("job-1", {
    details: "Prompt build is running",
    phase: "execution",
    result_kind: "non_file",
    summary: "Running prompt build",
  });
  queue.appendLog("job-1", "Started");
  queue.updateProgress("job-1", 0.7);
  queue.succeed("job-1", { ok: true }, {
    artifact_exists: null,
    details: "Prompt bundle verified",
    expected_artifact: false,
    phase: "verification",
    result_kind: "non_file",
    summary: "Generated and verified",
  });
  unsubscribe();

  const [job] = queue.listJobs();

  assert.equal(job?.status, "succeeded");
  assert.equal(job?.progress, 1);
  assert.equal(job?.phase, "verification");
  assert.equal(job?.summary, "Generated and verified");
  assert.equal(job?.expected_artifact, false);
  assert.equal(job?.logs.at(-1)?.message, "Started");
  assert.deepEqual(events, [
    "created:queued",
    "updated:running",
    "updated:running",
    "updated:running",
    "updated:running",
    "updated:succeeded",
  ]);
});

test("DashboardJobQueue records failures", () => {
  const queue = new DashboardJobQueue();

  queue.createJob({
    id: "job-2",
    kind: "image-sketch",
    label: "Image Sketch",
  });
  queue.fail("job-2", "ComfyUI missing", {
    details: "Install ComfyUI before running image generation.",
    expected_artifact: true,
    next_step: "Install ComfyUI and retry.",
    phase: "execution",
    result_kind: "file",
    summary: "Blocked before run",
  });

  const [job] = queue.listJobs();

  assert.equal(job?.status, "failed");
  assert.equal(job?.error, "ComfyUI missing");
  assert.equal(job?.summary, "Blocked before run");
  assert.equal(job?.expected_artifact, true);
  assert.equal(job?.next_step, "Install ComfyUI and retry.");
});
