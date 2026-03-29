import { mkdtemp } from "node:fs/promises";
import * as assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import { saveFeedback } from "../../src/learning/feedback.js";
import { buildForgePromptBundle } from "../../src/prompt/forge-prompt-builder.js";
import { buildVideoGenerationPlan } from "../../src/forge/video/build-video-generation-plan.js";

test("buildForgePromptBundle injects success patterns into the Ollama system prompt", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-patterns-"));
  let capturedSystemPrompt = "";

  await saveFeedback({
    dataDir,
    entry: {
      id: "success_1",
      timestamp: 1,
      theme: "fairy_tale",
      desc_ko: "공주가 숲속을 걷는다",
      image_prompt: "storybook princess in an enchanted forest",
      score: 5,
      video_prompt: "camera slowly pushes forward through glowing trees",
    },
  });

  const bundle = await buildForgePromptBundle({
    dataDir,
    desc_ko: "공주가 호수를 발견한다",
    ollamaClient: {
      async generateWithSystemPrompt(_prompt, _model, systemPrompt) {
        capturedSystemPrompt = systemPrompt;
        return JSON.stringify({
          image_prompt: "princess discovers a glowing lake",
          image_negative: "blurry",
          video_prompt: "camera cranes down toward the water",
          video_negative: "flicker",
        });
      },
      async isAvailable() {
        return true;
      },
      async generate() {
        throw new Error("not used");
      },
      name: "ollama",
    },
    theme: "fairy_tale",
  });

  assert.equal(bundle.source, "ollama");
  assert.match(capturedSystemPrompt, /storybook princess in an enchanted forest/);
  assert.match(capturedSystemPrompt, /camera slowly pushes forward through glowing trees/);
});

test("buildVideoGenerationPlan exposes cpu offload flags when VRAM is insufficient", async () => {
  const plan = await buildVideoGenerationPlan({
    desc_ko: "카메라가 천천히 전진한다",
    freeVramGb: 2,
    hardwareProfile: {
      gpu: { name: "RTX 3060", vram_gb: 12 },
      strategy: { offload_threshold_gb: 14 },
    },
    imagePath: "input/scene.png",
    mode: "from-image",
    model: "wan22",
    quality: "production",
  });

  assert.equal(plan.workflow_id, "wan22_i2v_gguf_q4");
  assert.equal(plan.memory_profile, "cpu_offload");
  assert.ok(plan.runtime_flags.includes("--novram"));
});
