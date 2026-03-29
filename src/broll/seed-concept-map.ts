import type { BrollConceptRecord, MotionSegmentRole, Platform } from "../domain/contracts.js";

export const BROLL_DATASET_VERSION = "0.1";

export const SEED_CONCEPT_MAP: BrollConceptRecord[] = [
  createConcept("ai", ["digital interface", "code screen", "glowing data flow"], ["smart", "innovative"], allPlatforms(), ["ai", "assistant", "model", "llm"]),
  createConcept("automation", ["laptop automation", "auto-running workflow", "hands-free process"], ["efficient", "modern"], allPlatforms(), ["automation", "automated", "handsfree", "routine"]),
  createConcept("time_saving", ["hourglass", "clock fast-forward", "clean schedule"], ["relief", "speed"], allPlatforms(), ["time", "faster", "save", "quick"]),
  createConcept("growth", ["plant growing", "sunrise", "staircase upward"], ["optimistic", "upward"], allPlatforms(), ["growth", "grow", "expand", "scale"]),
  createConcept("money", ["coin stack", "wallet", "revenue chart"], ["practical", "reward"], allPlatforms(), ["money", "revenue", "profit", "budget"]),
  createConcept("comparison", ["balance scale", "split screen", "side-by-side desk"], ["analytical", "clear"], allPlatforms(), ["compare", "comparison", "versus", "choice"]),
  createConcept("risk", ["warning sign", "cliff edge", "storm clouds"], ["urgent", "cautious"], ["youtube_shorts", "tiktok"], ["risk", "danger", "warning", "mistake"]),
  createConcept("free", ["gift box", "unlocked door", "bonus screen"], ["inviting", "light"], ["tiktok", "instagram_reels"], ["free", "bonus", "gift", "unlock"]),
  createConcept("focus", ["focused face", "quiet desk", "dark room monitor"], ["clarity", "intentional"], allPlatforms(), ["focus", "attention", "clarity", "deep"]),
  createConcept("speed", ["racing lines", "stopwatch", "fast typing"], ["kinetic", "urgent"], ["tiktok", "youtube_shorts"], ["speed", "fast", "rapid", "quick"]),
  createConcept("failure", ["broken object", "frustrated face", "error screen"], ["tense", "friction"], ["youtube_shorts", "tiktok"], ["fail", "failure", "error", "broken"]),
  createConcept("success", ["celebration gesture", "checkmark ui", "upward chart"], ["positive", "resolved"], allPlatforms(), ["success", "win", "achieve", "result"]),
  createConcept("change", ["butterfly", "doorway", "before-after split"], ["transformative", "hopeful"], allPlatforms(), ["change", "transform", "shift", "improve"]),
  createConcept("choice", ["crossroads", "button grid", "hand hovering"], ["decisive", "evaluative"], allPlatforms(), ["choose", "choice", "select", "option"]),
  createConcept("learning", ["book notes", "highlighted text", "student desk"], ["curious", "steady"], ["youtube_shorts", "instagram_reels"], ["learn", "guide", "lesson", "education"]),
  createConcept("opportunity", ["open window", "sunrise city", "reaching hand"], ["hopeful", "forward"], allPlatforms(), ["opportunity", "potential", "future", "chance"]),
  createConcept("workflow", ["kanban board", "step diagram", "team checklist"], ["organized", "clear"], ["youtube_shorts", "tiktok"], ["workflow", "process", "steps", "pipeline"]),
  createConcept("clarity", ["clean whiteboard", "clear glass", "simple diagram"], ["clean", "understandable"], ["youtube_shorts", "instagram_reels"], ["clear", "clarity", "understand", "explain"]),
  createConcept("productivity", ["organized desk", "calendar blocks", "completed task list"], ["efficient", "calm"], allPlatforms(), ["productivity", "efficient", "output", "organize"]),
  createConcept("teamwork", ["shared desk", "collaborative board", "hands together"], ["collaborative", "trusting"], ["youtube_shorts", "instagram_reels"], ["team", "meeting", "collaborate", "together"]),
  createConcept("innovation", ["glowing prototype", "future interface", "concept sketch"], ["forward", "inventive"], allPlatforms(), ["innovation", "invent", "future", "prototype"]),
  createConcept("security", ["lock icon", "shield overlay", "secure login"], ["safe", "serious"], ["youtube_shorts", "instagram_reels"], ["security", "secure", "privacy", "protect"]),
  createConcept("decision", ["decision tree", "branching arrows", "menu choice"], ["analytic", "deliberate"], allPlatforms(), ["decision", "decide", "plan", "direction"]),
  createConcept("planning", ["roadmap board", "sticky note plan", "calendar overview"], ["structured", "calm"], ["youtube_shorts", "instagram_reels"], ["plan", "planning", "roadmap", "schedule"]),
  createConcept("retention", ["repeat viewer icon", "looping arrows", "watch-time chart"], ["sticky", "strategic"], ["youtube_shorts", "tiktok"], ["retain", "retention", "watch", "keep"]),
  createConcept("surprise", ["wide eyes", "sudden reveal", "flash frame"], ["unexpected", "high-energy"], ["tiktok", "youtube_shorts"], ["surprise", "unexpected", "wow", "hook"]),
  createConcept("trust", ["firm handshake", "verified badge", "steady smile"], ["reliable", "warm"], ["youtube_shorts", "instagram_reels"], ["trust", "reliable", "credibility", "safe"]),
  createConcept("simplicity", ["clean minimal desk", "single clear button", "tidy mobile screen"], ["polished", "minimal"], ["instagram_reels"], ["simple", "clean", "minimal", "polished"]),
  createConcept("efficiency", ["fast checklist", "one-click flow", "compressed timeline"], ["sharp", "productive"], allPlatforms(), ["efficiency", "optimize", "streamline", "reduce"]),
  createConcept("momentum", ["running start", "escalating chart", "forward push"], ["energized", "forward"], ["tiktok", "youtube_shorts"], ["momentum", "forward", "push", "accelerate"]),
];

export const GENERIC_FALLBACK_CONCEPTS: Record<MotionSegmentRole, string> = {
  hook: "focus",
  body_1: "clarity",
  body_2: "workflow",
  closer: "growth",
};

export function getSeedConceptMap(): BrollConceptRecord[] {
  return [...SEED_CONCEPT_MAP];
}

function createConcept(
  concept: string,
  visualMetaphors: string[],
  moodTags: string[],
  platformSuitability: Platform[],
  keywordTriggers: string[],
): BrollConceptRecord {
  return {
    concept,
    visual_metaphors: visualMetaphors,
    mood_tags: moodTags,
    platform_suitability: platformSuitability,
    keyword_triggers: keywordTriggers,
  };
}

function allPlatforms(): Platform[] {
  return ["youtube_shorts", "tiktok", "instagram_reels"];
}
