import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { VideoGenerationAdapter } from "../../../src/adapters/video/video-generation-adapter.js";
import {
  executeVideoGeneration,
  buildPromptFromPlanningContext,
} from "../../../src/execute/execute-video-generation.js";
import { loadFixture } from "../../helpers/load-fixture.js";
import type { EngineRequest } from "../../../src/domain/contracts.js";
import { resolvePlanningContext } from "../../../src/cli/resolve-planning-context.js";

function makeMockAdapter(name: string): VideoGenerationAdapter {
  return {
    name,
    async isAvailable() { return true; },
    async generate(_prompt, _opts) {
      return { status: "dry_run", metadata: { adapter: name } };
    },
  };
}

test("executeVideoGeneration returns result for all nodes", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const context = resolvePlanningContext(request);
  const mockAdapter = makeMockAdapter("mock");

  const result = await executeVideoGeneration(context, {
    dry_run: true,
    resolveAdapter: async () => mockAdapter,
  });

  assert.equal(result.dry_run, true);
  assert.ok(result.nodes.length > 0);
  assert.ok(result.summary.total > 0);
  assert.equal(result.summary.error, 0);
});

test("executeVideoGeneration summary counts dry_run correctly", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const context = resolvePlanningContext(request);
  const mockAdapter = makeMockAdapter("mock");

  const result = await executeVideoGeneration(context, {
    dry_run: true,
    resolveAdapter: async () => mockAdapter,
  });

  assert.equal(result.summary.dry_run, result.nodes.length);
  assert.equal(result.summary.success, 0);
});

test("buildPromptFromPlanningContext returns valid prompt", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const context = resolvePlanningContext(request);

  const prompt = buildPromptFromPlanningContext(context);

  assert.equal(typeof prompt.text_prompt, "string");
  assert.ok(prompt.text_prompt.length > 0);
  assert.equal(typeof prompt.duration_sec, "number");
  assert.equal(prompt.aspect_ratio, "9:16");
  assert.ok(Array.isArray(prompt.style_tags));
});
