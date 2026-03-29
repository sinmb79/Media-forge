import type {
  AnalyzeResult,
  LearningState,
  MotionPlan,
  PlatformOutputSpec,
  RoutingDecision,
  ScoringResult,
} from "../domain/contracts.js";

export function buildAnalysisReport(input: {
  requestId: string;
  learningState: LearningState;
  motionPlan: MotionPlan;
  platformOutputSpec: PlatformOutputSpec;
  routing: RoutingDecision;
  scoring: ScoringResult;
}): AnalyzeResult {
  const {
    requestId,
    learningState,
    motionPlan,
    platformOutputSpec,
    routing,
    scoring,
  } = input;

  return {
    schema_version: "0.1",
    request_id: requestId,
    readiness: {
      prompt: true,
      render: motionPlan.motion_sequence.length > 0,
      publish: platformOutputSpec.warnings.length < 5,
    },
    risk_summary: {
      quality_score: roundScore((scoring.candidate_score + scoring.quality_tier_score) / 2),
      cost_risk_score: scoring.cost_risk_score,
      learning_confidence: learningState.confidence,
    },
    warning_count: platformOutputSpec.warnings.length + motionPlan.warnings.length,
    recommended_backend: routing.selected_backend,
  };
}

function roundScore(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
