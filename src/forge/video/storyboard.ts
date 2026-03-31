import { readFile } from "node:fs/promises";
import * as path from "node:path";

import { FFmpegBackend } from "../../backends/ffmpeg.js";
import { mapCameraLanguageToWan22 } from "../../motion/wan22-camera-map.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { runJoinClips } from "../edit/join.js";
import { getCharacter } from "../character/manager.js";
import { runVideoFromImage, type ForgeVideoResult, type VideoFromImageOptions } from "./from-image.js";
import { runVideoFromText } from "./from-text.js";

export interface StoryboardScene {
  image: string;
  desc: string;
  duration: number;
}

export interface StoryboardSubject {
  name: string;
  lora?: string;
  reference_image?: string;
  character_id?: string;
}

export interface StoryboardShot {
  id: number | string;
  duration_sec: number;
  prompt_ko: string;
  image: string | null;
  camera?: string;
}

export interface StoryboardDefinition {
  subject?: StoryboardSubject;
  output: {
    resolution: "720p" | "1080p";
    format: string;
  };
  scenes: StoryboardScene[];
  shots: StoryboardShot[];
  transition: "ai" | "cut" | "fade";
  model: "wan22-q8" | "wan22-q4" | "ltx2";
  resolution: "720p" | "1080p";
  aspect_ratio: "smart" | "9:16" | "1:1" | "16:9";
  sound_sync: boolean;
}

export interface StoryboardRunResult {
  clip_paths: string[];
  output_path: string;
  request_id: string;
  shot_count: number;
  status: "simulated" | "completed";
  transition: StoryboardDefinition["transition"];
  workflow_id: string;
}

export async function loadStoryboardDefinition(filePath: string): Promise<StoryboardDefinition> {
  const raw = await readFile(filePath, "utf8");
  return normalizeStoryboardDefinition(JSON.parse(raw) as Record<string, unknown>);
}

export async function runStoryboardVideo(
  input: {
    storyboardPath: string;
    rootDir?: string;
    outputDir?: string;
    simulate?: boolean;
    theme?: string | null;
    dbPath?: string;
  },
  dependencies: {
    ffmpegBackend?: Pick<FFmpegBackend, "concat" | "execute" | "getMediaInfo">;
    fromImageRunner?: (input: VideoFromImageOptions) => Promise<ForgeVideoResult>;
    fromTextRunner?: (input: {
      desc_ko: string;
      outputDir?: string;
      quality: "draft" | "production";
      rootDir?: string;
      simulate?: boolean;
      theme?: string | null;
    }) => Promise<ForgeVideoResult>;
    joinStrategy?: (
      clipPaths: string[],
      outputPath: string,
      transition: StoryboardDefinition["transition"],
    ) => Promise<string>;
  } = {},
): Promise<StoryboardRunResult> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const resolvedStoryboardPath = path.isAbsolute(input.storyboardPath)
    ? input.storyboardPath
    : path.resolve(rootDir, input.storyboardPath);
  const storyboard = await loadStoryboardDefinition(resolvedStoryboardPath);
  const requestId = createRequestId({
    shots: storyboard.shots.map((shot) => `${shot.id}:${shot.prompt_ko}`),
    storyboardPath: resolvedStoryboardPath,
    transition: storyboard.transition,
  });
  const clipDir = path.resolve(rootDir, input.outputDir ?? "outputs", requestId);
  const outputPath = path.resolve(rootDir, input.outputDir ?? "outputs", `${requestId}-storyboard.mp4`);
  const subjectReference = await resolveSubjectReferenceImage(
    storyboard.subject,
    resolvedStoryboardPath,
    input.dbPath,
    rootDir,
  );
  const clipPaths = storyboard.shots.map((shot, index) =>
    path.resolve(clipDir, `shot-${index + 1}.mp4`));

  if (input.simulate) {
    return {
      clip_paths: clipPaths,
      output_path: outputPath,
      request_id: requestId,
      shot_count: storyboard.shots.length,
      status: "simulated",
      transition: storyboard.transition,
      workflow_id: resolveStoryboardWorkflowId(storyboard.transition),
    };
  }

  const fromImageRunner = dependencies.fromImageRunner ?? runVideoFromImage;
  const fromTextRunner = dependencies.fromTextRunner ?? runVideoFromText;
  const renderedClips: string[] = [];

  for (const [index, shot] of storyboard.shots.entries()) {
    const resolvedImage = resolveStoryboardAssetPath(
      shot.image ?? subjectReference,
      resolvedStoryboardPath,
      rootDir,
    );
    const motionPrompt = buildStoryboardShotPrompt(storyboard.subject, shot);
    const outputDir = clipDir;

    if (resolvedImage) {
      const result = await fromImageRunner({
        aspect_ratio: storyboard.aspect_ratio,
        desc_ko: motionPrompt,
        duration_sec: shot.duration_sec,
        imagePath: resolvedImage,
        model: storyboard.model === "ltx2" ? "ltx2" : "wan22",
        outputDir,
        quality: storyboard.model === "wan22-q4" ? "draft" : "production",
        resolution: storyboard.resolution,
        rootDir,
        sound_sync: storyboard.sound_sync,
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
      });
      renderedClips.push(result.output_path || clipPaths[index] || "");
      continue;
    }

    const result = await fromTextRunner({
      desc_ko: motionPrompt,
      outputDir,
      quality: storyboard.model === "wan22-q4" ? "draft" : "production",
      rootDir,
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
    });
    renderedClips.push(result.output_path || clipPaths[index] || "");
  }

  const joinStrategy = dependencies.joinStrategy ?? buildDefaultJoinStrategy(rootDir, dependencies.ffmpegBackend);
  const finalOutputPath = await joinStrategy(renderedClips, outputPath, storyboard.transition);

  return {
    clip_paths: renderedClips,
    output_path: finalOutputPath,
    request_id: requestId,
    shot_count: storyboard.shots.length,
    status: "completed",
    transition: storyboard.transition,
    workflow_id: resolveStoryboardWorkflowId(storyboard.transition),
  };
}

