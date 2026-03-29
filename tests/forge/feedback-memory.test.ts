import { test } from "node:test";
import * as assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { getFailurePatterns, getSuccessPatterns, loadFeedback, saveFeedback } from "../../src/learning/feedback.js";
import { optimizeMemoryPlan } from "../../src/forge/memory-optimizer.js";

test("feedback storage saves and loads entries by theme", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-feedback-"));

  await saveFeedback({
    dataDir: tempDir,
    entry: {
      id: "result_1",
      timestamp: 1,
      theme: "fairy_tale",
      desc_ko: "공주가 숲에서 나비를 쫓는다",
      image_prompt: "storybook forest",
      video_prompt: "camera slowly pushes in",
      score: 5,
      tags: ["good_composition"],
    },
  });

  const entries = await loadFeedback(tempDir);
  const patterns = await getSuccessPatterns(tempDir, "fairy_tale");

  assert.equal(entries.length, 1);
  assert.equal(patterns[0]?.image_prompt, "storybook forest");
});

test("feedback storage exposes failure patterns for low-scoring entries", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-feedback-failures-"));

  await saveFeedback({
    dataDir: tempDir,
    entry: {
      id: "result_fail_1",
      timestamp: 2,
      theme: "fairy_tale",
      desc_ko: "공주가 길을 잃는다",
      image_prompt: "muddy forest path",
      video_prompt: "camera shakes and loses focus",
      score: 2,
      tags: ["bad_motion"],
    },
  });

  const failures = await getFailurePatterns(tempDir, "fairy_tale");

  assert.equal(failures.length, 1);
  assert.equal(failures[0]?.id, "result_fail_1");
});

test("optimizeMemoryPlan selects quantization and offload flags from available VRAM", () => {
  const plan = optimizeMemoryPlan({
    freeVramGb: 9,
    model: "wan22",
  });

  assert.equal(plan.selected_profile, "q4");
  assert.equal(plan.offload_mode, "none");
  assert.ok(plan.flags.includes("--lowvram") || plan.flags.length === 0);
});
