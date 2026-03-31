import * as path from "node:path";

import { FFmpegBackend } from "../../backends/ffmpeg.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { runVisualRender } from "./render.js";

export interface VisualCompositeOptions {
  foreground: string;
  background: string;
  blend: "overlay" | "screen" | "multiply" | "add";
  rootDir?: string;
  outputDir?: string;
  simulate?: boolean;
}

export async function runVisualComposite(
  input: VisualCompositeOptions,
  dependencies: {
    ffmpeg?: Pick<FFmpegBackend, "execute">;
    renderBackground?: (input: {
      durationSec: number;
      outputDir?: string;
      rootDir?: string;
      simulate?: boolean;
      template: string;
    }) => Promise<{ output_path: string }>;
  } = {},
): Promise<{
    operation: "visual-composite";
    output_path: string;
    background: string;
    blend: VisualCompositeOptions["blend"];
    status: "simulated" | "completed";
  }> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const outputPath = path.resolve(
    rootDir,
    input.outputDir ?? "outputs",
    `${path.basename(input.foreground, path.extname(input.foreground))}-visual-composite.mp4`,
  );

  if (input.simulate) {
    return {
      background: input.background,
      blend: input.blend,
      operation: "visual-composite",
      output_path: outputPath,
      status: "simulated",
    };
  }

  const backgroundVideo = await (dependencies.renderBackground ?? runVisualRender)({
    durationSec: 5,
    rootDir,
    simulate: false,
    template: input.background,
  });

  await (dependencies.ffmpeg ?? new FFmpegBackend()).execute({
    args: [
      "-y",
      "-i",
      input.foreground,
      "-i",
      backgroundVideo.output_path,
      "-filter_complex",
      buildBlendFilter(input.blend),
      "-shortest",
      outputPath,
    ],
  });

  return {
    background: input.background,
    blend: input.blend,
    operation: "visual-composite",
    output_path: outputPath,
    status: "completed",
  };
}

function buildBlendFilter(blend: VisualCompositeOptions["blend"]): string {
  if (blend === "screen") {
    return "[0:v][1:v]blend=all_mode=screen";
  }

  if (blend === "multiply") {
    return "[0:v][1:v]blend=all_mode=multiply";
  }

  if (blend === "add") {
    return "[0:v][1:v]blend=all_mode=addition";
  }

  return "[0:v][1:v]overlay=shortest=1";
}
