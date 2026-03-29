import { test } from "node:test";
import * as assert from "node:assert/strict";

import type { EngineRequest } from "../../src/domain/contracts.js";
import { normalizeRequest } from "../../src/domain/normalize-request.js";
import { resolvePlatformOutputSpec } from "../../src/platform/resolve-platform-output-spec.js";
import { loadFixture } from "../helpers/load-fixture.js";

test("resolves the YouTube Shorts platform output spec", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const normalized = normalizeRequest(request);
  const spec = resolvePlatformOutputSpec(normalized);

  assert.equal(spec.platform, "youtube_shorts");
  assert.equal(spec.effective_duration_sec, 20);
  assert.equal(spec.aspect_ratio, "9:16");
  assert.equal(spec.warnings.length, 0);
  assert.equal(spec.adjustments.length, 0);
});

test("clamps TikTok duration to the platform maximum and records a warning", async () => {
  const request = await loadFixture<EngineRequest>("tiktok-long-request.json");
  const normalized = normalizeRequest(request);
  const spec = resolvePlatformOutputSpec(normalized);

  assert.equal(spec.platform, "tiktok");
  assert.equal(spec.max_duration_sec, 45);
  assert.equal(spec.effective_duration_sec, 45);
  assert.match(spec.warnings.join(","), /duration_clamped_to_platform_max/);
  assert.equal(spec.adjustments[0]?.field, "duration_sec");
  assert.equal(spec.adjustments[0]?.from, 50);
  assert.equal(spec.adjustments[0]?.to, 45);
});

test("raises Instagram Reels duration to the platform minimum and records an adjustment", async () => {
  const request = await loadFixture<EngineRequest>("reels-short-request.json");
  const normalized = normalizeRequest(request);
  const spec = resolvePlatformOutputSpec(normalized);

  assert.equal(spec.platform, "instagram_reels");
  assert.equal(spec.min_duration_sec, 10);
  assert.equal(spec.effective_duration_sec, 10);
  assert.match(spec.warnings.join(","), /duration_raised_to_platform_min/);
  assert.equal(spec.adjustments[0]?.field, "duration_sec");
  assert.equal(spec.adjustments[0]?.from, 5);
  assert.equal(spec.adjustments[0]?.to, 10);
});