function normalizeStoryboardDefinition(input: Record<string, unknown>): StoryboardDefinition {
  if (Array.isArray(input.shots)) {
    const shots = input.shots.map(normalizeStoryboardShot);
    return {
      aspect_ratio: normalizeAspectRatio(input.aspect_ratio),
      model: normalizeStoryboardModel(input.model),
      output: {
        format: "mp4",
        resolution: normalizeResolution(input.resolution),
      },
      resolution: normalizeResolution(input.resolution),
      scenes: shots.map((shot) => ({
        desc: shot.prompt_ko,
        duration: shot.duration_sec,
        image: shot.image ?? "",
      })),
      shots,
      sound_sync: Boolean(input.sound_sync),
      transition: normalizeTransition(input.transition),
      ...(isSubject(input.subject) ? { subject: input.subject } : {}),
    };
  }

  const scenes = Array.isArray(input.scenes) ? input.scenes.map(normalizeLegacyScene) : [];
  return {
    aspect_ratio: "16:9",
    model: "wan22-q8",
    output: {
      format: typeof (input.output as { format?: unknown } | undefined)?.format === "string"
        ? (input.output as { format: string }).format
        : "mp4",
      resolution: normalizeResolution((input.output as { resolution?: unknown } | undefined)?.resolution),
    },
    resolution: normalizeResolution((input.output as { resolution?: unknown } | undefined)?.resolution),
    scenes,
    shots: scenes.map((scene, index) => ({
      duration_sec: scene.duration,
      id: index + 1,
      image: scene.image,
      prompt_ko: scene.desc,
    })),
    sound_sync: false,
    transition: normalizeTransition(input.transition),
  };
}

function normalizeStoryboardShot(input: unknown): StoryboardShot {
  const shot = input as Partial<StoryboardShot>;
  return {
    duration_sec: typeof shot.duration_sec === "number" ? shot.duration_sec : 5,
    id: typeof shot.id === "number" || typeof shot.id === "string" ? shot.id : 0,
    image: typeof shot.image === "string" ? shot.image : null,
    prompt_ko: typeof shot.prompt_ko === "string" ? shot.prompt_ko : "",
    ...(typeof shot.camera === "string" ? { camera: shot.camera } : {}),
  };
}

function normalizeLegacyScene(input: unknown): StoryboardScene {
  const scene = input as Partial<StoryboardScene>;
  return {
    desc: typeof scene.desc === "string" ? scene.desc : "",
    duration: typeof scene.duration === "number" ? scene.duration : 5,
    image: typeof scene.image === "string" ? scene.image : `scene-${Date.now()}.png`,
  };
}

function normalizeStoryboardModel(value: unknown): StoryboardDefinition["model"] {
  if (value === "wan22-q4" || value === "ltx2") {
    return value;
  }

  return "wan22-q8";
}

function normalizeResolution(value: unknown): StoryboardDefinition["resolution"] {
  return value === "1080p" ? "1080p" : "720p";
}

function normalizeAspectRatio(value: unknown): StoryboardDefinition["aspect_ratio"] {
  if (value === "smart" || value === "9:16" || value === "1:1" || value === "16:9") {
    return value;
  }

  return "16:9";
}

