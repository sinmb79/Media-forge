import {
  runImageGenerate,
} from "../../../dist/src/forge/image/generate.js";
import {
  runSketchToImage,
} from "../../../dist/src/forge/image/sketch-to-image.js";
import {
  runVideoFromImage,
} from "../../../dist/src/forge/video/from-image.js";
import {
  runVideoFromText,
} from "../../../dist/src/forge/video/from-text.js";
import {
  runSkyReelsRef2V,
} from "../../../dist/src/forge/video/ref2v.js";
import {
  runVideoSeedSession,
} from "../../../dist/src/forge/video/seed.js";
import {
  runSkyReelsTalkingAvatar,
} from "../../../dist/src/forge/video/talking.js";
import {
  runSessionVideoExtend,
  runSkyReelsVideoExtend,
} from "../../../dist/src/forge/video/extend.js";
import {
  composeSeedSession,
} from "../../../dist/src/forge/video/compose.js";
import {
  SeedSessionManager,
} from "../../../dist/src/forge/video/seed-session.js";
import {
  runBrowseVideoSessions,
} from "../../../dist/src/forge/video/browse.js";
import {
  runTalkingScenePipeline,
} from "../../../dist/src/forge/pipeline/talking-scene.js";
import {
  runAutoExtendPipeline,
} from "../../../dist/src/forge/pipeline/auto-extend.js";

export interface DashboardNormalizedImageRequest {
  aspectRatio: "1:1" | "16:9" | "3:4" | "9:16";
  batchCount: number;
  desc: string;
  mode: "generate" | "sketch";
  renderModel: "flux" | "sdxl";
  resolution: "1k" | "2k" | "4k";
  sketchPath: string | null;
  theme: string | null;
}

export interface DashboardNormalizedVideoRequest {
  aspectRatio: "1:1" | "16:9" | "9:16";
  audioPath: string | null;
  desc: string;
  durationSec: number;
  imagePath: string | null;
  lang: string;
  mode: "image" | "text" | "ref2v" | "talking" | "extend";
  model: "ltx2" | "wan22" | "skyreels-ref2v" | "skyreels-a2v" | "skyreels-v2v";
  overlapFrames: number;
  portraitPath: string | null;
  quality: "draft" | "production";
  referencePaths: string[];
  sourceVideoPath: string | null;
  text: string;
  voice: string | null;
  voiceDir: string | null;
  voicePreset: string | null;
}

export interface DashboardNormalizedVideoSeedRequest {
  candidates: number;
  desc: string;
  durationSec: number;
  fromImagePath: string | null;
  model: "ltx2" | "wan22" | "skyreels-ref2v";
  outputDir: string;
  quality: "draft" | "production";
  referencePaths: string[];
}

export interface DashboardNormalizedVideoAutoExtendRequest {
  autoPick: "best" | "first" | "manual" | "random";
  candidates: number;
  desc: string;
  extendDurationSec: number;
  extendLoops: number;
  fromImagePath: string | null;
  model: "ltx2" | "wan22" | "skyreels-ref2v";
  outputDir: string | null;
  outputPath: string | null;
  quality: "draft" | "production";
  referencePaths: string[];
  seedDurationSec: number;
  withAudio: boolean;
}

export function normalizeDashboardImageRequest(
  payload: Record<string, unknown>,
): DashboardNormalizedImageRequest {
  return {
    aspectRatio: normalizeImageAspect(payload.aspect),
    batchCount: clampInteger(payload.drafts, 1, 4, 1),
    desc: String(payload.desc ?? "").trim(),
    mode: typeof payload.sketchPath === "string" && payload.sketchPath.trim().length > 0 ? "sketch" : "generate",
    renderModel: payload.renderModel === "flux" ? "flux" : "sdxl",
    resolution: normalizeImageResolution(payload.resolution),
    sketchPath: typeof payload.sketchPath === "string" && payload.sketchPath.trim().length > 0
      ? payload.sketchPath.trim()
      : null,
    theme: typeof payload.theme === "string" && payload.theme.trim().length > 0
      ? payload.theme.trim()
      : null,
  };
}

