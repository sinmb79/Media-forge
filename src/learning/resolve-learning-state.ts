import type {
  BrollPlan,
  LearningConfidence,
  LearningFallbackSource,
  LearningPhase,
  LearningState,
  MotionPlan,
  NormalizedRequest,
  PlatformOutputSpec,
} from "../domain/contracts.js";

export function resolveLearningState(
  normalizedRequest: NormalizedRequest,
  _platformOutputSpec: PlatformOutputSpec,
  _motionPlan: MotionPlan,
  _brollPlan: BrollPlan,
): LearningState {
  const history = normalizedRequest.base.learning_history;
  const completedOutputs = history?.completed_outputs ?? 0;
  const hasNicheHistory = history?.has_niche_history ?? false;
  const phase = resolvePhase(completedOutputs);
  const fallbackSources = resolveFallbackSources(phase, hasNicheHistory);
  const reasonCodes = resolveReasonCodes(phase, completedOutputs, fallbackSources.length > 0);

  return {
    phase,
    weights: resolveWeights(phase),
    threshold_status: {
      adaptive_enabled: completedOutputs >= 10,
      stronger_user_weighting_enabled: completedOutputs >= 30,
      auto_default_updates_enabled: completedOutputs >= 50,
    },
    confidence: resolveConfidence(completedOutputs),
    fallback_sources: fallbackSources,
    reason_codes: reasonCodes,
  };
}

function resolvePhase(completedOutputs: number): LearningPhase {
  if (completedOutputs >= 50) {
    return "personalized";
  }

  if (completedOutputs >= 10) {
    return "adaptive";
  }

  return "bootstrapped";
}

function resolveWeights(phase: LearningPhase): LearningState["weights"] {
  if (phase === "adaptive") {
    return { dataset: 0.5, user: 0.5 };
  }

  if (phase === "personalized") {
    return { dataset: 0.2, user: 0.8 };
  }

  return { dataset: 0.8, user: 0.2 };
}

function resolveConfidence(completedOutputs: number): LearningConfidence {
  if (completedOutputs >= 50) {
    return "high";
  }

  if (completedOutputs >= 10) {
    return "medium";
  }

  return "low";
}

function resolveFallbackSources(
  phase: LearningPhase,
  hasNicheHistory: boolean,
): LearningFallbackSource[] {
  const fallbackSources: LearningFallbackSource[] = [];

  if (phase === "bootstrapped" || phase === "adaptive") {
    fallbackSources.push("global_theme_priors", "platform_priors");
  }

  if (hasNicheHistory) {
    fallbackSources.push("niche_priors");
  }

  return Array.from(new Set(fallbackSources));
}

function resolveReasonCodes(
  phase: LearningPhase,
  completedOutputs: number,
  usesPriors: boolean,
): string[] {
  const reasonCodes: string[] = [];

  if (phase === "bootstrapped") {
    reasonCodes.push("learning_history_missing_or_below_adaptive_threshold");
  }

  if (completedOutputs >= 10) {
    reasonCodes.push("completed_outputs_reached_adaptive_threshold");
  }

  if (completedOutputs >= 30) {
    reasonCodes.push("completed_outputs_reached_stronger_user_weighting_threshold");
  }

  if (completedOutputs >= 50) {
    reasonCodes.push("completed_outputs_reached_personalized_threshold");
  }

  if (usesPriors) {
    reasonCodes.push("insufficient_history_uses_priors");
  }

  if (phase === "personalized") {
    reasonCodes.push("personalization_dominates_with_dataset_backstop");
  }

  return Array.from(new Set(reasonCodes));
}
