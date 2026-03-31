import { copyFile, mkdir, rename, rm, unlink } from "node:fs/promises";
import * as path from "node:path";

import { FFmpegBackend } from "../../backends/ffmpeg.js";

export const DEFAULT_VIDEO_FPS = 16;

export function resolveSessionArtifactPath(sessionDir: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(sessionDir, filePath);
}

export function rootSeedIdFromClipId(id: string): string {
  if (id.startsWith("seed-")) {
    return id;
  }

  const [, middle] = id.split("-");
  return `seed-${middle ?? "001"}`;
}

export async function relocateVideoArtifact(sourcePath: string, targetPath: string): Promise<string> {
  if (path.resolve(sourcePath) === path.resolve(targetPath)) {
    return targetPath;
  }

  await mkdir(path.dirname(targetPath), { recursive: true });

  try {
    await rename(sourcePath, targetPath);
  } catch {
    await copyFile(sourcePath, targetPath);
    await unlink(sourcePath).catch(() => undefined);
  }

  return targetPath;
}

export async function createVideoThumbnail(
  inputVideoPath: string,
  thumbnailPath: string,
  ffmpeg: FFmpegBackend,
): Promise<string> {
  await mkdir(path.dirname(thumbnailPath), { recursive: true });
  await ffmpeg.execute({
    args: ["-y", "-i", inputVideoPath, "-frames:v", "1", thumbnailPath],
  });
  return thumbnailPath;
}

export async function cleanupFiles(paths: string[]): Promise<void> {
  for (const filePath of paths) {
    await rm(filePath, { force: true });
  }
}

export function formatFfmpegTimestamp(seconds: number): string {
  return seconds.toFixed(3);
}
