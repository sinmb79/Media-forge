import * as path from "node:path";

import { FFmpegBackend, type MediaInfo } from "../../backends/ffmpeg.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export interface SmartCutResult {
  operation: "smart-cut";
  backend: "ffmpeg";
  output_path: string;
  segments: Array<{
    start: string;
    end: string;
  }>;
  status: "simulated" | "completed";
}

export async function runSmartCut(
  input: {
    inputPath: string;
    targetDurationSec: number;
    rootDir?: string;
    outputDir?: string;
    simulate?: boolean;
  },
  dependencies: {
    ffmpeg?: Pick<FFmpegBackend, "concat" | "cut" | "getMediaInfo">;
  } = {},
): Promise<SmartCutResult> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const outputDir = path.resolve(rootDir, input.outputDir ?? "outputs");
  const outputPath = path.resolve(
    outputDir,
    `${path.basename(input.inputPath, path.extname(input.inputPath))}-smart-cut${path.extname(input.inputPath) || ".mp4"}`,
  );
  const ffmpeg = dependencies.ffmpeg ?? new FFmpegBackend();
  const mediaInfo = await ffmpeg.getMediaInfo(input.inputPath);
  const segments = buildHighlightSegments(mediaInfo, input.targetDurationSec);

  if (input.simulate) {
    return {
      backend: "ffmpeg",
      operation: "smart-cut",
      output_path: outputPath,
      segments,
      status: "simulated",
    };
  }

  const renderedSegments: string[] = [];
  for (const [index, segment] of segments.entries()) {
    const segmentOutput = path.resolve(
      outputDir,
      `${path.basename(input.inputPath, path.extname(input.inputPath))}-smart-cut-${index + 1}${path.extname(input.inputPath) || ".mp4"}`,
    );
    await ffmpeg.cut(input.inputPath, segment.start, segment.end, segmentOutput);
    renderedSegments.push(segmentOutput);
  }

  await ffmpeg.concat(renderedSegments, outputPath);

  return {
    backend: "ffmpeg",
    operation: "smart-cut",
    output_path: outputPath,
    segments,
    status: "completed",
  };
}

function buildHighlightSegments(
  mediaInfo: MediaInfo,
  targetDurationSec: number,
): Array<{ start: string; end: string }> {
  const segmentCount = Math.max(1, Math.min(3, Math.ceil(targetDurationSec / 10)));
  const segmentDuration = Math.max(3, Math.floor(targetDurationSec / segmentCount));
  const stride = mediaInfo.duration > targetDurationSec
    ? Math.max(1, Math.floor((mediaInfo.duration - segmentDuration) / segmentCount))
    : segmentDuration;

  return Array.from({ length: segmentCount }, (_, index) => {
    const startSec = Math.max(0, Math.min(mediaInfo.duration, index * stride));
    const endSec = Math.min(mediaInfo.duration, startSec + segmentDuration);
    return {
      end: formatTimecode(endSec),
      start: formatTimecode(startSec),
    };
  });
}

function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hrs = String(Math.floor(total / 3600)).padStart(2, "0");
  const mins = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}
