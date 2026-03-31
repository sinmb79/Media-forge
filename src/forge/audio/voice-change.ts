import * as path from "node:path";

import { FFmpegBackend } from "../../backends/ffmpeg.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export async function changeVoicePitch(
  input: {
    inputPath: string;
    pitch: number;
    rootDir?: string;
    outputDir?: string;
    simulate?: boolean;
  },
  dependencies: {
    ffmpeg?: Pick<FFmpegBackend, "execute">;
  } = {},
): Promise<{
    operation: "voice-change";
    backend: "ffmpeg";
    output_path: string;
    pitch: number;
    status: "simulated" | "completed";
  }> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const outputPath = path.resolve(
    rootDir,
    input.outputDir ?? "outputs",
    `${path.basename(input.inputPath, path.extname(input.inputPath))}-voice-change${path.extname(input.inputPath) || ".mp3"}`,
  );

  if (input.simulate) {
    return {
      backend: "ffmpeg",
      operation: "voice-change",
      output_path: outputPath,
      pitch: input.pitch,
      status: "simulated",
    };
  }

  await (dependencies.ffmpeg ?? new FFmpegBackend()).execute({
    args: [
      "-y",
      "-i",
      input.inputPath,
      "-af",
      `rubberband=pitch=${input.pitch}`,
      outputPath,
    ],
  });

  return {
    backend: "ffmpeg",
    operation: "voice-change",
    output_path: outputPath,
    pitch: input.pitch,
    status: "completed",
  };
}
