import * as assert from "node:assert/strict";
import * as path from "node:path";
import { test } from "node:test";

import { listMotionPresets, runMotionVideo } from "../../src/forge/video/motion.js";
import { runVideoFromText } from "../../src/forge/video/from-text.js";
import { runVideoReference } from "../../src/forge/video/reference.js";
import { runVideoRestyle } from "../../src/forge/video/restyle.js";

test("listMotionPresets exposes built-in motion actions", () => {
  const presets = listMotionPresets();
  assert.ok(presets.some((preset) => preset.id === "slow_push_in"));
  assert.ok(presets.some((preset) => preset.id === "belly_dance"));
});

test("runMotionVideo delegates to image-to-video generation", async () => {
  const result = await runMotionVideo({
    action: "orbital",
    direction: "forward",
    duration_sec: 5,
    image_path: "tests/fixtures/sketch-placeholder.png",
    simulate: true,
  });

  assert.equal(result.status, "simulated");
  assert.match(result.output_path, /mp4$/);
});

test("runVideoRestyle returns a simulated V2V workflow result", async () => {
  const result = await runVideoRestyle({
    inputPath: "tests/fixtures/video-placeholder.mp4",
    prompt: "change to a winter night city with neon rain",
    simulate: true,
    style: "cinematic",
  });

  assert.equal(result.status, "simulated");
  assert.equal(result.workflow_id, "wan22_v2v_restyle");
  assert.equal(path.extname(result.output_path), ".mp4");
});

test("runVideoReference returns a simulated reference-guided video result", async () => {
  const result = await runVideoReference({
    prompt: "match the camera mood of the reference",
    referencePath: "tests/fixtures/video-placeholder.mp4",
    simulate: true,
  });

  assert.equal(result.status, "simulated");
  assert.equal(result.workflow_id, "wan22_reference_video");
  assert.equal(path.extname(result.output_path), ".mp4");
});

test("runVideoFromText supports dashboard-facing video controls in simulation mode", async () => {
  const result = await runVideoFromText({
    aspect_ratio: "16:9",
    desc_ko: "A glowing butterfly drifts over a moonlit lake",
    duration_sec: 8,
    model: "wan22",
    quality: "production",
    resolution: "1080p",
    simulate: true,
  });

  assert.equal(result.status, "simulated");
  assert.equal(result.workflow_id, "wan22_t2v_gguf");
  assert.equal(path.extname(result.output_path), ".mp4");
});

test("runVideoRestyle executes the ComfyUI workflow when simulation is disabled", async () => {
  const calls: string[] = [];

  const result = await runVideoRestyle(
    {
      inputPath: "tests/fixtures/video-placeholder.mp4",
      prompt: "turn the scene into a rainy cyber city",
      simulate: false,
      style: "cyberpunk",
    },
    {
      comfyClient: {
        async queueWorkflow(workflow) {
          calls.push(`queue:${JSON.stringify(workflow)}`);
          return { prompt_id: "restyle-1" };
        },
        async saveDownloadedOutput(_output, targetPath) {
          calls.push(`save:${targetPath}`);
          return targetPath;
        },
        async waitForCompletion() {
          return {
            completed: true,
            outputs: [{ filename: "restyle.mp4", subfolder: "", type: "output" }],
            prompt_id: "restyle-1",
            raw: {},
            status: "success",
          };
        },
      },
    },
  );

  assert.equal(result.status, "completed");
  assert.ok(calls.some((entry) => entry.startsWith("queue:")));
  assert.ok(calls.some((entry) => entry.startsWith("save:")));
});

test("runVideoReference executes the reference workflow when simulation is disabled", async () => {
  const calls: string[] = [];

  const result = await runVideoReference(
    {
      prompt: "follow the shot staging of the reference",
      referencePath: "tests/fixtures/video-placeholder.mp4",
      simulate: false,
    },
    {
      comfyClient: {
        async queueWorkflow(workflow) {
          calls.push(`queue:${JSON.stringify(workflow)}`);
          return { prompt_id: "ref-1" };
        },
        async saveDownloadedOutput(_output, targetPath) {
          calls.push(`save:${targetPath}`);
          return targetPath;
        },
        async waitForCompletion() {
          return {
            completed: true,
            outputs: [{ filename: "reference.mp4", subfolder: "", type: "output" }],
            prompt_id: "ref-1",
            raw: {},
            status: "success",
          };
        },
      },
    },
  );

  assert.equal(result.status, "completed");
  assert.ok(calls.some((entry) => entry.startsWith("queue:")));
  assert.ok(calls.some((entry) => entry.startsWith("save:")));
});
