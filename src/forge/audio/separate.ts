import * as path from "node:path";

import { FFmpegBackend } from "../../backends/ffmpeg.js";

export async function separateMediaAudio(
  input: {
    inputPath: string;
    outputPath?: string;
  },
  dependencies: {
    ffmpeg?: {
      extractAudio(video: string, output: string): Promise<string>;
    };
  } = {},
): Promise<{
  backend: "ffmpeg";
  operation: "separate";
  output_path: string;
}> {
  const ffmpeg = dependencies.ffmpeg ?? new FFmpegBackend();
  const outputPath = input.outputPath ?? path.resolve(
    process.cwd(),
    "outputs",
    `${path.basename(input.inputPath, path.extname(input.inputPath))}-separate${path.extname(input.inputPath) || ".mp4"}`,
  );

  return {
    backend: "ffmpeg",
    operation: "separate",
    output_path: await ffmpeg.extractAudio(input.inputPath, outputPath),
  };
}
