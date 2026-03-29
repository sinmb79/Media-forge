import type { Platform, PlatformOutputSpec } from "../domain/contracts.js";

export type PlatformProfile = Omit<
  PlatformOutputSpec,
  "effective_duration_sec" | "warnings" | "adjustments"
>;

export const PLATFORM_PROFILES: Record<Platform, PlatformProfile> = {
  youtube_shorts: {
    platform: "youtube_shorts",
    resolution: "1080x1920",
    fps: 30,
    aspect_ratio: "9:16",
    safe_zone: "center_safe_vertical",
    caption_position: "lower_third",
    title_style: "informative_searchable",
    hashtag_style: "searchable_compact",
    cta_style: "retention_next_action",
    metadata_style: "informative_searchable",
    qa_emphasis: ["hook_clarity", "retention"],
    recommended_duration_sec: 30,
    min_duration_sec: 15,
    max_duration_sec: 60,
  },
  tiktok: {
    platform: "tiktok",
    resolution: "1080x1920",
    fps: 30,
    aspect_ratio: "9:16",
    safe_zone: "center_safe_vertical",
    caption_position: "lower_third",
    title_style: "native_hook",
    hashtag_style: "trend_aware",
    cta_style: "social_native",
    metadata_style: "native_social_trend_aware",
    qa_emphasis: ["motion_energy", "caption_immediacy"],
    recommended_duration_sec: 20,
    min_duration_sec: 10,
    max_duration_sec: 45,
  },
  instagram_reels: {
    platform: "instagram_reels",
    resolution: "1080x1920",
    fps: 30,
    aspect_ratio: "9:16",
    safe_zone: "center_safe_vertical",
    caption_position: "lower_third",
    title_style: "polished_brand_forward",
    hashtag_style: "brand_polished",
    cta_style: "clean_social",
    metadata_style: "polished_brand_forward",
    qa_emphasis: ["visual_coherence", "clean_packaging"],
    recommended_duration_sec: 20,
    min_duration_sec: 10,
    max_duration_sec: 45,
  },
};
