import * as path from "node:path";

import { FFmpegBackend } from "../../backends/ffmpeg.js";

export async function addBackgroundMusicToVideo(
  input: {
    musicPath: string;
    outputPath?: string;
    videoPath: string;
    volume: number;
  },
  dependencies: {
    ffmpeg?: {
      addAudio(video: string, audio: string, volume: number, output: string): Promise<string>;
    };
  } = {},
): Promise<{
  operation: "add-bgm";
  output_path: string;
}> {
  const ffmpeg = dependencies.ffmpeg ?? new FFmpegBackend();
  const outputPath = input.outputPath ?? path.resolve(
    process.cwd(),
    "outputs",
    `${path.basename(input.videoPath, path.extname(input.videoPath))}-add-bgm${path.extname(input.videoPath) || ".mp4"}`,
  );

  return {
    operation: "add-bgm",
    output_path: await ffmpeg.addAudio(input.videoPath, input.musicPath, input.volume, outputPath),
  };
}
