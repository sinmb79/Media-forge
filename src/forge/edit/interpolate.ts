import * as path from "node:path";

import { FFmpegBackend } from "../../backends/ffmpeg.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export interface InterpolateVideoResult {
  backend: "ffmpeg";
  fps: number;
  output_path: string;
  request_id: string;
  status: "completed" | "simulated";
}

export async function runInterpolateVideo(
  input: {
    fps: number;
    inputPath: string;
    outputDir?: string;
    rootDir?: string;
    simulate?: boolean;
  },
  dependencies: {
    ffmpeg?: {
      execute(request: {
        args?: string[];
        cwd?: string;
      }): Promise<{
        exitCode: number;
        stderr: string;
        stdout: string;
      }>;
    };
  } = {},
): Promise<InterpolateVideoResult> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const requestId = createRequestId({
    fps: input.fps,
    inputPath: input.inputPath,
    operation: "interpolate",
  });
  const outputPath = path.resolve(
    rootDir,
    input.outputDir ?? "outputs",
    `${path.basename(input.inputPath, path.extname(input.inputPath))}-interpolate${path.extname(input.inputPath) || ".mp4"}`,
  );

  if (input.simulate) {
    return {
      backend: "ffmpeg",
      fps: input.fps,
      output_path: outputPath,
      request_id: requestId,
      status: "simulated",
    };
  }

  const ffmpeg = dependencies.ffmpeg ?? new FFmpegBackend();
  await ffmpeg.execute({
    args: [
      "-y",
      "-i",
      input.inputPath,
      "-vf",
      `minterpolate=fps=${input.fps}:mi_mode=mci:mc_mode=aobmc`,
      outputPath,
    ],
  });

  return {
    backend: "ffmpeg",
    fps: input.fps,
    output_path: outputPath,
    request_id: requestId,
    status: "completed",
  };
}
