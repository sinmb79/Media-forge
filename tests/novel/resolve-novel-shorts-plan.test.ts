import { test } from "node:test";
import * as assert from "node:assert/strict";

import type { EngineRequest } from "../../src/domain/contracts.js";
import { normalizeRequest } from "../../src/domain/normalize-request.js";
import {
  applyNovelIntentOverrides,
  resolveNovelShortsPlan,
} from "../../src/novel/resolve-novel-shorts-plan.js";
import { loadFixture } from "../helpers/load-fixture.js";

test("returns null when novel_project is missing", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const normalized = normalizeRequest(request);
  const plan = resolveNovelShortsPlan(normalized);

  assert.equal(plan, null);
});

test("creates cliffhanger-oriented overrides for cliffhanger_short", async () => {
  const request = await loadFixture<EngineRequest>("novel-cliffhanger-request.json");
  const normalized = normalizeRequest(request);
  const plan = resolveNovelShortsPlan(normalized);

  assert.equal(plan?.mode, "cliffhanger_short");
  assert.match(plan?.highlight_candidate ?? "", /footsteps behind her/i);
  assert.equal(plan?.intent_overrides.theme, "cliffhanger");
  assert.equal(plan?.intent_overrides.goal, "attract next-episode interest");
  assert.equal(plan?.intent_overrides.emotion, "shock and dread");
  assert.equal(plan?.intent_overrides.duration_sec, 25);
  assert.equal(plan?.qa_flags.spoiler_risk, "high");
});

test("centers character_focus in character_moment_short mode", async () => {
  const request = await loadFixture<EngineRequest>("novel-cliffhanger-request.json");
  request.novel_project = {
    ...request.novel_project!,
    mode: "character_moment_short",
  };

  const normalized = normalizeRequest(request);
  const plan = resolveNovelShortsPlan(normalized);

  assert.equal(plan?.mode, "character_moment_short");
  assert.match(plan?.hook_builder ?? "", /Mina/i);
  assert.equal(plan?.intent_overrides.theme, "character_moment");
  assert.equal(plan?.intent_overrides.duration_sec, 15);
  assert.equal(plan?.qa_flags.emotional_payoff, "high");
});

test("creates explainer-like overrides for lore_worldbuilding_short", async () => {
  const request = await loadFixture<EngineRequest>("novel-cliffhanger-request.json");
  request.novel_project = {
    ...request.novel_project!,
    mode: "lore_worldbuilding_short",
    scene_summary: "The archive reveals how the kingdom stores forbidden memories in living books.",
    emotional_peak: "curiosity",
  };

  const normalized = normalizeRequest(request);
  const plan = resolveNovelShortsPlan(normalized);

  assert.equal(plan?.mode, "lore_worldbuilding_short");
  assert.equal(plan?.intent_overrides.theme, "explainer");
  assert.equal(plan?.intent_overrides.goal, "deepen story universe with a mini-explainer");
  assert.equal(plan?.intent_overrides.duration_sec, 20);
  assert.equal(plan?.qa_flags.scene_coherence, "high");
});

test("applies intent overrides without mutating normalized_request", async () => {
  const request = await loadFixture<EngineRequest>("novel-cliffhanger-request.json");
  const normalized = normalizeRequest(request);
  const plan = resolveNovelShortsPlan(normalized);
  const effectiveRequest = applyNovelIntentOverrides(normalized, plan);

  assert.equal(normalized.base.intent.theme, "cinematic");
  assert.equal(effectiveRequest.base.intent.theme, "cliffhanger");
  assert.equal(effectiveRequest.derived.resolved_duration_sec, 25);
});
