import { test } from "node:test";
import * as assert from "node:assert/strict";

import { resolvePlanningContext } from "../../src/cli/resolve-planning-context.js";
import { buildPromptResult } from "../../src/prompt/build-prompt-result.js";
import { buildRenderPlan } from "../../src/render/build-render-plan.js";
import { buildPublishPlan } from "../../src/publish/build-publish-plan.js";
import type { EngineRequest } from "../../src/domain/contracts.js";
import { createRequestId } from "../../src/shared/request-id.js";
import { loadFixture } from "../helpers/load-fixture.js";

test("builds a platform-aware publish manifest from render output", async () => {
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

  const publishPlan = buildPublishPlan({
    effectiveRequest: planningContext.effective_request,
    platformOutputSpec: planningContext.platform_output_spec,
    promptResult,
    renderPlan,
  });

  assert.equal(publishPlan.schema_version, "0.1");
  assert.equal(publishPlan.platform, "youtube_shorts");
  assert.match(publishPlan.title, /AI meeting note tool/);
  assert.ok(publishPlan.hashtags.some((tag: string) => tag === "#explainer"));
  assert.equal(publishPlan.warnings.length >= 0, true);
});
