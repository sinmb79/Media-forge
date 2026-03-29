import type {
  BrollPlan,
  LearningState,
  MotionPlan,
  NormalizedRequest,
  NovelShortsPlan,
  PlatformOutputSpec,
  PromptResult,
  RoutingDecision,
  ScoringResult,
} from "../domain/contracts.js";

export function buildPromptResult(input: {
  brollPlan: BrollPlan;
  effectiveRequest: NormalizedRequest;
  learningState: LearningState;
  motionPlan: MotionPlan;
  platformOutputSpec: PlatformOutputSpec;
  routing: RoutingDecision;
  scoring: ScoringResult;
  novelShortsPlan: NovelShortsPlan | null;
}): PromptResult {
  const {
    brollPlan,
    effectiveRequest,
    learningState,
    motionPlan,
    novelShortsPlan,
    platformOutputSpec,
    routing,
    scoring,
  } = input;
  const warnings = [
    ...platformOutputSpec.warnings,
    ...motionPlan.warnings,
    ...brollPlan.warnings,
    ...(learningState.confidence === "low" ? ["low_learning_confidence_uses_priors"] : []),
  ];

  return {
    schema_version: "0.1",
    engine: routing.selected_backend,
    main_prompt: buildMainPrompt(
      effectiveRequest,
      platformOutputSpec,
      motionPlan,
      brollPlan,
      novelShortsPlan,
    ),
    negative_prompt: "unsafe, graphic, policy-violating content",
    style_descriptor: [
      `${effectiveRequest.base.style.pacing_profile} pacing`,
      `${effectiveRequest.base.style.camera_language} camera`,
      `${effectiveRequest.base.intent.theme} tone`,
    ].join("; "),
    warnings,
    params: {
      aspect_ratio: platformOutputSpec.aspect_ratio,
      duration_sec: platformOutputSpec.effective_duration_sec,
    },
    quality_score: roundScore(
      (scoring.candidate_score + scoring.quality_tier_score) / 2,
    ),
  };
}

function buildMainPrompt(
  effectiveRequest: NormalizedRequest,
  platformOutputSpec: PlatformOutputSpec,
  motionPlan: MotionPlan,
  brollPlan: BrollPlan,
  novelShortsPlan: NovelShortsPlan | null,
): string {
  const sections = [
    `Scene: ${effectiveRequest.base.intent.topic}.`,
    `Subject: ${effectiveRequest.base.intent.subject}.`,
    `Goal: ${effectiveRequest.base.intent.goal}.`,
    `Emotion: ${effectiveRequest.base.intent.emotion}.`,
    `Theme: ${effectiveRequest.base.intent.theme}.`,
    `Platform: ${platformOutputSpec.platform}.`,
    `Hook motion: ${motionPlan.hook_motion.selected}.`,
    `Hook B-roll concept: ${brollPlan.segments[0]?.concept ?? "n/a"}.`,
  ];

  if (novelShortsPlan) {
    sections.push(`Novel highlight: ${novelShortsPlan.highlight_candidate}.`);
  }

  return sections.join(" ");
}

function roundScore(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
