import { test } from "node:test";
import * as assert from "node:assert/strict";

import type { EngineRequest } from "../../src/domain/contracts.js";
import { normalizeRequest } from "../../src/domain/normalize-request.js";
import { routeRequest } from "../../src/domain/route-request.js";
import { scoreRequest } from "../../src/domain/score-request.js";
import { loadFixture } from "../helpers/load-fixture.js";

test("blocks premium routing when candidate score is below threshold", async () => {
  const request = await loadFixture<EngineRequest>("premium-blocked-request.json");
  const normalized = normalizeRequest(request);
  const scoring = scoreRequest(normalized);
  const routing = routeRequest(normalized, scoring);

  assert.equal(routing.premium_allowed, false);
  assert.equal(routing.selected_backend, "local");
  assert.equal(routing.fallback_backend, "gpu");
  assert.match(
    routing.reason_codes.join(","),
    /candidate_score_below_premium_threshold/,
  );
});

test("keeps low-cost requests on the local backend", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const normalized = normalizeRequest(request);
  const scoring = scoreRequest(normalized);
  const routing = routeRequest(normalized, scoring);

  assert.equal(scoring.candidate_score >= 0, true);
  assert.equal(routing.selected_backend, "local");
  assert.match(routing.reason_codes.join(","), /local_backend_available/);
});

test("disables fallback backend when the request forbids fallback", async () => {
  const request = await loadFixture<EngineRequest>("no-fallback-request.json");
  const normalized = normalizeRequest(request);
  const scoring = scoreRequest(normalized);
  const routing = routeRequest(normalized, scoring);

  assert.equal(routing.selected_backend, "local");
  assert.equal(routing.fallback_backend, null);
});

test("routes to gpu when batch_size >= 5 and gpu_available is true", async () => {
  const request = await loadFixture<EngineRequest>("batch-gpu-request.json");
  const normalized = normalizeRequest(request);
  const scoring = scoreRequest(normalized);
  const routing = routeRequest(normalized, scoring);

  assert.equal(routing.selected_backend, "gpu");
  assert.match(routing.reason_codes.join(","), /batch_gpu_preferred/);
});

test("Rule C triggers at exact boundary batch_size === 5", async () => {
  const request = await loadFixture<EngineRequest>("batch-gpu-request.json");
  const atBoundary: EngineRequest = {
    ...request,
    backend: { ...request.backend, batch_size: 5 },
  };
  const normalized = normalizeRequest(atBoundary);
  const scoring = scoreRequest(normalized);
  const routing = routeRequest(normalized, scoring);

  assert.equal(routing.selected_backend, "gpu");
  assert.match(routing.reason_codes.join(","), /batch_gpu_preferred/);
});

test("Rule C does not trigger when batch_size is below threshold", async () => {
  const request = await loadFixture<EngineRequest>("batch-gpu-request.json");
  const belowThreshold: EngineRequest = {
    ...request,
    backend: { ...request.backend, batch_size: 4 },
  };
  const normalized = normalizeRequest(belowThreshold);
  const scoring = scoreRequest(normalized);
  const routing = routeRequest(normalized, scoring);

  assert.notEqual(routing.selected_backend, "gpu");
  assert.doesNotMatch(routing.reason_codes.join(","), /batch_gpu_preferred/);
});

test("premium_allowed_steps is populated when premium is allowed", async () => {
  const request: EngineRequest = {
    version: "0.1",
    intent: { topic: "t", subject: "s", goal: "g", emotion: "e", platform: "youtube_shorts", theme: "th", duration_sec: 30 },
    constraints: { language: "en", budget_tier: "high", quality_tier: "premium", visual_consistency_required: true, content_policy_safe: true },
    style: { hook_type: "curiosity", pacing_profile: "fast_cut", caption_style: "tiktok_viral", camera_language: "simple_push_in" },
    backend: { preferred_engine: "sora", allow_fallback: true },
    output: { type: "video_prompt" },
  };
  const normalized = normalizeRequest(request);
  const scoring = scoreRequest(normalized);
  const routing = routeRequest(normalized, scoring);

  assert.equal(routing.premium_allowed, true);
  assert.equal(routing.premium_allowed_steps.length, 4);
  assert.ok(routing.premium_allowed_steps.includes("premium_tts"));
  assert.ok(routing.premium_allowed_steps.includes("high_value_video_generation"));
  assert.ok(routing.premium_allowed_steps.includes("final_script_refinement"));
  assert.ok(routing.premium_allowed_steps.includes("final_polish"));
});

test("premium_allowed_steps is empty when premium is blocked", async () => {
  const request = await loadFixture<EngineRequest>("premium-blocked-request.json");
  const normalized = normalizeRequest(request);
  const scoring = scoreRequest(normalized);
  const routing = routeRequest(normalized, scoring);

  assert.equal(routing.premium_allowed, false);
  assert.equal(routing.premium_allowed_steps.length, 0);
});
