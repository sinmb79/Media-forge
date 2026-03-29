import type { CommandProfileSummary, EngineRequest } from "../domain/contracts.js";

export interface RequestProfile extends CommandProfileSummary {
  request: EngineRequest;
}

const PROFILE_CATALOG: RequestProfile[] = [
  {
    profile_id: "youtube_explainer",
    description: "Balanced explainer request for YouTube Shorts.",
    platform: "youtube_shorts",
    theme: "explainer",
    tags: ["beginner", "explainer", "youtube"],
    request: {
      version: "0.1",
      intent: {
        topic: "AI meeting note tool",
        subject: "young professional using laptop",
        goal: "make a short-form explainer clip",
        emotion: "curiosity and satisfaction",
        platform: "youtube_shorts",
        theme: "explainer",
        duration_sec: 20,
      },
      constraints: {
        language: "en",
        budget_tier: "low",
        quality_tier: "balanced",
        visual_consistency_required: true,
        content_policy_safe: true,
      },
      style: {
        hook_type: "curiosity",
        pacing_profile: "fast_cut",
        caption_style: "informative_clean",
        camera_language: "simple_push_in",
      },
      backend: {
        preferred_engine: "local",
        allow_fallback: true,
      },
      output: {
        type: "video_prompt",
      },
    },
  },
  {
    profile_id: "tiktok_product_launch",
    description: "Fast TikTok launch-style request with stronger motion bias.",
    platform: "tiktok",
    theme: "product_launch",
    tags: ["tiktok", "product", "launch"],
    request: {
      version: "0.1",
      intent: {
        topic: "new productivity app launch",
        subject: "mobile-first creator demo",
        goal: "announce a product launch clip",
        emotion: "urgency and excitement",
        platform: "tiktok",
        theme: "product_launch",
        duration_sec: 24,
      },
      constraints: {
        language: "en",
        budget_tier: "balanced",
        quality_tier: "balanced",
        visual_consistency_required: true,
        content_policy_safe: true,
      },
      style: {
        hook_type: "surprise",
        pacing_profile: "fast_cut",
        caption_style: "tiktok_viral",
        camera_language: "dynamic_pan",
      },
      backend: {
        preferred_engine: "gpu",
        allow_fallback: true,
      },
      output: {
        type: "video_prompt",
      },
    },
  },
  {
    profile_id: "novel_cliffhanger",
    description: "Novel-to-shorts setup focused on cliffhanger highlights.",
    platform: "instagram_reels",
    theme: "cliffhanger",
    tags: ["novel", "story", "reels"],
    request: {
      version: "0.1",
      intent: {
        topic: "fantasy rebellion episode",
        subject: "protagonist facing a dangerous choice",
        goal: "tease the next episode with a cliffhanger short",
        emotion: "tension and anticipation",
        platform: "instagram_reels",
        theme: "story_tease",
        duration_sec: 22,
      },
      constraints: {
        language: "en",
        budget_tier: "balanced",
        quality_tier: "premium",
        visual_consistency_required: true,
        content_policy_safe: true,
      },
      style: {
        hook_type: "cliffhanger",
        pacing_profile: "dramatic_build",
        caption_style: "cinematic_minimal",
        camera_language: "slow_push_in",
      },
      backend: {
        preferred_engine: "premium",
        allow_fallback: true,
      },
      output: {
        type: "video_prompt",
      },
      novel_project: {
        mode: "cliffhanger_short",
        episode_number: 7,
        scene_summary: "The rebel leader discovers the traitor just as the gates begin to close.",
        emotional_peak: "betrayal and fear",
        cliffhanger_strength: 0.92,
        character_focus: "Mina",
        visual_style_profile: "dark fantasy neon",
      },
    },
  },
];

export const CONFIG_VERSION = "0.1";
export const DEFAULT_PROFILE_ID = "youtube_explainer";
export const SUPPORTED_COMMANDS = [
  "run",
  "prompt",
  "create",
  "wizard",
  "execute",
  "config",
  "doctor",
  "analyze",
  "render",
  "publish",
  "forge",
];

export function getProfileCatalog(): RequestProfile[] {
  return PROFILE_CATALOG.map((profile) => ({
    ...profile,
    tags: [...profile.tags],
    request: structuredClone(profile.request),
  }));
}

export function getProfileSummaries(): CommandProfileSummary[] {
  return PROFILE_CATALOG.map(({ profile_id, description, platform, theme, tags }) => ({
    profile_id,
    description,
    platform,
    theme,
    tags: [...tags],
  }));
}

export function getRequestProfile(profileId: string): RequestProfile | null {
  const match = PROFILE_CATALOG.find((profile) => profile.profile_id === profileId);

  return match
    ? {
        ...match,
        tags: [...match.tags],
        request: structuredClone(match.request),
      }
    : null;
}
