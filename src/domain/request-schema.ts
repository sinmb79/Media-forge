import type {
  BudgetTier,
  EngineRequest,
  Platform,
  PreferredEngine,
  QualityTier,
  ValidationResult,
} from "./contracts.js";
import { createEngineError } from "./errors.js";

const SUPPORTED_PLATFORMS = new Set<Platform>([
  "youtube_shorts",
  "tiktok",
  "instagram_reels",
]);
const SUPPORTED_BUDGET_TIERS = new Set<BudgetTier>(["low", "balanced", "high"]);
const SUPPORTED_QUALITY_TIERS = new Set<QualityTier>(["low", "balanced", "premium"]);
const SUPPORTED_ENGINES = new Set<PreferredEngine>([
  "cache",
  "local",
  "gpu",
  "sora",
  "premium",
]);

export function validateEngineRequest(value: unknown): ValidationResult {
  const errors = validateRequest(value);

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateRequest(value: unknown) {
  if (!isRecord(value)) {
    return [
      createEngineError(
        "validation_error",
        "Engine request must be an object.",
        "validate",
      ),
    ];
  }

  const errors = [
    ...validateString(value.version, "version"),
    ...validateIntent(value.intent),
    ...validateConstraints(value.constraints),
    ...validateStyle(value.style),
    ...validateBackend(value.backend),
    ...validateOutput(value.output),
    ...validateLearningHistory(value.learning_history),
    ...validateNovelProject(value.novel_project),
  ];

  return errors;
}

function validateIntent(value: unknown) {
  if (!isRecord(value)) {
    return [missingField("intent")];
  }

  return [
    ...validateString(value.topic, "intent.topic"),
    ...validateString(value.subject, "intent.subject"),
    ...validateString(value.goal, "intent.goal"),
    ...validateString(value.emotion, "intent.emotion"),
    ...validateEnum(value.platform, "intent.platform", SUPPORTED_PLATFORMS),
    ...validateString(value.theme, "intent.theme"),
    ...validateNumber(value.duration_sec, "intent.duration_sec"),
  ];
}

function validateConstraints(value: unknown) {
  if (!isRecord(value)) {
    return [missingField("constraints")];
  }

  return [
    ...validateString(value.language, "constraints.language"),
    ...validateEnum(value.budget_tier, "constraints.budget_tier", SUPPORTED_BUDGET_TIERS),
    ...validateEnum(
      value.quality_tier,
      "constraints.quality_tier",
      SUPPORTED_QUALITY_TIERS,
    ),
    ...validateBoolean(
      value.visual_consistency_required,
      "constraints.visual_consistency_required",
    ),
    ...validateBoolean(value.content_policy_safe, "constraints.content_policy_safe"),
  ];
}

function validateStyle(value: unknown) {
  if (!isRecord(value)) {
    return [missingField("style")];
  }

  return [
    ...validateString(value.hook_type, "style.hook_type"),
    ...validateString(value.pacing_profile, "style.pacing_profile"),
    ...validateString(value.caption_style, "style.caption_style"),
    ...validateString(value.camera_language, "style.camera_language"),
  ];
}

function validateBackend(value: unknown) {
  if (!isRecord(value)) {
    return [missingField("backend")];
  }

  const errors = [
    ...validateEnum(
      value.preferred_engine,
      "backend.preferred_engine",
      SUPPORTED_ENGINES,
    ),
    ...validateBoolean(value.allow_fallback, "backend.allow_fallback"),
  ];

  if (value.batch_size !== undefined) {
    errors.push(...validatePositiveInteger(value.batch_size, "backend.batch_size"));
  }

  if (value.gpu_available !== undefined) {
    errors.push(...validateBoolean(value.gpu_available, "backend.gpu_available"));
  }

  return errors;
}

function validateOutput(value: unknown) {
  if (!isRecord(value)) {
    return [missingField("output")];
  }

  return validateString(value.type, "output.type");
}

function validateLearningHistory(value: unknown) {
  if (typeof value === "undefined") {
    return [];
  }

  if (!isRecord(value)) {
    return [missingField("learning_history")];
  }

  return [
    ...validateNumber(value.completed_outputs, "learning_history.completed_outputs", true),
    ...validateNumber(value.accepted_suggestions, "learning_history.accepted_suggestions", true),
    ...validateNumber(value.rejected_suggestions, "learning_history.rejected_suggestions", true),
    ...validateOptionalBoolean(value.has_niche_history, "learning_history.has_niche_history"),
  ];
}

function validateNovelProject(value: unknown) {
  if (typeof value === "undefined") {
    return [];
  }

  if (!isRecord(value)) {
    return [missingField("novel_project")];
  }

  return [
    ...validateNovelMode(value.mode, "novel_project.mode"),
    ...validateNumber(value.episode_number, "novel_project.episode_number", true),
    ...validateString(value.scene_summary, "novel_project.scene_summary"),
    ...validateString(value.emotional_peak, "novel_project.emotional_peak"),
    ...validateRangeNumber(
      value.cliffhanger_strength,
      "novel_project.cliffhanger_strength",
      0,
      1,
    ),
    ...validateString(value.character_focus, "novel_project.character_focus"),
    ...validateString(value.visual_style_profile, "novel_project.visual_style_profile"),
  ];
}

function validateString(value: unknown, field: string) {
  if (typeof value === "string" && value.trim().length > 0) {
    return [];
  }

  return [missingField(field)];
}

function validateNumber(value: unknown, field: string, allowZero = false) {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    (allowZero ? value >= 0 : value > 0)
  ) {
    return [];
  }

  return [missingField(field)];
}

function validatePositiveInteger(value: unknown, field: string) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return [];
  }

  return [missingField(field)];
}

function validateBoolean(value: unknown, field: string) {
  if (typeof value === "boolean") {
    return [];
  }

  return [missingField(field)];
}

function validateOptionalBoolean(value: unknown, field: string) {
  if (typeof value === "undefined" || typeof value === "boolean") {
    return [];
  }

  return [missingField(field)];
}

function validateEnum<T extends string>(value: unknown, field: string, validValues: Set<T>) {
  if (typeof value === "string" && validValues.has(value as T)) {
    return [];
  }

  return [missingField(field)];
}

function validateNovelMode(value: unknown, field: string) {
  return validateEnum(
    value,
    field,
    new Set(["cliffhanger_short", "character_moment_short", "lore_worldbuilding_short"]),
  );
}

function validateRangeNumber(
  value: unknown,
  field: string,
  min: number,
  max: number,
) {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  ) {
    return [];
  }

  return [missingField(field)];
}

function missingField(field: string) {
  return createEngineError(
    "validation_error",
    `Missing or invalid field: ${field}`,
    "validate",
    {
      details: { field },
    },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isEngineRequest(value: unknown): value is EngineRequest {
  return validateEngineRequest(value).valid;
}
