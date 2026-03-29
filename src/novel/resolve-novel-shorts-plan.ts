import type {
  NormalizedRequest,
  NovelProject,
  NovelQaFlags,
  NovelShortMode,
  NovelShortsPlan,
} from "../domain/contracts.js";

const MODE_DEFAULT_DURATION: Record<NovelShortMode, number> = {
  character_moment_short: 15,
  cliffhanger_short: 25,
  lore_worldbuilding_short: 20,
};

export function resolveNovelShortsPlan(
  normalizedRequest: NormalizedRequest,
): NovelShortsPlan | null {
  const novelProject = normalizedRequest.base.novel_project;

  if (!novelProject) {
    return null;
  }

  const highlightCandidate = buildHighlightCandidate(novelProject);
  const hookBuilder = buildHookBuilder(novelProject);

  return {
    mode: novelProject.mode,
    highlight_candidate: highlightCandidate,
    hook_builder: hookBuilder,
    shorts_script_outline: buildShortsScriptOutline(novelProject),
    qa_flags: buildQaFlags(novelProject),
    intent_overrides: buildIntentOverrides(novelProject),
  };
}

export function applyNovelIntentOverrides(
  normalizedRequest: NormalizedRequest,
  novelShortsPlan: NovelShortsPlan | null,
): NormalizedRequest {
  if (!novelShortsPlan) {
    return normalizedRequest;
  }

  const overrides = novelShortsPlan.intent_overrides;
  const resolvedDuration = Math.max(
    1,
    overrides.duration_sec ?? normalizedRequest.derived.resolved_duration_sec,
  );

  return {
    base: {
      ...normalizedRequest.base,
      intent: {
        ...normalizedRequest.base.intent,
        goal: overrides.goal ?? normalizedRequest.base.intent.goal,
        emotion: overrides.emotion ?? normalizedRequest.base.intent.emotion,
        theme: overrides.theme ?? normalizedRequest.base.intent.theme,
        duration_sec: overrides.duration_sec ?? normalizedRequest.base.intent.duration_sec,
      },
    },
    derived: {
      ...normalizedRequest.derived,
      resolved_duration_sec: resolvedDuration,
    },
  };
}

function buildHighlightCandidate(novelProject: NovelProject): string {
  return novelProject.scene_summary;
}

function buildHookBuilder(novelProject: NovelProject): string {
  if (novelProject.mode === "character_moment_short") {
    return `${novelProject.character_focus} faces a defining choice at the emotional peak.`;
  }

  if (novelProject.mode === "lore_worldbuilding_short") {
    return `One hidden rule changes how this world works: ${novelProject.scene_summary}`;
  }

  return `A hidden archive opens just before danger arrives: ${novelProject.scene_summary}`;
}

function buildShortsScriptOutline(novelProject: NovelProject): string[] {
  if (novelProject.mode === "character_moment_short") {
    return [
      `Frame ${novelProject.character_focus} at the center of the scene`,
      `Build the emotional peak around ${novelProject.emotional_peak}`,
      "End on the character choice that changes the episode",
    ];
  }

  if (novelProject.mode === "lore_worldbuilding_short") {
    return [
      "Open with the strange rule or artifact",
      "Explain why it matters to the world",
      "Close on the consequence for future story events",
    ];
  }

  return [
    "Reveal the charged scene setup",
    `Center the emotional peak around ${novelProject.character_focus}`,
    "End on the unresolved intrusion",
  ];
}

function buildQaFlags(novelProject: NovelProject): NovelQaFlags {
  return {
    scene_coherence: novelProject.scene_summary.length > 20 ? "high" : "medium",
    spoiler_risk:
      novelProject.mode === "cliffhanger_short" || novelProject.cliffhanger_strength >= 0.75
        ? "high"
        : "medium",
    emotional_payoff: novelProject.emotional_peak.length > 0 ? "high" : "medium",
    continuity_with_series_tone: novelProject.visual_style_profile.length > 0 ? "high" : "medium",
  };
}

function buildIntentOverrides(novelProject: NovelProject): NovelShortsPlan["intent_overrides"] {
  if (novelProject.mode === "character_moment_short") {
    return {
      duration_sec: MODE_DEFAULT_DURATION.character_moment_short,
      emotion: novelProject.emotional_peak,
      goal: "drive emotional engagement around one character choice",
      theme: "character_moment",
    };
  }

  if (novelProject.mode === "lore_worldbuilding_short") {
    return {
      duration_sec: MODE_DEFAULT_DURATION.lore_worldbuilding_short,
      emotion: novelProject.emotional_peak || "curiosity",
      goal: "deepen story universe with a mini-explainer",
      theme: "explainer",
    };
  }

  return {
    duration_sec: MODE_DEFAULT_DURATION.cliffhanger_short,
    emotion: novelProject.emotional_peak,
    goal: "attract next-episode interest",
    theme: "cliffhanger",
  };
}
