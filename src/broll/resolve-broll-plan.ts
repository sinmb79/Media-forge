import type {
  BrollConceptRecord,
  BrollPlan,
  BrollPlanSegment,
  MotionPlan,
  MotionSegmentRole,
  NormalizedRequest,
  Platform,
  PlatformOutputSpec,
} from "../domain/contracts.js";
import { BROLL_DATASET_VERSION, GENERIC_FALLBACK_CONCEPTS, getSeedConceptMap } from "./seed-concept-map.js";

interface EvaluatedConcept {
  concept: BrollConceptRecord;
  keywordScore: number;
  matchedSources: string[];
  platformFit: number;
  roleFit: number;
}

const TOKEN_PATTERN = /[^a-z0-9]+/g;

export function resolveBrollPlan(
  normalizedRequest: NormalizedRequest,
  platformOutputSpec: PlatformOutputSpec,
  motionPlan: MotionPlan,
): BrollPlan {
  const dataset = getSeedConceptMap();
  const warnings = new Set<string>();
  const tokensBySource = {
    emotion: tokenize(normalizedRequest.base.intent.emotion),
    goal: tokenize(normalizedRequest.base.intent.goal),
    theme: tokenize(normalizedRequest.base.intent.theme),
    topic: tokenize(normalizedRequest.base.intent.topic),
  };

  const segments = motionPlan.segments.map((segment) => {
    const selected = selectConceptForSegment(
      dataset,
      tokensBySource,
      platformOutputSpec.platform,
      segment.role,
    );

    if (selected.fallbackUsed) {
      warnings.add("generic_broll_fallback_used");
    }

    return {
      concept: selected.segment.concept,
      mood_tags: selected.segment.mood_tags,
      platform_suitability: selected.segment.platform_suitability,
      role: segment.role,
      segment_id: segment.segment_id,
      selection_reason_codes: selected.segment.selection_reason_codes,
      visual_metaphors: selected.segment.visual_metaphors,
    } satisfies BrollPlanSegment;
  });

  return {
    dataset_version: BROLL_DATASET_VERSION,
    warnings: Array.from(warnings).sort(),
    segments,
  };
}

function selectConceptForSegment(
  dataset: BrollConceptRecord[],
  tokensBySource: Record<"emotion" | "goal" | "theme" | "topic", string[]>,
  platform: Platform,
  role: MotionSegmentRole,
): { fallbackUsed: boolean; segment: BrollPlanSegment } {
  const evaluatedConcepts = dataset.map((concept) => {
    return evaluateConcept(concept, tokensBySource, platform, role);
  });
  const strongestConcept = evaluatedConcepts.sort(compareConcepts)[0];

  if (!strongestConcept || strongestConcept.keywordScore === 0) {
    const fallbackConceptName = GENERIC_FALLBACK_CONCEPTS[role];
    const fallbackConcept = dataset.find((concept) => concept.concept === fallbackConceptName);
    if (!fallbackConcept) {
      throw new Error(`Missing generic fallback concept: ${fallbackConceptName}`);
    }

    return {
      fallbackUsed: true,
      segment: {
        concept: fallbackConcept.concept,
        mood_tags: [...fallbackConcept.mood_tags],
        platform_suitability: [...fallbackConcept.platform_suitability],
        role,
        segment_id: role,
        selection_reason_codes: ["fallback_due_to_low_semantic_confidence"],
        visual_metaphors: [...fallbackConcept.visual_metaphors],
      },
    };
  }

  return {
    fallbackUsed: false,
    segment: {
      concept: strongestConcept.concept.concept,
      mood_tags: [...strongestConcept.concept.mood_tags],
      platform_suitability: [...strongestConcept.concept.platform_suitability],
      role,
      segment_id: role,
      selection_reason_codes: buildReasonCodes(strongestConcept),
      visual_metaphors: [...strongestConcept.concept.visual_metaphors],
    },
  };
}

function evaluateConcept(
  concept: BrollConceptRecord,
  tokensBySource: Record<"emotion" | "goal" | "theme" | "topic", string[]>,
  platform: Platform,
  role: MotionSegmentRole,
): EvaluatedConcept {
  const matchedSources: string[] = [];
  let keywordScore = 0;

  (Object.entries(tokensBySource) as Array<[keyof typeof tokensBySource, string[]]>).forEach(
    ([source, tokens]) => {
      const hasMatch = tokens.some((token) => concept.keyword_triggers.includes(token));
      if (hasMatch) {
        matchedSources.push(source);
        keywordScore += 1;
      }
    },
  );

  return {
    concept,
    keywordScore,
    matchedSources,
    platformFit: concept.platform_suitability.includes(platform) ? 1 : 0,
    roleFit: getRoleFit(role, concept.concept),
  };
}

function compareConcepts(left: EvaluatedConcept, right: EvaluatedConcept): number {
  if (right.keywordScore !== left.keywordScore) {
    return right.keywordScore - left.keywordScore;
  }

  if (right.platformFit !== left.platformFit) {
    return right.platformFit - left.platformFit;
  }

  if (right.roleFit !== left.roleFit) {
    return right.roleFit - left.roleFit;
  }

  return left.concept.concept.localeCompare(right.concept.concept);
}

function buildReasonCodes(evaluatedConcept: EvaluatedConcept): string[] {
  const reasonCodes = evaluatedConcept.matchedSources.map((source) => {
    return `matched_${source}_keyword`;
  });

  if (evaluatedConcept.platformFit > 0) {
    reasonCodes.push("platform_prefers_concept");
  }

  if (evaluatedConcept.roleFit > 0) {
    reasonCodes.push("role_prefers_concept");
  }

  return Array.from(new Set(reasonCodes));
}

function getRoleFit(role: MotionSegmentRole, concept: string): number {
  const hookConcepts = new Set(["ai", "focus", "speed", "surprise", "risk", "momentum"]);
  const bodyConcepts = new Set([
    "workflow",
    "comparison",
    "learning",
    "automation",
    "clarity",
    "simplicity",
    "planning",
  ]);
  const closerConcepts = new Set(["success", "growth", "change", "opportunity", "trust"]);

  if (role === "hook" && hookConcepts.has(concept)) {
    return 2;
  }

  if ((role === "body_1" || role === "body_2") && bodyConcepts.has(concept)) {
    return 2;
  }

  if (role === "closer" && closerConcepts.has(concept)) {
    return 2;
  }

  return 0;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(TOKEN_PATTERN)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}
