import { copyFile, mkdir, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { FFmpegBackend } from "../../backends/ffmpeg.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { generateForgeAudioDrama } from "../audio/drama.js";
import {
  cleanupFiles,
  DEFAULT_VIDEO_FPS,
  formatFfmpegTimestamp,
  resolveSessionArtifactPath,
  rootSeedIdFromClipId,
} from "./session-files.js";
import { SeedSessionManager } from "./seed-session.js";

export interface ComposeSeedSessionOptions {
  outputPath?: string;
  rootDir?: string;
  sessionDir: string;
  simulate?: boolean;
  sourceId: string;
  upscale?: number;
  withAudio?: boolean;
}

export async function composeSeedSession(
  input: ComposeSeedSessionOptions,
  dependencies: {
    audioDramaRunner?: typeof generateForgeAudioDrama;
    ffmpegBackend?: FFmpegBackend;
  } = {},
) {
  const backendRoot = path.resolve(input.rootDir ?? process.cwd());
  const storageRoot = resolveMediaForgeRoot(backendRoot);
  const manager = await SeedSessionManager.load(path.resolve(storageRoot, input.sessionDir));
  const rootId = rootSeedIdFromClipId(input.sourceId);
  const chain = manager.getExtensionChain(rootId);
  const outputPath = path.resolve(
    storageRoot,
    input.outputPath ?? path.join(manager.sessionDir, `composed-${rootId.split("-")[1]}.mp4`),
  );

  if (input.simulate) {
    const audioPreview = input.withAudio && manager.manifest.voiceover?.enabled
      ? path.join(manager.sessionDir, `${rootId}-voiceover.wav`)
      : undefined;
    const subtitlesPreview = input.withAudio && manager.manifest.voiceover?.enabled
      ? path.join(manager.sessionDir, `${rootId}-voiceover.srt`)
      : undefined;
    await manager.saveComposition({
      output: path.relative(manager.sessionDir, outputPath),
      rootId,
      ...(audioPreview ? { audio: path.relative(manager.sessionDir, audioPreview) } : {}),
      ...(subtitlesPreview ? { subtitles: path.relative(manager.sessionDir, subtitlesPreview) } : {}),
      ...(input.upscale ? { upscaled: `x${input.upscale}` } : {}),
      ...(typeof input.withAudio === "boolean" ? { withAudio: input.withAudio } : {}),
    });
    return {
      ...(audioPreview ? { audio_path: audioPreview } : {}),
      chain_ids: chain.map((entry) => entry.id),
      output_path: outputPath,
      session_dir: manager.sessionDir,
      source_id: rootId,
      status: "simulated" as const,
      ...(subtitlesPreview ? { subtitles_path: subtitlesPreview } : {}),
      with_audio: input.withAudio ?? false,
    };
  }

  const ffmpeg = dependencies.ffmpegBackend ?? new FFmpegBackend({ rootDir: backendRoot });
  const tempFiles: string[] = [];
  const inputFiles = [
    resolveSessionArtifactPath(manager.sessionDir, chain[0]?.file ?? ""),
  ];

  for (const extension of chain.slice(1)) {
    const extensionPath = resolveSessionArtifactPath(manager.sessionDir, extension.file);
    const info = await ffmpeg.getMediaInfo(extensionPath);
    const overlapFrames = "overlapFrames" in extension ? extension.overlapFrames : 0;
    const trimStartSeconds = overlapFrames / DEFAULT_VIDEO_FPS;
    const trimmedPath = path.join(os.tmpdir(), `mediaforge-compose-${extension.id}.mp4`);
    tempFiles.push(trimmedPath);
    await ffmpeg.cut(
      extensionPath,
      formatFfmpegTimestamp(trimStartSeconds),
      formatFfmpegTimestamp(Math.max(info.duration, trimStartSeconds + 0.1)),
      trimmedPath,
    );
    inputFiles.push(trimmedPath);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });

  const baseOutputPath = input.withAudio
    ? path.join(os.tmpdir(), `mediaforge-compose-base-${Date.now()}.mp4`)
    : outputPath;

  if (inputFiles.length === 1) {
    const [firstInput] = inputFiles;
    if (!firstInput) {
      throw new Error(`No clip inputs found for ${rootId}.`);
    }
    await copyFile(firstInput, baseOutputPath);
  } else {
    await ffmpeg.concat(inputFiles, baseOutputPath);
  }

  let audioPath: string | undefined;
  let subtitlesPath: string | undefined;

  if (input.withAudio) {
    const voiceover = manager.manifest.voiceover;
    if (!voiceover?.enabled || voiceover.segments.length === 0) {
      throw new Error("Voiceover metadata is required when compose uses --with-audio.");
    }

    const dramaRunner = dependencies.audioDramaRunner ?? generateForgeAudioDrama;
    audioPath = path.join(manager.sessionDir, `${rootId}-voiceover.wav`);
    subtitlesPath = path.join(manager.sessionDir, `${rootId}-voiceover.srt`);
    const scriptText = voiceover.segments
      .map((segment) => `${segment.speaker}: ${segment.dialogue}`)
      .join("\n");
    const speakerNames = [...new Set(voiceover.segments.map((segment) => segment.speaker))];

    await dramaRunner({
      outputPath: audioPath,
      scriptText,
      speakerNames,
    });
    await writeFile(
      subtitlesPath,
      buildSrt(voiceover.segments),
      "utf8",
    );
    const mixedOutputPath = path.join(os.tmpdir(), `mediaforge-compose-mixed-${Date.now()}.mp4`);
    await ffmpeg.addAudio(baseOutputPath, audioPath, 1, mixedOutputPath);
    await ffmpeg.addSubtitles(mixedOutputPath, subtitlesPath, outputPath);
    tempFiles.push(baseOutputPath);
    tempFiles.push(mixedOutputPath);
  }

  await cleanupFiles(tempFiles);
  await manager.saveComposition({
    output: path.relative(manager.sessionDir, outputPath),
    rootId,
    ...(audioPath ? { audio: path.relative(manager.sessionDir, audioPath) } : {}),
    ...(subtitlesPath ? { subtitles: path.relative(manager.sessionDir, subtitlesPath) } : {}),
    ...(input.upscale ? { upscaled: `x${input.upscale}` } : {}),
    ...(typeof input.withAudio === "boolean" ? { withAudio: input.withAudio } : {}),
  });

  return {
    ...(audioPath ? { audio_path: audioPath } : {}),
    chain_ids: chain.map((entry) => entry.id),
    output_path: outputPath,
    session_dir: manager.sessionDir,
    source_id: rootId,
    status: "completed" as const,
    ...(subtitlesPath ? { subtitles_path: subtitlesPath } : {}),
    with_audio: input.withAudio ?? false,
  };
}

function buildSrt(
  segments: Array<{
    end: number;
    start: number;
    subtitle: string;
  }>,
): string {
  return `${segments.map((segment, index) => [
    String(index + 1),
    `${formatSrtTimestamp(segment.start)} --> ${formatSrtTimestamp(segment.end)}`,
    segment.subtitle,
  ].join("\n")).join("\n\n")}\n`;
}

function formatSrtTimestamp(seconds: number): string {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
  const millis = totalMilliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}
