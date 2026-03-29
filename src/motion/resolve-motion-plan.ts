import type {
  MotionAssignment,
  MotionIntensity,
  MotionName,
  MotionPlan,
  MotionSegment,
  MotionSegmentRole,
  NormalizedRequest,
  PlatformOutputSpec,
} from "../domain/contracts.js";
import {
  COMMON_MOTION_RULES,
  MOTION_METADATA,
  getAllowedMotionsForRole,
  getPacingWeight,
  getPlatformWeight,
  getRoleWeight,
  getThemeWeight,
} from "./motion-rule-table.js";

const HOOK_DURATION_SEC = 3;
const BODY_DURATION_SEC = 4;
const MAX_MOTION_WINDOW_SEC = 5;
const FAST_CUT_MOTIONS = new Set<MotionName>([
  "zoom_in",
  "pan_left",
  "pan_right",
  "glitch_transition",
]);
const DIRECT_HOOK_MOTIONS = new Set<MotionName>(["zoom_in", "pan_left", "pan_right"]);
const POLISHED_MOTIONS = new Set<MotionName>(["parallax", "rotate_slow", "zoom_out"]);
const LOOP_RISK_RANK = {
  high: 2,
  low: 0,
  medium: 1,
} as const;

interface EvaluatedCandidate {
  motion: MotionName;
  score: number;
  platformWeight: number;
  repetitionConflicts: number;
  blockedRules: string[];
}

interface SelectionState {
  blockedMotions: Set<MotionName>;
  appliedRules: Set<string>;
  warnings: string[];
}

export function resolveMotionPlan(
  normalizedRequest: NormalizedRequest,
  platformOutputSpec: PlatformOutputSpec,
): MotionPlan {
  const loopFlag = normalizedRequest.base.output.type === "loop_video_prompt";
  const theme = normalizedRequest.base.intent.theme;
  const pacingProfile = normalizedRequest.base.style.pacing_profile;
  const segments = buildSegments(platformOutputSpec.effective_duration_sec);
  const state: SelectionState = {
    blockedMotions: new Set<MotionName>(),
    appliedRules: new Set<string>(),
    warnings: [],
  };
  const recentMotions: MotionName[] = [];
  const motionSequence = segments.map((segment) => {
    const assignment = selectMotionForSegment(
      segment,
      platformOutputSpec.platform,
      theme,
      pacingProfile,
      loopFlag,
      recentMotions,
      state,
    );

    recentMotions.push(assignment.motion);
    if (recentMotions.length > 2) {
      recentMotions.shift();
    }

    return assignment;
  });
  const hookAssignment =
    motionSequence[0] ??
    createAssignment("zoom_in", segments[0] ?? createFallbackHookSegment(), platformOutputSpec.platform, pacingProfile, [
      "hook_requires_strong_motion_event",
    ]);

  return {
    schema_version: "0.1",
    platform: platformOutputSpec.platform,
    theme,
    loop_flag: loopFlag,
    segments,
    motion_sequence: motionSequence,
    hook_motion: {
      required: true,
      selected: hookAssignment.motion,
      reason_codes: [...hookAssignment.reason_codes],
    },
    anti_repetition_state: {
      recent_motions: [...recentMotions],
      blocked_motions: Array.from(state.blockedMotions).sort(),
      applied_rules: Array.from(state.appliedRules).sort(),
    },
    warnings: collectWarnings(segments, state.warnings),
  };
}

function buildSegments(totalDurationSec: number): MotionSegment[] {
  const segments: MotionSegment[] = [];
  let cursor = 0;

  const hookDuration = Math.min(HOOK_DURATION_SEC, totalDurationSec);
  pushSegment(segments, "hook", cursor, hookDuration);
  cursor += hookDuration;

  const bodyOneDuration = Math.min(BODY_DURATION_SEC, Math.max(totalDurationSec - cursor, 0));
  if (bodyOneDuration > 0) {
    pushSegment(segments, "body_1", cursor, bodyOneDuration);
    cursor += bodyOneDuration;
  }

  const bodyTwoDuration = Math.min(BODY_DURATION_SEC, Math.max(totalDurationSec - cursor, 0));
  if (bodyTwoDuration > 0) {
    pushSegment(segments, "body_2", cursor, bodyTwoDuration);
    cursor += bodyTwoDuration;
  }

  const closerDuration = Math.max(totalDurationSec - cursor, 0);
  if (closerDuration > 0) {
    pushSegment(segments, "closer", cursor, closerDuration);
  }

  return segments;
}

