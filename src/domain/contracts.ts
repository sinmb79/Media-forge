export type Platform = "youtube_shorts" | "tiktok" | "instagram_reels";

export type BudgetTier = "low" | "balanced" | "high";

export type QualityTier = "low" | "balanced" | "premium";

export type PreferredEngine = "cache" | "local" | "gpu" | "sora" | "premium";
export type ExecutionBackend = "cache" | "local" | "gpu" | "sora" | "premium";

export interface EngineIntent {
  topic: string;
  subject: string;
  goal: string;
  emotion: string;
  platform: Platform;
  theme: string;
  duration_sec: number;
}

export interface EngineConstraints {
  language: string;
  budget_tier: BudgetTier;
  quality_tier: QualityTier;
  visual_consistency_required: boolean;
  content_policy_safe: boolean;
}

export interface EngineStyle {
  hook_type: string;
  pacing_profile: string;
  caption_style: string;
  camera_language: string;
}

export interface EngineBackend {
  preferred_engine: PreferredEngine;
  allow_fallback: boolean;
  batch_size?: number;
  gpu_available?: boolean;
}

export interface EngineOutput {
  type: string;
}

export interface LearningHistory {
  completed_outputs: number;
  accepted_suggestions: number;
  rejected_suggestions: number;
  has_niche_history?: boolean;
}

export type NovelShortMode =
  | "cliffhanger_short"
  | "character_moment_short"
  | "lore_worldbuilding_short";

export interface NovelProject {
  mode: NovelShortMode;
  episode_number: number;
  scene_summary: string;
  emotional_peak: string;
  cliffhanger_strength: number;
  character_focus: string;
  visual_style_profile: string;
}

export interface EngineRequest {
  version: string;
  intent: EngineIntent;
  constraints: EngineConstraints;
  style: EngineStyle;
  backend: EngineBackend;
  output: EngineOutput;
  learning_history?: LearningHistory;
  novel_project?: NovelProject;
}

export interface NormalizedRequestDerived {
  resolved_platform_profile: Platform;
  resolved_duration_sec: number;
  resolved_aspect_ratio: "9:16";
  premium_allowed: boolean;
}

export interface NormalizedRequest {
  base: EngineRequest;
  derived: NormalizedRequestDerived;
}

export type PlatformWarningCode =
  | "duration_raised_to_platform_min"
  | "duration_clamped_to_platform_max";

export interface PlatformAdjustment {
  field: "duration_sec";
  from: number;
  to: number;
  reason_code: PlatformWarningCode;
}

export interface PlatformOutputSpec {
  platform: Platform;
  resolution: "1080x1920";
  fps: 30;
  aspect_ratio: "9:16";
  safe_zone: "center_safe_vertical";
  caption_position: "lower_third";
  title_style: string;
  hashtag_style: string;
  cta_style: string;
  metadata_style: string;
  qa_emphasis: string[];
  recommended_duration_sec: number;
  min_duration_sec: number;
  max_duration_sec: number;
  effective_duration_sec: number;
  warnings: PlatformWarningCode[];
  adjustments: PlatformAdjustment[];
}

export type MotionName =
  | "zoom_in"
  | "zoom_out"
  | "pan_left"
  | "pan_right"
  | "parallax"
  | "rotate_slow"
  | "glitch_transition";

export type MotionEnergy = "high" | "medium" | "low";

export type MotionStrength = "strong" | "medium" | "soft";

export type MotionLoopRisk = "high" | "medium" | "low";

export type MotionPanDirection = "left" | "right" | "none";

export type MotionIntensity = "high" | "medium" | "low";

export type MotionSegmentRole = "hook" | "body_1" | "body_2" | "closer";

export interface MotionSegment {
  segment_id: MotionSegmentRole;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  role: MotionSegmentRole;
}

export interface MotionAssignment {
  segment_id: MotionSegmentRole;
  motion: MotionName;
  duration_sec: number;
  intensity: MotionIntensity;
  reason_codes: string[];
}

export interface HookMotionSummary {
  required: boolean;
  selected: MotionName;
  reason_codes: string[];
}

