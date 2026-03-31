import * as path from "node:path";

import { FFmpegBackend } from "../../backends/ffmpeg.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export interface VisualMusicVizOptions {
  audioPath: string;
  outputDir?: string;
  rootDir?: string;
  simulate?: boolean;
  style: "spectrum" | "waveform";
}

export async function runMusicVisualization(
  input: VisualMusicVizOptions,
  dependencies: {
    ffmpeg?: Pick<FFmpegBackend, "execute">;
  } = {},
): Promise<{
    audio_path: string;
    operation: "visual-music-viz";
    output_path: string;
    status: "simulated" | "completed";
    style: VisualMusicVizOptions["style"];
  }> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const outputPath = path.resolve(
    rootDir,
    input.outputDir ?? "outputs",
    `${path.basename(input.audioPath, path.extname(input.audioPath))}-${input.style}-viz.mp4`,
  );

  if (input.simulate) {
    return {
      audio_path: input.audioPath,
      operation: "visual-music-viz",
      output_path: outputPath,
      status: "simulated",
      style: input.style,
    };
  }

  await (dependencies.ffmpeg ?? new FFmpegBackend()).execute({
    args: buildMusicVizArgs(input.audioPath, outputPath, input.style),
  });

  return {
    audio_path: input.audioPath,
    operation: "visual-music-viz",
    output_path: outputPath,
    status: "completed",
    style: input.style,
  };
}

function buildMusicVizArgs(
  audioPath: string,
  outputPath: string,
  style: VisualMusicVizOptions["style"],
): string[] {
  const filter = style === "waveform"
    ? "[0:a]showwaves=s=1280x720:mode=cline:colors=0x00ff88[v]"
    : "[0:a]showspectrum=s=1280x720:mode=combined:color=rainbow:scale=lin:slide=scroll[v]";

  return [
    "-y",
    "-i",
    audioPath,
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-map",
    "0:a",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    outputPath,
  ];
}
