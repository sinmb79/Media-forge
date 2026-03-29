import { test } from "node:test";
import * as assert from "node:assert/strict";

import { buildForgeExecutionJob } from "../../src/forge/plans/build-forge-execution-job.js";
import { buildForgePromptPlan } from "../../src/forge/plans/build-forge-prompt-plan.js";
import { buildForgeRenderPlan } from "../../src/forge/plans/build-forge-render-plan.js";

test("buildForgePromptPlan creates prompt-only planning data", () => {
  const promptPlan = buildForgePromptPlan({
    request_id: "req_123",
    mode: "sketch_to_video",
    desc_ko: "공주가 숲에서 나비를 쫓는다",
    theme: "fairy_tale",
  });

  assert.equal(promptPlan.request_id, "req_123");
  assert.equal(promptPlan.theme, "fairy_tale");
  assert.equal(promptPlan.mode, "sketch_to_video");
  assert.equal("backend" in promptPlan, false);
  assert.match(promptPlan.prompt_seed, /공주가 숲에서 나비를 쫓는다/);
});

test("buildForgeRenderPlan adds workflow selection without execution details", () => {
  const promptPlan = buildForgePromptPlan({
    request_id: "req_123",
    mode: "sketch_to_video",
    desc_ko: "공주가 숲에서 나비를 쫓는다",
    theme: "fairy_tale",
  });

  const renderPlan = buildForgeRenderPlan(promptPlan, {
    backend: "comfyui",
    workflow_id: "wan22_i2v_gguf_q4",
    assets: {
      sketch: "input/sketch.png",
      output_dir: "output",
    },
  });

  assert.equal(renderPlan.request_id, "req_123");
  assert.equal(renderPlan.backend, "comfyui");
  assert.equal(renderPlan.workflow_id, "wan22_i2v_gguf_q4");
  assert.equal(renderPlan.assets.sketch, "input/sketch.png");
  assert.equal("command" in renderPlan, false);
});

test("buildForgeExecutionJob resolves concrete execution details", () => {
  const promptPlan = buildForgePromptPlan({
    request_id: "req_123",
    mode: "sketch_to_video",
    desc_ko: "공주가 숲에서 나비를 쫓는다",
    theme: "fairy_tale",
  });
  const renderPlan = buildForgeRenderPlan(promptPlan, {
    backend: "comfyui",
    workflow_id: "wan22_i2v_gguf_q4",
    assets: {
      sketch: "input/sketch.png",
      output_dir: "output",
    },
  });

  const executionJob = buildForgeExecutionJob(renderPlan, {
    job_id: "job_123",
    retryable: true,
  });

  assert.equal(executionJob.job_id, "job_123");
  assert.equal(executionJob.backend, "comfyui");
  assert.equal(executionJob.inputs.sketch, "input/sketch.png");
  assert.equal(executionJob.outputs.output_dir, "output");
  assert.equal(executionJob.retryable, true);
  assert.ok(Array.isArray(executionJob.command_args));
});