export interface AntiRepetitionState {
  recent_motions: MotionName[];
  blocked_motions: MotionName[];
  applied_rules: string[];
}

export interface MotionPlan {
  schema_version: string;
  platform: Platform;
  theme: string;
  loop_flag: boolean;
  segments: MotionSegment[];
  motion_sequence: MotionAssignment[];
  hook_motion: HookMotionSummary;
  anti_repetition_state: AntiRepetitionState;
  warnings: string[];
}

export interface BrollConceptRecord {
  concept: string;
  visual_metaphors: string[];
  mood_tags: string[];
  platform_suitability: Platform[];
  keyword_triggers: string[];
}

export interface BrollPlanSegment {
  segment_id: MotionSegmentRole;
  role: MotionSegmentRole;
  concept: string;
  visual_metaphors: string[];
  mood_tags: string[];
  platform_suitability: Platform[];
  selection_reason_codes: string[];
}

export interface BrollPlan {
  dataset_version: string;
  warnings: string[];
  segments: BrollPlanSegment[];
}

export type LearningPhase = "bootstrapped" | "adaptive" | "personalized";

export type LearningConfidence = "low" | "medium" | "high";

export type LearningFallbackSource =
  | "global_theme_priors"
  | "niche_priors"
  | "platform_priors";

export interface LearningWeights {
  dataset: number;
  user: number;
}

export interface LearningThresholdStatus {
  adaptive_enabled: boolean;
  stronger_user_weighting_enabled: boolean;
  auto_default_updates_enabled: boolean;
}

export interface LearningState {
  phase: LearningPhase;
  weights: LearningWeights;
  threshold_status: LearningThresholdStatus;
  confidence: LearningConfidence;
  fallback_sources: LearningFallbackSource[];
  reason_codes: string[];
}

export type NovelQaLevel = "low" | "medium" | "high";

export interface NovelQaFlags {
  scene_coherence: NovelQaLevel;
  spoiler_risk: NovelQaLevel;
  emotional_payoff: NovelQaLevel;
  continuity_with_series_tone: NovelQaLevel;
}

export interface NovelIntentOverrides {
  goal?: string;
  emotion?: string;
  theme?: string;
  duration_sec?: number;
}

export interface NovelShortsPlan {
  mode: NovelShortMode;
  highlight_candidate: string;
  hook_builder: string;
  shorts_script_outline: string[];
  qa_flags: NovelQaFlags;
  intent_overrides: NovelIntentOverrides;
}

export interface PromptResultParams {
  aspect_ratio: "9:16";
  duration_sec: number;
}

export interface PromptResult {
  schema_version: string;
  engine: string;
  main_prompt: string;
  negative_prompt: string;
  style_descriptor: string;
  warnings: string[];
  params: PromptResultParams;
  quality_score: number;
}

export interface CommandProfileSummary {
  profile_id: string;
  description: string;
  platform: Platform;
  theme: string;
  tags: string[];
}

export interface ConfigResult {
  schema_version: string;
  config_version: string;
  default_profile: string;
  profiles: CommandProfileSummary[];
  supported_commands: string[];
}

export interface CreateResult {
  schema_version: string;
  profile: string;
  output_path: string;
  request: EngineRequest;
}

export interface AnalyzeReadiness {
  prompt: boolean;
  render: boolean;
  publish: boolean;
}

export interface AnalyzeRiskSummary {
  quality_score: number;
  cost_risk_score: number;
  learning_confidence: LearningConfidence;
}

export interface AnalyzeResult {
  schema_version: string;
  request_id: string;
  readiness: AnalyzeReadiness;
  risk_summary: AnalyzeRiskSummary;
  warning_count: number;
  recommended_backend: ExecutionBackend;
}

export interface RenderPlanSegment {
  segment_id: MotionSegmentRole;
  duration_sec: number;
  motion: MotionName;
  broll_concept: string;
}

export interface RenderPlanAssetManifest {
  prompt_engine: ExecutionBackend;
  caption_style: string;
  camera_language: string;
  placeholder_assets: string[];
}

