import type {
  BrollPlan,
  EngineRequest,
  ExecutionPlan,
  LearningState,
  MotionPlan,
  NormalizedRequest,
  NovelShortsPlan,
  PlatformOutputSpec,
  RecoverySimulation,
  RoutingDecision,
  ScoringResult,
} from "../domain/contracts.js";
import { normalizeRequest } from "../domain/normalize-request.js";
import { routeRequest } from "../domain/route-request.js";
import { scoreRequest } from "../domain/score-request.js";
import { resolveLearningState } from "../learning/resolve-learning-state.js";
import { resolveMotionPlan } from "../motion/resolve-motion-plan.js";
import {
  applyNovelIntentOverrides,
  resolveNovelShortsPlan,
} from "../novel/resolve-novel-shorts-plan.js";
import { resolvePlatformOutputSpec } from "../platform/resolve-platform-output-spec.js";
import { buildExecutionPlan } from "../simulation/build-execution-plan.js";
import { simulateRecovery } from "../simulation/simulate-recovery.js";
import { resolveBrollPlan } from "../broll/resolve-broll-plan.js";

export interface PlanningContext {
  normalized_request: NormalizedRequest;
  effective_request: NormalizedRequest;
  novel_shorts_plan: NovelShortsPlan | null;
  platform_output_spec: PlatformOutputSpec;
  motion_plan: MotionPlan;
  broll_plan: BrollPlan;
  learning_state: LearningState;
  scoring: ScoringResult;
  routing: RoutingDecision;
  execution_plan: ExecutionPlan;
  recovery_simulation: RecoverySimulation;
}

export function resolvePlanningContext(request: EngineRequest): PlanningContext {
  const normalizedRequest = normalizeRequest(request);
  const novelShortsPlan = resolveNovelShortsPlan(normalizedRequest);
  const effectiveRequest = applyNovelIntentOverrides(normalizedRequest, novelShortsPlan);
  const platformOutputSpec = resolvePlatformOutputSpec(effectiveRequest);
  const motionPlan = resolveMotionPlan(effectiveRequest, platformOutputSpec);
  const brollPlan = resolveBrollPlan(effectiveRequest, platformOutputSpec, motionPlan);
  const learningState = resolveLearningState(
    effectiveRequest,
    platformOutputSpec,
    motionPlan,
    brollPlan,
  );
  const scoring = scoreRequest(effectiveRequest);
  const routing = routeRequest(effectiveRequest, scoring);
  const executionPlan = buildExecutionPlan(effectiveRequest, routing);
  const recoverySimulation = simulateRecovery(executionPlan);

  return {
    normalized_request: normalizedRequest,
    effective_request: effectiveRequest,
    novel_shorts_plan: novelShortsPlan,
    platform_output_spec: platformOutputSpec,
    motion_plan: motionPlan,
    broll_plan: brollPlan,
    learning_state: learningState,
    scoring,
    routing,
    execution_plan: executionPlan,
    recovery_simulation: recoverySimulation,
  };
}
