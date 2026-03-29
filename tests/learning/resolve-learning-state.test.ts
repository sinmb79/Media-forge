import { test } from "node:test";
import * as assert from "node:assert/strict";

import type { EngineRequest } from "../../src/domain/contracts.js";
import { resolveBrollPlan } from "../../src/broll/resolve-broll-plan.js";
import { normalizeRequest } from "../../src/domain/normalize-request.js";
import { resolveLearningState } from "../../src/learning/resolve-learning-state.js";
import { resolveMotionPlan } from "../../src/motion/resolve-motion-plan.js";
import { resolvePlatformOutputSpec } from "../../src/platform/resolve-platform-output-spec.js";
import { loadFixture } from "../helpers/load-fixture.js";

test("defaults to bootstrapped when learning_history is missing", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const normalized = normalizeRequest(request);
  const platformSpec = resolvePlatformOutputSpec(normalized);
  const motionPlan = resolveMotionPlan(normalized, platformSpec);
  const brollPlan = resolveBrollPlan(normalized, platformSpec, motionPlan);
  const learningState = resolveLearningState(
    normalized,
    platformSpec,
    motionPlan,
    brollPlan,
  );

  assert.equal(learningState.phase, "bootstrapped");
  assert.equal(learningState.weights.dataset, 0.8);
  assert.equal(learningState.weights.user, 0.2);
  assert.equal(learningState.confidence, "low");
});

test("resolves to adaptive after 10 completed outputs", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  request.learning_history = {
    accepted_suggestions: 7,
    completed_outputs: 12,
    has_niche_history: false,
    rejected_suggestions: 2,
  };

  const normalized = normalizeRequest(request);
  const platformSpec = resolvePlatformOutputSpec(normalized);
  const motionPlan = resolveMotionPlan(normalized, platformSpec);
  const brollPlan = resolveBrollPlan(normalized, platformSpec, motionPlan);
  const learningState = resolveLearningState(
    normalized,
    platformSpec,
    motionPlan,
    brollPlan,
  );

  assert.equal(learningState.phase, "adaptive");
  assert.equal(learningState.weights.dataset, 0.5);
  assert.equal(learningState.weights.user, 0.5);
  assert.equal(learningState.threshold_status.adaptive_enabled, true);
  assert.equal(learningState.confidence, "medium");
});

test("resolves to personalized after 50 completed outputs", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  request.learning_history = {
    accepted_suggestions: 42,
    completed_outputs: 55,
    has_niche_history: true,
    rejected_suggestions: 5,
  };

  const normalized = normalizeRequest(request);
  const platformSpec = resolvePlatformOutputSpec(normalized);
  const motionPlan = resolveMotionPlan(normalized, platformSpec);
  const brollPlan = resolveBrollPlan(normalized, platformSpec, motionPlan);
  const learningState = resolveLearningState(
    normalized,
    platformSpec,
    motionPlan,
    brollPlan,
  );

  assert.equal(learningState.phase, "personalized");
  assert.equal(learningState.weights.dataset, 0.2);
  assert.equal(learningState.weights.user, 0.8);
  assert.equal(learningState.threshold_status.auto_default_updates_enabled, true);
  assert.equal(learningState.confidence, "high");
});

test("reports fallback sources during cold-start", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const normalized = normalizeRequest(request);
  const platformSpec = resolvePlatformOutputSpec(normalized);
  const motionPlan = resolveMotionPlan(normalized, platformSpec);
  const brollPlan = resolveBrollPlan(normalized, platformSpec, motionPlan);
  const learningState = resolveLearningState(
    normalized,
    platformSpec,
    motionPlan,
    brollPlan,
  );

  assert.deepEqual(learningState.fallback_sources, [
    "global_theme_priors",
    "platform_priors",
  ]);
  assert.match(
    learningState.reason_codes.join(","),
    /insufficient_history_uses_priors/,
  );
});
