import { test } from "node:test";
import * as assert from "node:assert/strict";

import type { EngineRequest, ExecutionPlan } from "../../src/domain/contracts.js";
import { normalizeRequest } from "../../src/domain/normalize-request.js";
import { routeRequest } from "../../src/domain/route-request.js";
import { scoreRequest } from "../../src/domain/score-request.js";
import { buildExecutionPlan } from "../../src/simulation/build-execution-plan.js";
import { simulateRecovery } from "../../src/simulation/simulate-recovery.js";
import { loadFixture } from "../helpers/load-fixture.js";

test("returns normal and recovery paths for fallback fixtures", async () => {
  const request = await loadFixture<EngineRequest>("fallback-path-request.json");
  const normalized = normalizeRequest(request);
  const scoring = scoreRequest(normalized);
  const routing = routeRequest(normalized, scoring);
  const plan = buildExecutionPlan(normalized, routing);
  const recovery = simulateRecovery(plan);

  assert.ok(recovery.normal_path.length > 0);
  assert.ok(recovery.recovery_paths.length > 0);
  assert.equal(recovery.recovery_paths[0]?.trigger_node, "tool_adapter");
});

test("does not emit fallback recovery paths when fallback is disabled", async () => {
  const request = await loadFixture<EngineRequest>("no-fallback-request.json");
  const normalized = normalizeRequest(request);
  const scoring = scoreRequest(normalized);
  const routing = routeRequest(normalized, scoring);
  const plan = buildExecutionPlan(normalized, routing);
  const recovery = simulateRecovery(plan);

  assert.equal(recovery.recovery_paths.length, 0);
});

test("Rule E: skips retry when retry_cost > cost_efficiency_score", () => {
  const plan: ExecutionPlan = {
    nodes: [
      {
        node_id: "test_node",
        node_type: "candidate",
        backend: "local",
        estimated_cost: 0.05,
        actual_cost: 0,
        retry_cost: 0.9,
        cost_efficiency_score: 0.5,
        retry_count: 2,
        fallback_node: "test_fallback",
        skip_allowed: false,
        failure_severity: "error",
      },
      {
        node_id: "test_fallback",
        node_type: "candidate",
        backend: "local",
        estimated_cost: 0.05,
        actual_cost: 0,
        retry_cost: 0.02,
        cost_efficiency_score: 0.95,
        retry_count: 0,
        fallback_node: null,
        skip_allowed: true,
        failure_severity: "warning",
      },
    ],
    edges: [["test_node", "test_fallback"]],
  };

  const recovery = simulateRecovery(plan);
  const path = recovery.recovery_paths.find((p) => p.trigger_node === "test_node");

  assert.ok(path, "recovery path for test_node should exist");
  assert.ok(
    path.attempts.includes("skip_retry:cost_exceeds_value"),
    "should include skip_retry marker",
  );
  assert.ok(
    !path.attempts.some((a) => a.startsWith("retry:test_node")),
    "should NOT include retry entry",
  );
});

test("Rule E: keeps retry when retry_cost <= cost_efficiency_score", () => {
  const plan: ExecutionPlan = {
    nodes: [
      {
        node_id: "cheap_node",
        node_type: "candidate",
        backend: "local",
        estimated_cost: 0.05,
        actual_cost: 0,
        retry_cost: 0.1,
        cost_efficiency_score: 0.95,
        retry_count: 3,
        fallback_node: "cheap_fallback",
        skip_allowed: false,
        failure_severity: "error",
      },
      {
        node_id: "cheap_fallback",
        node_type: "candidate",
        backend: "local",
        estimated_cost: 0.05,
        actual_cost: 0,
        retry_cost: 0.02,
        cost_efficiency_score: 0.95,
        retry_count: 0,
        fallback_node: null,
        skip_allowed: true,
        failure_severity: "warning",
      },
    ],
    edges: [["cheap_node", "cheap_fallback"]],
  };

  const recovery = simulateRecovery(plan);
  const path = recovery.recovery_paths.find((p) => p.trigger_node === "cheap_node");

  assert.ok(path, "recovery path for cheap_node should exist");
  assert.ok(
    path.attempts.some((a) => a.startsWith("retry:cheap_node")),
    "should include retry entry",
  );
  assert.ok(
    !path.attempts.includes("skip_retry:cost_exceeds_value"),
    "should NOT include skip_retry marker",
  );
});
