import { test } from "node:test";
import * as assert from "node:assert/strict";

import type { EngineRequest } from "../../src/domain/contracts.js";
import { loadFixture } from "../helpers/load-fixture.js";
import { validateEngineRequest } from "../../src/domain/request-schema.js";

test("validates a well-formed engine request fixture", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const result = validateEngineRequest(request);

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("returns validation_error when version is missing", () => {
  const result = validateEngineRequest({});

  assert.equal(result.valid, false);
  assert.equal(result.errors[0]?.code, "validation_error");
});

test("accepts optional learning_history when it is well formed", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  request.learning_history = {
    accepted_suggestions: 3,
    completed_outputs: 12,
    has_niche_history: false,
    rejected_suggestions: 1,
  };

  const result = validateEngineRequest(request);

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("accepts optional novel_project when it is well formed", async () => {
  const request = await loadFixture<EngineRequest>("novel-cliffhanger-request.json");

  const result = validateEngineRequest(request);

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});
