import { test } from "node:test";
import * as assert from "node:assert/strict";

import { runCli } from "../helpers/run-cli.js";

test("engine forge prompt build returns prompt bundle JSON", () => {
  const result = runCli([
    "forge",
    "prompt",
    "build",
    "--desc",
    "공주가 숲에서 나비를 쫓는다",
    "--theme",
    "fairy_tale",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    image_prompt?: string;
    video_prompt?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(typeof parsed.image_prompt, "string");
  assert.equal(typeof parsed.video_prompt, "string");
});

test("engine forge image sketch supports simulation mode", () => {
  const result = runCli([
    "forge",
    "image",
    "sketch",
    "tests/fixtures/sketch-placeholder.png",
    "--desc",
    "공주가 숲에서 나비를 쫓는다",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    status?: string;
    workflow_id?: string;
    output_path?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.workflow_id, "sdxl_controlnet_scribble");
  assert.match(parsed.output_path ?? "", /png$/);
});

test("engine forge video from-image supports simulation mode", () => {
  const result = runCli([
    "forge",
    "video",
    "from-image",
    "tests/fixtures/sketch-placeholder.png",
    "--model",
    "wan22",
    "--quality",
    "production",
    "--desc",
    "카메라가 천천히 앞으로 이동한다",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    status?: string;
    workflow_id?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.ok(parsed.workflow_id === "wan22_i2v_gguf_q8" || parsed.workflow_id === "wan22_i2v_gguf_q4");
});

test("engine forge video long reads storyboard JSON in simulation mode", () => {
  const result = runCli([
    "forge",
    "video",
    "long",
    "--storyboard",
    "tests/fixtures/storyboard-sample.json",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    status?: string;
    scene_count?: number;
    workflow_id?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.scene_count, 2);
  assert.equal(parsed.workflow_id, "wan22_svi_long");
});
