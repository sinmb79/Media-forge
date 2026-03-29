import type {
  MotionEnergy,
  MotionLoopRisk,
  MotionName,
  MotionPanDirection,
  MotionSegmentRole,
  MotionStrength,
  Platform,
} from "../domain/contracts.js";

export interface MotionMetadata {
  energy: MotionEnergy;
  strength: MotionStrength;
  loop_risk: MotionLoopRisk;
  pan_direction: MotionPanDirection;
}

export const COMMON_MOTION_RULES = [
  "same_motion_cannot_repeat_3_times",
  "same_pan_direction_cannot_repeat_more_than_2_times",
  "hook_requires_strong_motion_event",
  "visual_motion_must_change_within_5_seconds",
  "loop_avoids_excessive_glitch_motion",
] as const;

export const MOTION_METADATA: Record<MotionName, MotionMetadata> = {
  glitch_transition: {
    energy: "high",
    strength: "strong",
    loop_risk: "high",
    pan_direction: "none",
  },
  pan_left: {
    energy: "high",
    strength: "strong",
    loop_risk: "medium",
    pan_direction: "left",
  },
  pan_right: {
    energy: "high",
    strength: "strong",
    loop_risk: "medium",
    pan_direction: "right",
  },
  parallax: {
    energy: "medium",
    strength: "medium",
    loop_risk: "low",
    pan_direction: "none",
  },
  rotate_slow: {
    energy: "low",
    strength: "soft",
    loop_risk: "low",
    pan_direction: "none",
  },
  zoom_in: {
    energy: "high",
    strength: "strong",
    loop_risk: "low",
    pan_direction: "none",
  },
  zoom_out: {
    energy: "medium",
    strength: "medium",
    loop_risk: "low",
    pan_direction: "none",
  },
};

const PLATFORM_WEIGHTS: Record<Platform, Partial<Record<MotionName, number>>> = {
  instagram_reels: {
    parallax: 6,
    rotate_slow: 5,
    zoom_out: 5,
    zoom_in: 2,
    pan_left: 1,
    pan_right: 1,
    glitch_transition: 0,
  },
  tiktok: {
    zoom_in: 6,
    pan_left: 5,
    pan_right: 5,
    glitch_transition: 4,
    zoom_out: 1,
    parallax: 1,
    rotate_slow: 0,
  },
  youtube_shorts: {
    zoom_in: 6,
    pan_left: 4,
    pan_right: 4,
    zoom_out: 2,
    parallax: 1,
    rotate_slow: 0,
    glitch_transition: 0,
  },
};

const THEME_WEIGHTS: Record<string, Partial<Record<MotionName, number>>> = {
  explainer: {
    zoom_in: 1,
    zoom_out: 1,
    parallax: 1,
  },
};

const PACING_WEIGHTS: Record<string, Partial<Record<MotionName, number>>> = {
  fast_cut: {
    zoom_in: 3,
    pan_left: 2,
    pan_right: 2,
    glitch_transition: 1,
  },
};

const ROLE_ALLOWED_STRENGTHS: Record<MotionSegmentRole, MotionStrength[]> = {
  hook: ["strong"],
  body_1: ["medium", "strong"],
  body_2: ["medium", "strong"],
  closer: ["strong", "medium", "soft"],
};

export function listMotionNames(): MotionName[] {
  return Object.keys(MOTION_METADATA).sort() as MotionName[];
}

export function getAllowedMotionsForRole(role: MotionSegmentRole): MotionName[] {
  const allowedStrengths = new Set(ROLE_ALLOWED_STRENGTHS[role]);

  return listMotionNames().filter((motion) => {
    return allowedStrengths.has(MOTION_METADATA[motion].strength);
  });
}

export function getPlatformWeight(platform: Platform, motion: MotionName): number {
  return PLATFORM_WEIGHTS[platform][motion] ?? 0;
}

export function getThemeWeight(theme: string, motion: MotionName): number {
  return THEME_WEIGHTS[theme]?.[motion] ?? 0;
}

export function getPacingWeight(pacingProfile: string, motion: MotionName): number {
  return PACING_WEIGHTS[pacingProfile]?.[motion] ?? 0;
}

export function getRoleWeight(role: MotionSegmentRole, motion: MotionName): number {
  const metadata = MOTION_METADATA[motion];

  if (role === "closer") {
    if (metadata.strength === "soft") {
      return 3;
    }

    if (metadata.strength === "medium") {
      return 2;
    }

    return -1;
  }

  return 0;
}