export interface RenderPlan {
  schema_version: string;
  render_id: string;
  engine: ExecutionBackend;
  output_filename: string;
  segments: RenderPlanSegment[];
  asset_manifest: RenderPlanAssetManifest;
  qa_checklist: string[];
  warnings: string[];
}

export interface PublishPlan {
  schema_version: string;
  publish_id: string;
  platform: Platform;
  title: string;
  description: string;
  hashtags: string[];
  cta: string;
  upload_checklist: string[];
  warnings: string[];
}

export type DoctorStatus = "ok" | "warning" | "error";

export interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  message: string;
}

export interface DoctorResult {
  schema_version: string;
  status: DoctorStatus;
  checks: DoctorCheck[];
  warnings: string[];
}

export interface ScoringResult {
  candidate_score: number;
  quality_tier_score: number;
  premium_eligibility_score: number;
  cost_risk_score: number;
}

export type PremiumAllowedStep =
  | "final_script_refinement"
  | "premium_tts"
  | "high_value_video_generation"
  | "final_polish";

export interface RoutingDecision {
  selected_backend: ExecutionBackend;
  fallback_backend: Exclude<ExecutionBackend, "cache"> | null;
  premium_allowed: boolean;
  premium_allowed_steps: PremiumAllowedStep[];
  reason_codes: string[];
}

export type ExecutionNodeType =
  | "policy"
  | "adapter"
  | "formatter"
  | "quality"
  | "candidate";

export interface ExecutionPlanNode {
  node_id: string;
  node_type: ExecutionNodeType;
  backend: ExecutionBackend;
  estimated_cost: number;
  actual_cost: number;
  retry_cost: number;
  cost_efficiency_score: number;
  retry_count: number;
  fallback_node: string | null;
  skip_allowed: boolean;
  failure_severity: ErrorSeverity;
}

export interface ExecutionPlan {
  nodes: ExecutionPlanNode[];
  edges: [string, string][];
}

export type PipelineStatus =
  | "success"
  | "success_with_fallback"
  | "partial_success"
  | "blocked"
  | "skipped_low_priority";

export interface RecoveryPath {
  trigger_node: string;
  failure_code: PolicyNodeErrorCode;
  attempts: string[];
  final_status: PipelineStatus;
}

export interface RecoverySimulation {
  normal_path: string[];
  recovery_paths: RecoveryPath[];
}

export interface EngineRunResult {
  schema_version: string;
  request_id: string;
  validation: ValidationResult;
  normalized_request: NormalizedRequest | null;
  platform_output_spec: PlatformOutputSpec | null;
  novel_shorts_plan: NovelShortsPlan | null;
  motion_plan: MotionPlan | null;
  broll_plan: BrollPlan | null;
  learning_state: LearningState | null;
  scoring: ScoringResult | null;
  routing: RoutingDecision | null;
  execution_plan: ExecutionPlan | null;
  recovery_simulation: RecoverySimulation | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: EngineError[];
}

export type PipelineStage =
  | "validate"
  | "normalize"
  | "resolve_novel_shorts_plan"
  | "resolve_motion_plan"
  | "resolve_broll_plan"
  | "resolve_learning_state"
  | "score"
  | "route"
  | "build_execution_plan"
  | "simulate_recovery"
  | "render_output";

export type PipelineErrorCode =
  | "validation_error"
  | "normalization_error"
  | "novel_pipeline_error"
  | "motion_planning_error"
  | "broll_planning_error"
  | "learning_state_error"
  | "scoring_error"
  | "routing_error"
  | "plan_build_error"
  | "simulation_error";

export type PolicyNodeErrorCode =
  | "timeout"
  | "unavailable_backend"
  | "policy_blocked"
  | "cost_limit_exceeded"
  | "quality_below_threshold";

export type EngineErrorCode = PipelineErrorCode | PolicyNodeErrorCode;

export type ErrorSeverity = "info" | "warning" | "error";

export interface EngineError {
  code: EngineErrorCode;
  message: string;
  stage: PipelineStage;
  node_id: string | null;
  severity: ErrorSeverity;
  retryable: boolean;
  details: Record<string, unknown>;
}
