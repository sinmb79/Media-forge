import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { Interface as ReadlineInterface } from "node:readline";

import {
  buildRequestFromAnswers,
  runWizard,
  type WizardAnswers,
} from "../../src/wizard/run-wizard.js";

// Suppress all wizard output during tests
const noopOut = () => {};

// ---------------------------------------------------------------------------
// buildRequestFromAnswers — pure function tests
// ---------------------------------------------------------------------------

test("buildRequestFromAnswers produces a valid EngineRequest structure", () => {
  const answers: WizardAnswers = {
    topic: "AI productivity tool",
    subject: "young professional",
    goal: "make an explainer clip",
    emotion: "curiosity",
    platform: "youtube_shorts",
    theme: "explainer",
    duration_sec: 30,
    language: "ko",
    budget_tier: "low",
    quality_tier: "balanced",
    hook_type: "curiosity",
    pacing_profile: "fast_cut",
    caption_style: "informative_clean",
    camera_language: "simple_push_in",
    preferred_engine: "local",
  };

  const request = buildRequestFromAnswers(answers);

  assert.equal(request.version, "0.1");
  assert.equal(request.intent.topic, "AI productivity tool");
  assert.equal(request.intent.platform, "youtube_shorts");
  assert.equal(request.intent.duration_sec, 30);
  assert.equal(request.constraints.language, "ko");
  assert.equal(request.constraints.budget_tier, "low");
  assert.equal(request.constraints.quality_tier, "balanced");
  assert.equal(request.constraints.visual_consistency_required, true);
  assert.equal(request.constraints.content_policy_safe, true);
  assert.equal(request.style.hook_type, "curiosity");
  assert.equal(request.style.pacing_profile, "fast_cut");
  assert.equal(request.backend.preferred_engine, "local");
  assert.equal(request.backend.allow_fallback, true);
  assert.equal(request.output.type, "video_prompt");
});

test("buildRequestFromAnswers maps tiktok platform correctly", () => {
  const answers: WizardAnswers = {
    topic: "product launch",
    subject: "creator",
    goal: "announce launch",
    emotion: "excitement",
    platform: "tiktok",
    theme: "product_launch",
    duration_sec: 20,
    language: "en",
    budget_tier: "balanced",
    quality_tier: "balanced",
    hook_type: "surprise",
    pacing_profile: "fast_cut",
    caption_style: "tiktok_viral",
    camera_language: "simple_push_in",
    preferred_engine: "gpu",
  };

  const request = buildRequestFromAnswers(answers);

  assert.equal(request.intent.platform, "tiktok");
  assert.equal(request.backend.preferred_engine, "gpu");
  assert.equal(request.style.caption_style, "tiktok_viral");
});

// ---------------------------------------------------------------------------
// runWizard — mock readline tests
// ---------------------------------------------------------------------------

function makeMockRl(inputs: string[]): ReadlineInterface {
  const queue = [...inputs];

  const mockRl = {
    question(_prompt: string, callback: (answer: string) => void) {
      const answer = queue.shift() ?? "";
      setImmediate(() => callback(answer));
    },
    close() {},
  } as unknown as ReadlineInterface;

  return mockRl;
}

test("runWizard collects all answers with explicit inputs", async () => {
  // Inputs in the order wizard asks:
  // topic, subject, goal, emotion,
  // platform (1=youtube_shorts), theme, duration,
  // language, budget (1=low), quality (2=balanced),
  // hook (1=curiosity), pacing (1=fast_cut), engine (1=local)
  const inputs = [
    "AI tool",
    "professional",
    "explain it",
    "curiosity",
    "1", // youtube_shorts
    "explainer",
    "25",
    "ko",
    "1", // low
    "2", // balanced
    "1", // curiosity hook
    "1", // fast_cut
    "1", // local engine
  ];

  const rl = makeMockRl(inputs);
  const answers = await runWizard(rl, noopOut);

  assert.equal(answers.topic, "AI tool");
  assert.equal(answers.platform, "youtube_shorts");
  assert.equal(answers.duration_sec, 25);
  assert.equal(answers.language, "ko");
  assert.equal(answers.budget_tier, "low");
  assert.equal(answers.quality_tier, "balanced");
  assert.equal(answers.hook_type, "curiosity");
  assert.equal(answers.pacing_profile, "fast_cut");
  assert.equal(answers.preferred_engine, "local");
  assert.equal(answers.caption_style, "informative_clean");
});

test("runWizard uses defaults when Enter is pressed for all inputs", async () => {
  // All empty inputs — defaults should apply
  const inputs = Array(13).fill("") as string[];
  const rl = makeMockRl(inputs);
  const answers = await runWizard(rl, noopOut);

  assert.equal(answers.topic, "my topic");
  assert.equal(answers.platform, "youtube_shorts"); // default index 0
  assert.equal(answers.duration_sec, 30); // youtube recommended
  assert.equal(answers.language, "ko");
  assert.equal(answers.budget_tier, "low"); // default index 0
  assert.equal(answers.quality_tier, "low"); // default index 0
});

test("runWizard clamps duration above platform maximum", async () => {
  const inputs = [
    "topic", "subject", "goal", "emotion",
    "2", // tiktok
    "explainer",
    "999", // way over max 45
    "ko", "1", "1", "1", "1", "1",
  ];

  const rl = makeMockRl(inputs);
  const answers = await runWizard(rl, noopOut);

  assert.equal(answers.platform, "tiktok");
  assert.equal(answers.duration_sec, 45); // clamped to max
});

test("runWizard clamps duration below platform minimum", async () => {
  const inputs = [
    "topic", "subject", "goal", "emotion",
    "3", // instagram_reels
    "explainer",
    "3", // below min 10
    "ko", "1", "1", "1", "1", "1",
  ];

  const rl = makeMockRl(inputs);
  const answers = await runWizard(rl, noopOut);

  assert.equal(answers.platform, "instagram_reels");
  assert.equal(answers.duration_sec, 10); // raised to min
});