function normalizeTransition(value: unknown): StoryboardDefinition["transition"] {
  if (value === "cut" || value === "fade") {
    return value;
  }

  return "ai";
}

function buildStoryboardShotPrompt(
  subject: StoryboardSubject | undefined,
  shot: StoryboardShot,
): string {
  const subjectPrefix = subject?.name ? `${subject.name}. ` : "";
  const cameraPrompt = mapCameraLanguageToWan22(shot.camera ?? "simple_push_in");
  return `${subjectPrefix}${shot.prompt_ko}. ${cameraPrompt}`;
}

async function resolveSubjectReferenceImage(
  subject: StoryboardSubject | undefined,
  storyboardPath: string,
  dbPath: string | undefined,
  rootDir: string,
): Promise<string | null> {
  if (!subject) {
    return null;
  }

  if (subject.reference_image) {
    return resolveStoryboardAssetPath(subject.reference_image, storyboardPath, rootDir);
  }

  if (!subject.character_id) {
    return null;
  }

  const character = await getCharacter({
    idOrName: subject.character_id,
    rootDir,
    ...(dbPath ? { dbPath } : {}),
  });
  return character?.reference_images[0] ?? null;
}

function resolveStoryboardAssetPath(
  maybePath: string | null | undefined,
  storyboardPath: string,
  rootDir: string,
): string | null {
  if (!maybePath) {
    return null;
  }

  if (path.isAbsolute(maybePath)) {
    return maybePath;
  }

  return path.resolve(path.dirname(storyboardPath), maybePath);
}

function resolveStoryboardWorkflowId(transition: StoryboardDefinition["transition"]): string {
  if (transition === "ai") {
    return "wan_vace_join";
  }

  return transition === "fade" ? "ffmpeg_xfade" : "ffmpeg_concat";
}

function buildDefaultJoinStrategy(
  rootDir: string,
  ffmpegBackend: Pick<FFmpegBackend, "concat" | "execute" | "getMediaInfo"> | undefined,
): (
  clipPaths: string[],
  outputPath: string,
  transition: StoryboardDefinition["transition"],
) => Promise<string> {
  return async (clipPaths, outputPath, transition) => {
    if (transition === "ai") {
      const joinResult = await runJoinClips({
        clipsDir: path.dirname(clipPaths[0] ?? rootDir),
        outputDir: path.relative(rootDir, path.dirname(outputPath)),
        rootDir,
        transition,
      });
      return joinResult.output_path;
    }

    const resolvedBackend = ffmpegBackend ?? new FFmpegBackend();
    if (transition === "fade") {
      await renderFadeTransition(clipPaths, outputPath, resolvedBackend);
      return outputPath;
    }

    await resolvedBackend.concat(clipPaths, outputPath);
    return outputPath;
  };
}

function isSubject(value: unknown): value is StoryboardSubject {
  return Boolean(value) && typeof value === "object" && typeof (value as { name?: unknown }).name === "string";
}

async function renderFadeTransition(
  clipPaths: string[],
  outputPath: string,
  ffmpegBackend: Pick<FFmpegBackend, "execute" | "getMediaInfo">,
): Promise<void> {
  if (clipPaths.length <= 1) {
    const [singleClip] = clipPaths;
    if (!singleClip) {
      throw new Error("Fade transition requires at least one clip.");
    }

    await ffmpegBackend.execute({
      args: [
        "-y",
        "-i",
        singleClip,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-an",
        outputPath,
      ],
    });
    return;
  }

  const transitionDuration = 0.5;
  const args = clipPaths.flatMap((clipPath) => ["-i", clipPath]);
  const infos = await Promise.all(clipPaths.map((clipPath) => ffmpegBackend.getMediaInfo(clipPath)));
  const filters: string[] = [];
  let previousLabel = "[0:v]";
  let offset = Math.max(0, (infos[0]?.duration ?? 0) - transitionDuration);

  for (let index = 1; index < clipPaths.length; index += 1) {
    const outputLabel = `[v${index}]`;
    filters.push(
      `${previousLabel}[${index}:v]xfade=transition=fade:duration=${transitionDuration}:offset=${formatFadeOffset(offset)}${outputLabel}`,
    );
    previousLabel = outputLabel;
    offset += Math.max(0, (infos[index]?.duration ?? 0) - transitionDuration);
  }

  await ffmpegBackend.execute({
    args: [
      "-y",
      ...args,
      "-filter_complex",
      filters.join(";"),
      "-map",
      previousLabel,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-an",
      outputPath,
    ],
  });
}

function formatFadeOffset(value: number): string {
  return Number(value.toFixed(3)).toString();
}
