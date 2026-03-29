import * as path from "node:path";

import { FFmpegBackend } from "../backends/ffmpeg.js";
import { runInterpolateVideo } from "../forge/edit/interpolate.js";
import { runJoinClips } from "../forge/edit/join.js";
import { runRemoveObject } from "../forge/edit/remove-object.js";
import { runRemoveWatermark } from "../forge/edit/remove-watermark.js";
import { runUpscaleMedia } from "../forge/edit/upscale.js";

export async function forgeEditCommand(
  positionals: string[],
  options: {
    json: boolean;
    optionValues: Record<string, string[]>;
    simulate: boolean;
  },
): Promise<{ exitCode: number; output: string }> {
  const [subcommand, input, ...rest] = positionals;
  const ffmpeg = new FFmpegBackend();

  if (!subcommand) {
    return {
      exitCode: 1,
      output: "Usage: engine forge edit <join|concat|cut|speed|resize|stabilize|upscale|interpolate|remove-watermark|remove-object> ...\n",
    };
  }

  if (options.simulate) {
    return {
      exitCode: 0,
      output: `${JSON.stringify({
        operation: subcommand,
        output_path: resolveEditOutputPath(input ?? "output.dat", subcommand),
        status: "simulated",
      }, null, 2)}\n`,
    };
  }

  switch (subcommand) {
    case "cut":
      if (!input) break;
      await ffmpeg.cut(input, options.optionValues.start?.[0] ?? "00:00", options.optionValues.end?.[0] ?? "00:01", resolveEditOutputPath(input, "cut"));
      return successResponse(options.json, "cut", resolveEditOutputPath(input, "cut"));
    case "join":
      if (!input) break;
      return renderOperationResult(
        options.json,
        "join",
        await runJoinClips({
          clipsDir: input,
          transition: options.optionValues.transition?.[0] ?? "ai",
        }),
      );
    case "concat":
      await ffmpeg.concat([input ?? "", ...rest].filter(Boolean), resolveEditOutputPath(input ?? "concat.mp4", "concat"));
      return successResponse(options.json, "concat", resolveEditOutputPath(input ?? "concat.mp4", "concat"));
    case "speed":
      if (!input) break;
      await ffmpeg.speed(input, Number(options.optionValues.factor?.[0] ?? "1"), resolveEditOutputPath(input, "speed"));
      return successResponse(options.json, "speed", resolveEditOutputPath(input, "speed"));
    case "resize":
      if (!input) break;
      await ffmpeg.resize(input, options.optionValues.ratio?.[0] ?? "9:16", options.optionValues.resolution?.[0] ?? "1080p", resolveEditOutputPath(input, "resize"));
      return successResponse(options.json, "resize", resolveEditOutputPath(input, "resize"));
    case "stabilize":
      if (!input) break;
      await ffmpeg.stabilize(input, resolveEditOutputPath(input, "stabilize"));
      return successResponse(options.json, "stabilize", resolveEditOutputPath(input, "stabilize"));
    case "upscale":
      if (!input) break;
      return renderOperationResult(
        options.json,
        "upscale",
        await runUpscaleMedia({
          inputPath: input,
          scale: Number(options.optionValues.scale?.[0] ?? "2"),
        }),
      );
    case "interpolate":
      if (!input) break;
      return renderOperationResult(
        options.json,
        "interpolate",
        await runInterpolateVideo({
          fps: Number(options.optionValues.fps?.[0] ?? "60"),
          inputPath: input,
        }),
      );
    case "remove-watermark":
      if (!input) break;
      return renderOperationResult(
        options.json,
        "remove-watermark",
        await runRemoveWatermark({
          inputPath: input,
          ...(options.optionValues.mask?.[0] ? { maskPath: options.optionValues.mask[0] } : {}),
        }),
      );
    case "remove-object":
      if (!input) break;
      return renderOperationResult(
        options.json,
        "remove-object",
        await runRemoveObject({
          inputPath: input,
          maskPath: options.optionValues.mask?.[0] ?? "",
        }),
      );
    default:
      break;
  }

  return {
    exitCode: 1,
    output: "Usage: engine forge edit <join|concat|cut|speed|resize|stabilize|upscale|interpolate|remove-watermark|remove-object> ...\n",
  };
}

function resolveEditOutputPath(input: string, operation: string): string {
  return path.resolve(process.cwd(), "outputs", `${path.basename(input, path.extname(input))}-${operation}${path.extname(input) || ".mp4"}`);
}

function successResponse(json: boolean, operation: string, outputPath: string) {
  return {
    exitCode: 0,
    output: json
      ? `${JSON.stringify({ operation, output_path: outputPath, status: "completed" }, null, 2)}\n`
      : `${operation} completed: ${outputPath}\n`,
  };
}

function renderOperationResult(
  json: boolean,
  operation: string,
  result: {
    output_path: string;
    status: string;
    workflow_id?: string | null;
  },
): { exitCode: number; output: string } {
  if (json) {
    return {
      exitCode: 0,
      output: `${JSON.stringify({ operation, ...result }, null, 2)}\n`,
    };
  }

  return {
    exitCode: 0,
    output: [
      `${operation} status: ${result.status}`,
      result.workflow_id ? `Workflow: ${result.workflow_id}` : null,
      `Output: ${result.output_path}`,
    ]
      .filter(Boolean)
      .join("\n") + "\n",
  };
}