export function normalizeDashboardVideoRequest(
  payload: Record<string, unknown>,
): DashboardNormalizedVideoRequest {
  const mode = normalizeVideoMode(payload.mode);
  const requestedModel = normalizeVideoModel(mode, payload.model);

  return {
    aspectRatio: normalizeVideoAspect(payload.aspect),
    audioPath: trimOptionalString(payload.audioPath),
    desc: String(payload.desc ?? "").trim(),
    durationSec: clampInteger(payload.duration, 3, 15, 5),
    imagePath: typeof payload.imagePath === "string" && payload.imagePath.trim().length > 0
      ? payload.imagePath.trim()
      : null,
    lang: trimOptionalString(payload.lang) ?? "ko",
    mode,
    model: requestedModel,
    overlapFrames: clampInteger(payload.overlapFrames, 4, 16, 8),
    portraitPath: trimOptionalString(payload.portraitPath),
    quality: payload.quality === "draft" ? "draft" : "production",
    referencePaths: normalizePathList(payload.referencePaths),
    sourceVideoPath: trimOptionalString(payload.sourceVideoPath),
    text: trimOptionalString(payload.text) ?? "",
    voice: trimOptionalString(payload.voice),
    voiceDir: trimOptionalString(payload.voiceDir),
    voicePreset: trimOptionalString(payload.voicePreset),
  };
}

export function normalizeDashboardVideoSeedRequest(
  payload: Record<string, unknown>,
): DashboardNormalizedVideoSeedRequest {
  return {
    candidates: clampInteger(payload.candidates, 1, 8, 4),
    desc: String(payload.desc ?? "").trim(),
    durationSec: clampInteger(payload.duration, 3, 15, 10),
    fromImagePath: trimOptionalString(payload.fromImagePath),
    model: normalizeVideoSeedModel(payload.model),
    outputDir: trimOptionalString(payload.outputDir) ?? "workspace/seeds/session",
    quality: payload.quality === "draft" ? "draft" : "production",
    referencePaths: normalizePathList(payload.referencePaths),
  };
}

export function normalizeDashboardVideoAutoExtendRequest(
  payload: Record<string, unknown>,
): DashboardNormalizedVideoAutoExtendRequest {
  return {
    autoPick: normalizeAutoPick(payload.autoPick),
    candidates: clampInteger(payload.candidates, 1, 8, 4),
    desc: String(payload.desc ?? "").trim(),
    extendDurationSec: clampInteger(payload.extendDuration, 3, 15, 5),
    extendLoops: clampInteger(payload.extendLoops, 0, 5, 1),
    fromImagePath: trimOptionalString(payload.fromImagePath),
    model: normalizeVideoSeedModel(payload.model),
    outputDir: trimOptionalString(payload.outputDir),
    outputPath: trimOptionalString(payload.outputPath),
    quality: payload.quality === "draft" ? "draft" : "production",
    referencePaths: normalizePathList(payload.referencePaths),
    seedDurationSec: clampInteger(payload.seedDuration, 3, 15, 10),
    withAudio: payload.withAudio === true,
  };
}

export async function runDashboardImageGeneration(
  payload: Record<string, unknown>,
  rootDir: string,
) {
  const input = normalizeDashboardImageRequest(payload);

  if (input.mode === "sketch" && input.sketchPath) {
    return runSketchToImage({
      desc_ko: input.desc,
      model: input.renderModel,
      resolution: input.resolution === "4k" ? "2k" : input.resolution,
      rootDir,
      simulate: false,
      sketchPath: input.sketchPath,
      theme: input.theme,
    });
  }

  return runImageGenerate({
    aspect_ratio: input.aspectRatio,
    batch_count: input.batchCount,
    model: input.renderModel,
    prompt: input.desc,
    resolution: input.resolution,
    rootDir,
    simulate: false,
    theme: input.theme,
  });
}