function pushSegment(
  segments: MotionSegment[],
  role: MotionSegmentRole,
  startSec: number,
  durationSec: number,
) {
  segments.push({
    segment_id: role,
    start_sec: startSec,
    end_sec: startSec + durationSec,
    duration_sec: durationSec,
    role,
  });
}

function selectMotionForSegment(
  segment: MotionSegment,
  platform: PlatformOutputSpec["platform"],
  theme: string,
  pacingProfile: string,
  loopFlag: boolean,
  recentMotions: MotionName[],
  state: SelectionState,
): MotionAssignment {
  const evaluatedCandidates = getAllowedMotionsForRole(segment.role).map((motion) => {
    return evaluateCandidate(
      motion,
      segment,
      platform,
      theme,
      pacingProfile,
      loopFlag,
      recentMotions,
    );
  });
  const eligibleCandidates = evaluatedCandidates.filter((candidate) => {
    if (candidate.blockedRules.length === 0) {
      return true;
    }

    state.blockedMotions.add(candidate.motion);
    candidate.blockedRules.forEach((rule) => state.appliedRules.add(rule));
    return false;
  });

  if (eligibleCandidates.length === 0) {
    const fallbackMotion = getAllowedMotionsForRole(segment.role)[0] ?? "zoom_in";
    state.warnings.push(`motion_fallback_used:${segment.segment_id}`);

    return createAssignment(
      fallbackMotion,
      segment,
      platform,
      pacingProfile,
      [],
    );
  }

  const selectedCandidate = eligibleCandidates.sort(compareCandidates)[0];
  if (!selectedCandidate) {
    return createAssignment("zoom_in", segment, platform, pacingProfile, [
      "motion_fallback_used",
    ]);
  }
  const appliedReasonCodes = [
    ...selectedCandidate.blockedRules,
    ...buildReasonCodes(selectedCandidate.motion, segment, platform, pacingProfile),
  ];

  return createAssignment(
    selectedCandidate.motion,
    segment,
    platform,
    pacingProfile,
    appliedReasonCodes,
  );
}

function evaluateCandidate(
  motion: MotionName,
  segment: MotionSegment,
  platform: PlatformOutputSpec["platform"],
  theme: string,
  pacingProfile: string,
  loopFlag: boolean,
  recentMotions: MotionName[],
): EvaluatedCandidate {
  const blockedRules: string[] = [];

  if (
    loopFlag &&
    motion === "glitch_transition"
  ) {
    blockedRules.push("loop_avoids_excessive_glitch_motion");
  }

  if (
    recentMotions.length >= 2 &&
    recentMotions[0] === motion &&
    recentMotions[1] === motion
  ) {
    blockedRules.push("same_motion_cannot_repeat_3_times");
  }

  if (wouldRepeatPanDirection(recentMotions, motion)) {
    blockedRules.push("same_pan_direction_cannot_repeat_more_than_2_times");
  }

  return {
    motion,
    score:
      getPlatformWeight(platform, motion) +
      getThemeWeight(theme, motion) +
      getPacingWeight(pacingProfile, motion) +
      getRoleWeight(segment.role, motion),
    platformWeight: getPlatformWeight(platform, motion),
    repetitionConflicts: countRepetitionConflicts(recentMotions, motion),
    blockedRules,
  };
}

