import { test } from "node:test";
import * as assert from "node:assert/strict";

import type { EngineRequest } from "../../src/domain/contracts.js";
import { normalizeRequest } from "../../src/domain/normalize-request.js";
import { resolvePlatformOutputSpec } from "../../src/platform/resolve-platform-output-spec.js";
import { resolveMotionPlan } from "../../src/motion/resolve-motion-plan.js";
import { loadFixture } from "../helpers/load-fixture.js";

test("requires a strong hook motion for the hook segment", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const normalized = normalizeRequest(request);
  const platformSpec = resolvePlatformOutputSpec(normalized);
  const motionPlan = resolveMotionPlan(normalized, platformSpec);

  assert.equal(motionPlan.schema_version, "0.1");
  assert.equal(motionPlan.hook_motion.required, true);
  assert.equal(motionPlan.segments[0]?.role, "hook");
  assert.equal(motionPlan.motion_sequence[0]?.segment_id, "hook");
  assert.equal(motionPlan.motion_sequence[0]?.intensity, "high");
  assert.match(
    motionPlan.hook_motion.reason_codes.join(","),
    /hook_requires_strong_motion_event/,
  );
});

test("blocks a third identical motion in a fast-cut plan", async () => {
  const request = await loadFixture<EngineRequest>("tiktok-long-request.json");
  const normalized = normalizeRequest(request);
  const platformSpec = resolvePlatformOutputSpec(normalized);
  const motionPlan = resolveMotionPlan(normalized, platformSpec);

  const firstThreeMotions = motionPlan.motion_sequence
    .slice(0, 3)
    .map((assignment: { motion: string }) => assignment.motion);

  assert.deepEqual(firstThreeMotions, ["zoom_in", "zoom_in", "pan_left"]);
  assert.match(
    motionPlan.anti_repetition_state.applied_rules.join(","),
    /same_motion_cannot_repeat_3_times/,
  );
  assert.match(
    motionPlan.anti_repetition_state.blocked_motions.join(","),
    /zoom_in/,
  );
});

test("prefers a high-energy hook motion on TikTok", async () => {
  const request = await loadFixture<EngineRequest>("tiktok-long-request.json");
  const normalized = normalizeRequest(request);
  const platformSpec = resolvePlatformOutputSpec(normalized);
  const motionPlan = resolveMotionPlan(normalized, platformSpec);

  assert.equal(motionPlan.platform, "tiktok");
  assert.equal(motionPlan.hook_motion.selected, "zoom_in");
  assert.equal(motionPlan.motion_sequence[0]?.intensity, "high");
  assert.match(
    motionPlan.motion_sequence[0]?.reason_codes.join(",") ?? "",
    /platform_prefers_high_energy_hook/,
  );
});

test("blocks glitch_transition when loop mode is enabled", async () => {
  const request = await loadFixture<EngineRequest>("tiktok-long-request.json");
  request.output.type = "loop_video_prompt";

  const normalized = normalizeRequest(request);
  const platformSpec = resolvePlatformOutputSpec(normalized);
  const motionPlan = resolveMotionPlan(normalized, platformSpec);

  assert.equal(motionPlan.loop_flag, true);
  assert.equal(
    motionPlan.motion_sequence.some(
      (assignment: { motion: string }) => assignment.motion === "glitch_transition",
    ),
    false,
  );
  assert.match(
    motionPlan.anti_repetition_state.applied_rules.join(","),
    /loop_avoids_excessive_glitch_motion/,
  );
});