export async function runDashboardVideoGeneration(
  payload: Record<string, unknown>,
  rootDir: string,
) {
  const input = normalizeDashboardVideoRequest(payload);

  if (input.mode === "ref2v") {
    return runSkyReelsRef2V({
      desc_ko: input.desc,
      duration_sec: input.durationSec,
      quality: input.quality,
      referencePaths: input.referencePaths,
      rootDir,
      simulate: false,
    });
  }

  if (input.mode === "talking") {
    if (input.audioPath) {
      return runSkyReelsTalkingAvatar({
        audioPath: input.audioPath,
        desc_ko: input.desc,
        duration_sec: input.durationSec,
        portraitPath: input.portraitPath ?? "",
        quality: input.quality,
        rootDir,
        simulate: false,
      });
    }

    return runTalkingScenePipeline({
      desc_ko: input.desc,
      duration_sec: input.durationSec,
      lang: input.lang,
      portraitPath: input.portraitPath ?? "",
      quality: input.quality,
      rootDir,
      simulate: false,
      text: input.text,
      ...(input.voice ? { voice: input.voice } : {}),
      ...(input.voiceDir ? { voiceRootDir: input.voiceDir } : {}),
      ...(input.voicePreset ? { voicePresetName: input.voicePreset } : {}),
    });
  }

  if (input.mode === "extend") {
    return runSkyReelsVideoExtend({
      desc_ko: input.desc,
      duration_sec: input.durationSec,
      overlap_frames: input.overlapFrames,
      quality: input.quality,
      rootDir,
      simulate: false,
      sourceVideoPath: input.sourceVideoPath ?? "",
    });
  }

  if (input.mode === "text") {
    return runVideoFromText({
      aspect_ratio: input.aspectRatio,
      desc_ko: input.desc,
      duration_sec: input.durationSec,
      model: input.model,
      quality: input.quality,
      rootDir,
      simulate: false,
    });
  }

  return runVideoFromImage({
    aspect_ratio: input.aspectRatio,
    desc_ko: input.desc,
    duration_sec: input.durationSec,
    imagePath: input.imagePath ?? "",
    model: input.model,
    quality: input.quality,
    rootDir,
    simulate: false,
  });
}

export async function runDashboardVideoSeed(
  payload: Record<string, unknown>,
  rootDir: string,
) {
  const input = normalizeDashboardVideoSeedRequest(payload);
  return runVideoSeedSession({
    candidates: input.candidates,
    desc_ko: input.desc || (input.fromImagePath ? `Seed from ${input.fromImagePath}` : "Video seed session"),
    duration_sec: input.durationSec,
    ...(input.fromImagePath ? { fromImagePath: input.fromImagePath } : {}),
    model: input.model,
    outputDir: input.outputDir,
    quality: input.quality,
    referencePaths: input.referencePaths,
    rootDir,
    simulate: false,
  });
}

export async function runDashboardVideoPick(
  payload: Record<string, unknown>,
  rootDir: string,
) {
  const sessionDir = trimOptionalString(payload.sessionDir) ?? "";
  const selected = normalizePathList(payload.selected).length > 0
    ? normalizePathList(payload.selected)
    : normalizePathList(payload.select);
  const manager = await SeedSessionManager.load(sessionDir);
  await manager.pick(selected);
  return {
    selected,
    session_dir: manager.sessionDir,
    status: "updated" as const,
  };
}

export async function runDashboardVideoCompose(
  payload: Record<string, unknown>,
  rootDir: string,
) {
  const sessionDir = trimOptionalString(payload.sessionDir) ?? "";
  const sourceId = trimOptionalString(payload.sourceId) ?? trimOptionalString(payload.source) ?? "";
  return composeSeedSession({
    ...(trimOptionalString(payload.outputPath) ? { outputPath: trimOptionalString(payload.outputPath) ?? undefined } : {}),
    rootDir,
    sessionDir,
    sourceId,
    ...(payload.withAudio === true ? { withAudio: true } : {}),
    ...(typeof payload.upscale === "number" || typeof payload.upscale === "string"
      ? { upscale: clampInteger(payload.upscale, 1, 4, 2) }
      : {}),
  });
}

