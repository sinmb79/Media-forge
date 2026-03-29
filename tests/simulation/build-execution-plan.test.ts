import { test } from "node:test";
import * as assert from "node:assert/strict";

import type { EngineRequest } from "../../src/domain/contracts.js";
import { normalizeRequest } from "../../src/domain/normalize-request.js";
import { routeRequest } from "../../src/domain/route-request.js";
import { scoreRequest } from "../../src/domain/score-request.js";
import { buildExecutionPlan } from "../../src/simulation/build-execution-plan.js";
import { loadFixture } from "../helpers/load-fixture.js";

test("builds a node and edge execution plan", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const normalized = normalizeRequest(request);
  const scoring = scoreRequest(normalized);
  const routing = routeRequest(normalized, scoring);
  const plan = buildExecutionPlan(normalized, routing);

  assert.ok(plan.nodes.length > 0);
  assert.ok(plan.edges.length > 0);
  assert.equal(plan.nodes[0]?.node_id, "prompt_normalizer");
  assert.equal(plan.edges[0]?.[0], "prompt_normalizer");
});

test("only references fallback nodes that exist in the plan", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const normalized = normalizeRequest(request);
  const scoring = scoreRequest(normalized);
  const routing = routeRequest(normalized, scoring);
  const plan = buildExecutionPlan(normalized, routing);
  const nodeIds = new Set(plan.nodes.map((node) => node.node_id));

  for (const node of plan.nodes) {
    if (node.fallback_node !== null) {
      assert.equal(nodeIds.has(node.fallback_node), true, node.fallback_node);
    }
  }
});

test("Rule D: tts_candidate and video_candidate use premium backend when premium_allowed_steps is populated", async () => {
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

  assert.equal(routing.selected_backend, "premium", "test requires premium backend");
  assert.ok(routing.premium_allowed_steps.includes("premium_tts"));
  assert.ok(routing.premium_allowed_steps.includes("high_value_video_generation"));
  assert.ok(routing.premium_allowed_steps.includes("final_script_refinement"));

  const plan = buildExecutionPlan(normalized, routing);
  const nodeMap = new Map(plan.nodes.map((n) => [n.node_id, n]));

  assert.equal(nodeMap.get("tts_candidate")?.backend, "premium");
  assert.equal(nodeMap.get("video_candidate")?.backend, "premium");
  assert.equal(nodeMap.get("tool_adapter")?.backend, "premium");
  assert.notEqual(nodeMap.get("formatter")?.backend, "premium");
  assert.equal(nodeMap.get("final_polish")?.backend, "premium");
});

test("Rule D: tts_candidate and video_candidate do not use premium backend when premium_allowed_steps is empty", async () => {
  const request = await loadFixture<EngineRequest>("premium-blocked-request.json");
  const normalized = normalizeRequest(request);
  const scoring = scoreRequest(normalized);
  const routing = routeRequest(normalized, scoring);

  assert.equal(routing.premium_allowed_steps.length, 0);

  const plan = buildExecutionPlan(normalized, routing);
  const nodeMap = new Map(plan.nodes.map((n) => [n.node_id, n]));

  assert.notEqual(nodeMap.get("tts_candidate")?.backend, "premium");
  assert.notEqual(nodeMap.get("video_candidate")?.backend, "premium");
  assert.notEqual(nodeMap.get("tool_adapter")?.backend, "premium");
});
