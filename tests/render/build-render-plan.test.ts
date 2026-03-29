import { test } from "node:test";
import * as assert from "node:assert/strict";

import { resolvePlanningContext } from "../../src/cli/resolve-planning-context.js";
import { buildPromptResult } from "../../src/prompt/build-prompt-result.js";
import { buildRenderPlan } from "../../src/render/build-render-plan.js";
import type { EngineRequest } from "../../src/domain/contracts.js";
import { createRequestId } from "../../src/shared/request-id.js";
import { loadFixture } from "../helpers/load-fixture.js";

test("builds a render manifest aligned to motion and b-roll segments", async () => {
  const request = await loadFixture<EngineRequest>("valid-low-cost-request.json");
  const planningContext = resolvePlanningContext(request);
  const promptResult = buildPromptResult({
    brollPlan: planningContext.broll_plan,
    effectiveRequest: planningContext.effective_request,
    learningState: planningContext.learning_state,
    motionPlan: planningContext.motion_plan,
    novelShortsPlan: planningContext.novel_shorts_plan,
    platformOutputSpec: planningContext.platform_output_spec,
    routing: planningContext.routing,
    scoring: planningContext.scoring,
  });

  const renderPlan = buildRenderPlan({
    requestId: createRequestId(request),
    brollPlan: planningContext.broll_plan,
    effectiveRequest: planningContext.effective_request,
    motionPlan: planningContext.motion_plan,
    promptResult,
    routing: planningContext.routing,
    platformOutputSpec: planningContext.platform_output_spec,
  });

  assert.equal(renderPlan.schema_version, "0.1");
  assert.equal(renderPlan.engine, "local");
  assert.match(renderPlan.output_filename, /\.mp4$/);
  assert.equal(renderPlan.segments[0]?.segment_id, "hook");
  assert.equal(renderPlan.segments[0]?.motion, "zoom_in");
  assert.equal(renderPlan.segments[0]?.broll_concept, "ai");
});
