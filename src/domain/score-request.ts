import type { NormalizedRequest, ScoringResult } from "./contracts.js";

export function scoreRequest(request: NormalizedRequest): ScoringResult {
  const budgetScore =
    request.base.constraints.budget_tier === "high"
      ? 0.2
      : request.base.constraints.budget_tier === "balanced"
        ? 0.14
        : 0.04;

  // qualityScore reflects cost-risk contribution to candidate_score:
  //   balanced (0.12) > low (0.08) > premium (0.06)
  // Premium requests carry the highest generation cost risk, so they contribute
  // least. Low-tier requests lack budget headroom to retry, so they contribute
  // less than balanced. Balanced is the most cost-efficient operating point.
  const qualityScore =
    request.base.constraints.quality_tier === "premium"
      ? 0.06
      : request.base.constraints.quality_tier === "balanced"
        ? 0.12
        : 0.08;

  const preferenceScore =
    request.base.backend.preferred_engine === "sora"
      ? 0.08
      : request.base.backend.preferred_engine === "gpu"
        ? 0.06
        : 0.03;

  const consistencyScore = request.base.constraints.visual_consistency_required
    ? 0.05
    : 0;
  const safetyScore = request.base.constraints.content_policy_safe ? 0.05 : 0;

  const candidateScore = roundScore(
    0.25 + budgetScore + qualityScore + preferenceScore + consistencyScore + safetyScore,
  );

  const qualityTierScore =
    request.base.constraints.quality_tier === "premium"
      ? 0.9
      : request.base.constraints.quality_tier === "balanced"
        ? 0.68
        : 0.45;

  const premiumEligibilityScore = request.derived.premium_allowed
    ? roundScore(candidateScore + 0.15)
    : roundScore(candidateScore - 0.1);

  const costRiskScore =
    request.base.backend.preferred_engine === "sora"
      ? request.base.constraints.budget_tier === "low"
        ? 0.8
        : 0.56
      : 0.2;

  return {
    candidate_score: candidateScore,
    quality_tier_score: qualityTierScore,
    premium_eligibility_score: premiumEligibilityScore,
    cost_risk_score: costRiskScore,
  };
}

function roundScore(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
