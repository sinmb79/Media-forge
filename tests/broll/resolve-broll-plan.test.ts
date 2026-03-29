import { test } from "node:test";
import * as assert from "node:assert/strict";

import type { EngineRequest } from "../../src/domain/contracts.js";
import { normalizeRequest } from "../../src/domain/normalize-request.js";
import { resolveBrollPlan } from "../../src/broll/resolve-broll-plan.js";
import { resolveMotionPlan } from "../../src/motion/resolve-motion-plan.js";
import { resolvePlatformOutputSpec } from "../../src/platform/resolve-platform-output-spec.js";
import { loadFixture } from "../helpers/load-fixture.js";

test("aligns broll_plan segments with motion_plan segments", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const normalized = normalizeRequest(request);
  const platformSpec = resolvePlatformOutputSpec(normalized);
  const motionPlan = resolveMotionPlan(normalized, platformSpec);
  const brollPlan = resolveBrollPlan(normalized, platformSpec, motionPlan);

  assert.equal(brollPlan.dataset_version, "0.1");
  assert.equal(brollPlan.segments.length, motionPlan.segments.length);
  assert.equal(brollPlan.segments[0]?.segment_id, "hook");
  assert.equal(brollPlan.segments[0]?.role, "hook");
});

test("selects an ai concept from topic and goal keywords", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const normalized = normalizeRequest(request);
  const platformSpec = resolvePlatformOutputSpec(normalized);
  const motionPlan = resolveMotionPlan(normalized, platformSpec);
  const brollPlan = resolveBrollPlan(normalized, platformSpec, motionPlan);

  assert.equal(brollPlan.segments[0]?.concept, "ai");
  assert.match(
    brollPlan.segments[0]?.selection_reason_codes.join(",") ?? "",
    /matched_topic_keyword/,
  );
});

test("uses generic fallback concepts and warnings when semantic confidence is weak", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  request.intent.topic = "xqzv blorf snarth";
  request.intent.goal = "qlim vorta nexs";
  request.intent.emotion = "murky";
  request.intent.theme = "opaque";

  const normalized = normalizeRequest(request);
  const platformSpec = resolvePlatformOutputSpec(normalized);
  const motionPlan = resolveMotionPlan(normalized, platformSpec);
  const brollPlan = resolveBrollPlan(normalized, platformSpec, motionPlan);

  assert.equal(brollPlan.segments[0]?.concept, "focus");
  assert.match(brollPlan.warnings.join(","), /generic_broll_fallback_used/);
  assert.match(
    brollPlan.segments[0]?.selection_reason_codes.join(",") ?? "",
    /fallback_due_to_low_semantic_confidence/,
  );
});

test("uses platform suitability to break semantic ties deterministically", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  request.intent.platform = "instagram_reels";
  request.intent.topic = "clean simple workflow";
  request.intent.goal = "make a polished workflow explainer";
  request.intent.theme = "explainer";

  const normalized = normalizeRequest(request);
  const platformSpec = resolvePlatformOutputSpec(normalized);
  const motionPlan = resolveMotionPlan(normalized, platformSpec);
  const brollPlan = resolveBrollPlan(normalized, platformSpec, motionPlan);

  assert.equal(brollPlan.segments[1]?.concept, "simplicity");
  assert.match(
    brollPlan.segments[1]?.selection_reason_codes.join(",") ?? "",
    /platform_prefers_concept/,
  );
});
