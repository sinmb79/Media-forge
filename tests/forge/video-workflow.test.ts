import { test } from "node:test";
import * as assert from "node:assert/strict";

import { buildVideoGenerationPlan } from "../../src/forge/video/build-video-generation-plan.js";

test("buildVideoGenerationPlan selects Q8 production workflow when VRAM is sufficient", async () => {
  const plan = await buildVideoGenerationPlan({
    mode: "from-image",
    model: "wan22",
    quality: "production",
    imagePath: "input/scene.png",
    desc_ko: "카메라가 천천히 앞으로 이동한다",
    hardwareProfile: {
      gpu: { name: "RTX 4080 Super", vram_gb: 16 },
      strategy: { offload_threshold_gb: 14 },
    },
    freeVramGb: 15,
  });

  assert.equal(plan.workflow_id, "wan22_i2v_gguf_q8");
  assert.equal(plan.backend, "comfyui");
  assert.equal(plan.assets.image, "input/scene.png");
});

test("buildVideoGenerationPlan falls back to Q4 when VRAM headroom is low", async () => {
  const plan = await buildVideoGenerationPlan({
    mode: "from-image",
    model: "wan22",
    quality: "production",
    imagePath: "input/scene.png",
    desc_ko: "카메라가 천천히 앞으로 이동한다",
    hardwareProfile: {
      gpu: { name: "RTX 4080 Super", vram_gb: 16 },
      strategy: { offload_threshold_gb: 14 },
    },
    freeVramGb: 10,
  });

  assert.equal(plan.workflow_id, "wan22_i2v_gguf_q4");
});

test("buildVideoGenerationPlan uses text-to-video workflow for from-text mode", async () => {
  const plan = await buildVideoGenerationPlan({
    mode: "from-text",
    model: "wan22",
    quality: "draft",
    desc_ko: "공주가 숲에서 나비를 쫓는다",
    hardwareProfile: {
      gpu: { name: "RTX 4080 Super", vram_gb: 16 },
    },
    freeVramGb: 12,
  });

  assert.equal(plan.workflow_id, "wan22_t2v_gguf");
  assert.equal(plan.assets.image, undefined);
});

test("buildVideoGenerationPlan selects the SkyReels Ref2V workflow for reference video tasks", async () => {
  const plan = await buildVideoGenerationPlan({
    desc_ko: "영웅이 절벽 끝에서 석양을 바라본다",
    freeVramGb: 14,
    hardwareProfile: {
      gpu: { name: "RTX 4080 Super", vram_gb: 16 },
    },
    imagePath: "characters/hero-front.png,characters/hero-side.png",
    mode: "ref2v",
    model: "skyreels-ref2v",
    quality: "production",
  });

  assert.equal(plan.workflow_id, "skyreels_v3_ref2v_fp8");
});

test("buildVideoGenerationPlan selects the SkyReels A2V workflow for talking avatar tasks", async () => {
  const plan = await buildVideoGenerationPlan({
    desc_ko: "자신감 있는 표정, 정면 샷",
    freeVramGb: 14,
    hardwareProfile: {
      gpu: { name: "RTX 4080 Super", vram_gb: 16 },
    },
    imagePath: "characters/hero-portrait.png",
    mode: "talking",
    model: "skyreels-a2v",
    quality: "production",
  });

  assert.equal(plan.workflow_id, "skyreels_v3_a2v_fp8");
});

test("buildVideoGenerationPlan selects the SkyReels V2V workflow for extension tasks", async () => {
  const plan = await buildVideoGenerationPlan({
    desc_ko: "카메라가 천천히 뒤로 빠진다",
    freeVramGb: 14,
    hardwareProfile: {
      gpu: { name: "RTX 4080 Super", vram_gb: 16 },
    },
    imagePath: "clips/scene_03.mp4",
    mode: "extend",
    model: "skyreels-v2v",
    quality: "production",
  });

  assert.equal(plan.workflow_id, "skyreels_v3_v2v_fp8");
});
