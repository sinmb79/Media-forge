import * as path from "node:path";

import { FFmpegBackend } from "../../backends/ffmpeg.js";

export async function addSubtitlesToVideo(
  input: {
    outputPath?: string;
    subtitlesPath: string;
    videoPath: string;
  },
  dependencies: {
    ffmpeg?: {
      addSubtitles(video: string, srt: string, output: string): Promise<string>;
    };
  } = {},
): Promise<{
  operation: "add-subs";
  output_path: string;
}> {
  const ffmpeg = dependencies.ffmpeg ?? new FFmpegBackend();
  const outputPath = input.outputPath ?? path.resolve(
    process.cwd(),
    "outputs",
    `${path.basename(input.videoPath, path.extname(input.videoPath))}-add-subs${path.extname(input.videoPath) || ".mp4"}`,
  );

  return {
    operation: "add-subs",
    output_path: await ffmpeg.addSubtitles(input.videoPath, input.subtitlesPath, outputPath),
  };
}