export async function runDashboardVideoBrowse(
  payload: Record<string, unknown>,
  rootDir: string,
) {
  return runBrowseVideoSessions({
    rootDir,
    ...(trimOptionalString(payload.sessionDir) ? { sessionDir: trimOptionalString(payload.sessionDir) ?? undefined } : {}),
    ...(trimOptionalString(payload.sessionsRootDir) ? { sessionsRootDir: trimOptionalString(payload.sessionsRootDir) ?? undefined } : {}),
  });
}

export async function runDashboardVideoSessionExtend(
  payload: Record<string, unknown>,
  rootDir: string,
) {
  const desc = String(payload.desc ?? "").trim();
  const sessionDir = trimOptionalString(payload.sessionDir) ?? "";
  const sourceId = trimOptionalString(payload.sourceId) ?? trimOptionalString(payload.source) ?? "";

  return runSessionVideoExtend({
    desc_ko: desc,
    duration_sec: clampInteger(payload.duration, 3, 15, 5),
    loops: clampInteger(payload.loops, 1, 5, 1),
    overlap_frames: clampInteger(payload.overlapFrames, 4, 16, 8),
    quality: payload.quality === "draft" ? "draft" : "production",
    rootDir,
    sessionDir,
    simulate: false,
    sourceId,
  });
}

export async function runDashboardVideoAutoExtend(
  payload: Record<string, unknown>,
  rootDir: string,
) {
  const input = normalizeDashboardVideoAutoExtendRequest(payload);
  return runAutoExtendPipeline({
    autoPick: input.autoPick,
    candidates: input.candidates,
    desc_ko: input.desc || (input.fromImagePath ? `Auto extend from ${input.fromImagePath}` : "Auto extend session"),
    extend_duration_sec: input.extendDurationSec,
    extend_loops: input.extendLoops,
    ...(input.fromImagePath ? { fromImagePath: input.fromImagePath } : {}),
    model: input.model,
    ...(input.outputDir ? { outputDir: input.outputDir } : {}),
    ...(input.outputPath ? { outputPath: input.outputPath } : {}),
    quality: input.quality,
    referencePaths: input.referencePaths,
    rootDir,
    seed_duration_sec: input.seedDurationSec,
    simulate: false,
    ...(input.withAudio ? { withAudio: true } : {}),
  });
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function normalizeImageAspect(value: unknown): DashboardNormalizedImageRequest["aspectRatio"] {
  if (value === "1:1" || value === "3:4" || value === "16:9" || value === "9:16") {
    return value;
  }

  return value === undefined || value === null || value === "" ? "9:16" : "16:9";
}

function normalizeVideoAspect(value: unknown): DashboardNormalizedVideoRequest["aspectRatio"] {
  return value === "1:1" || value === "16:9" ? value : "9:16";
}

function normalizeVideoMode(value: unknown): DashboardNormalizedVideoRequest["mode"] {
  if (value === "text" || value === "ref2v" || value === "talking" || value === "extend") {
    return value;
  }

  return "image";
}

function normalizeVideoModel(
  mode: DashboardNormalizedVideoRequest["mode"],
  value: unknown,
): DashboardNormalizedVideoRequest["model"] {
  if (mode === "text") {
    return "wan22";
  }

  if (mode === "ref2v") {
    return "skyreels-ref2v";
  }

  if (mode === "talking") {
    return "skyreels-a2v";
  }

  if (mode === "extend") {
    return "skyreels-v2v";
  }

  return value === "ltx2" ? "ltx2" : "wan22";
}

function normalizeVideoSeedModel(
  value: unknown,
): DashboardNormalizedVideoSeedRequest["model"] {
  if (value === "ltx2" || value === "skyreels-ref2v") {
    return value;
  }

  return "wan22";
}

function normalizeAutoPick(
  value: unknown,
): DashboardNormalizedVideoAutoExtendRequest["autoPick"] {
  if (value === "best" || value === "manual" || value === "random") {
    return value;
  }

  return "first";
}

function normalizeImageResolution(value: unknown): DashboardNormalizedImageRequest["resolution"] {
  if (value === "1k" || value === "4k") {
    return value;
  }

  return "2k";
}

function normalizePathList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

function trimOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}
