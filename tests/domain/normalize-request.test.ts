import { test } from "node:test";
import * as assert from "node:assert/strict";

import type { EngineRequest } from "../../src/domain/contracts.js";
import { normalizeRequest } from "../../src/domain/normalize-request.js";
import { loadFixture } from "../helpers/load-fixture.js";

test("normalizes request into base and derived fields", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const normalized = normalizeRequest(request);

  assert.equal(normalized.base.intent.platform, "youtube_shorts");
  assert.equal(normalized.derived.resolved_platform_profile, "youtube_shorts");
  assert.equal(normalized.derived.resolved_aspect_ratio, "9:16");
  assert.equal(normalized.derived.resolved_duration_sec, 20);
  assert.equal(normalized.derived.premium_allowed, false);
});