function compareCandidates(left: EvaluatedCandidate, right: EvaluatedCandidate): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (left.repetitionConflicts !== right.repetitionConflicts) {
    return left.repetitionConflicts - right.repetitionConflicts;
  }

  if (right.platformWeight !== left.platformWeight) {
    return right.platformWeight - left.platformWeight;
  }

  const leftLoopRisk = LOOP_RISK_RANK[MOTION_METADATA[left.motion].loop_risk];
  const rightLoopRisk = LOOP_RISK_RANK[MOTION_METADATA[right.motion].loop_risk];
  if (leftLoopRisk !== rightLoopRisk) {
    return leftLoopRisk - rightLoopRisk;
  }

  return left.motion.localeCompare(right.motion);
}

function createAssignment(
  motion: MotionName,
  segment: MotionSegment,
  platform: PlatformOutputSpec["platform"],
  pacingProfile: string,
  reasonCodes: string[],
): MotionAssignment {
  return {
    segment_id: segment.segment_id,
    motion,
    duration_sec: segment.duration_sec,
    intensity: deriveIntensity(motion, segment.role),
    reason_codes: dedupeReasonCodes(
      reasonCodes.length > 0
        ? reasonCodes
        : buildReasonCodes(motion, segment, platform, pacingProfile),
    ),
  };
}

function buildReasonCodes(
  motion: MotionName,
  segment: MotionSegment,
  platform: PlatformOutputSpec["platform"],
  pacingProfile: string,
): string[] {
  const reasonCodes: string[] = [];

  if (segment.role === "hook") {
    reasonCodes.push("hook_requires_strong_motion_event");
  }

  if (platform === "tiktok" && segment.role === "hook" && MOTION_METADATA[motion].energy === "high") {
    reasonCodes.push("platform_prefers_high_energy_hook");
  }

  if (platform === "instagram_reels" && POLISHED_MOTIONS.has(motion)) {
    reasonCodes.push("platform_prefers_polished_motion");
  }

  if (platform === "youtube_shorts" && DIRECT_HOOK_MOTIONS.has(motion)) {
    reasonCodes.push("platform_prefers_hook_clarity_motion");
  }

  if (pacingProfile === "fast_cut" && FAST_CUT_MOTIONS.has(motion)) {
    reasonCodes.push("pacing_prefers_fast_cut_motion");
  }

  return dedupeReasonCodes(reasonCodes);
}

function deriveIntensity(motion: MotionName, role: MotionSegmentRole): MotionIntensity {
  const metadata = MOTION_METADATA[motion];

  if (role === "hook" && metadata.strength === "strong") {
    return "high";
  }

  if (role === "closer" && metadata.strength === "soft") {
    return "low";
  }

  return metadata.energy;
}

function dedupeReasonCodes(reasonCodes: string[]): string[] {
  return Array.from(new Set(reasonCodes));
}

function collectWarnings(segments: MotionSegment[], existingWarnings: string[]): string[] {
  const warnings = new Set(existingWarnings);

  segments
    .filter((segment) => segment.duration_sec > MAX_MOTION_WINDOW_SEC)
    .forEach((segment) => {
      warnings.add(`segment_exceeds_five_second_motion_window:${segment.segment_id}`);
      warnings.add(COMMON_MOTION_RULES[3]);
    });

  return Array.from(warnings).sort();
}

function createFallbackHookSegment(): MotionSegment {
  return {
    segment_id: "hook",
    start_sec: 0,
    end_sec: 0,
    duration_sec: 0,
    role: "hook",
  };
}

function wouldRepeatPanDirection(recentMotions: MotionName[], motion: MotionName): boolean {
  if (recentMotions.length < 2) {
    return false;
  }

  const recentDirections = recentMotions.map((recentMotion) => {
    return MOTION_METADATA[recentMotion].pan_direction;
  });
  const candidateDirection = MOTION_METADATA[motion].pan_direction;

  return (
    candidateDirection !== "none" &&
    recentDirections[0] === candidateDirection &&
    recentDirections[1] === candidateDirection
  );
}

function countRepetitionConflicts(recentMotions: MotionName[], motion: MotionName): number {
  let conflicts = 0;

  if (recentMotions.at(-1) === motion) {
    conflicts += 1;
  }

  if (wouldRepeatPanDirection(recentMotions, motion)) {
    conflicts += 1;
  }

  return conflicts;
}
