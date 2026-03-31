import * as path from "node:path";

import {
  FFmpegBackend,
} from "../../../dist/src/backends/ffmpeg.js";
import {
  runInterpolateVideo,
} from "../../../dist/src/forge/edit/interpolate.js";
import {
  runJoinClips,
} from "../../../dist/src/forge/edit/join.js";
import {
  runRemoveObject,
} from "../../../dist/src/forge/edit/remove-object.js";
import {
  runRemoveWatermark,
} from "../../../dist/src/forge/edit/remove-watermark.js";
import {
  runSmartCut,
} from "../../../dist/src/forge/edit/smart-cut.js";
import {
  runUpscaleMedia,
} from "../../../dist/src/forge/edit/upscale.js";

export type DashboardEditTool =
  | "concat"
  | "cut"
  | "interpolate"
  | "join"
  | "remove-object"
  | "remove-watermark"
  | "resize"
  | "smart-cut"
  | "speed"
  | "stabilize"
  | "upscale";

export interface DashboardNormalizedEditRequest {
  end: string;
  extraInputs: string[];
  factor: number;
  fps: number;
  inputPath: string | null;
  maskPath: string | null;
  ratio: "1:1" | "16:9" | "9:16";
  resolution: "1080p" | "1440p" | "720p";
  scale: number;
  start: string;
  targetDurationSec: number;
  tool: DashboardEditTool;
  transition: "ai" | "fade";
}

const EDIT_TOOLS: DashboardEditTool[] = [
  "join",
  "concat",
  "cut",
  "speed",
  "resize",
  "stabilize",
  "upscale",
  "interpolate",
  "remove-watermark",
  "remove-object",
  "smart-cut",
] as const;

export function isDashboardEditTool(value: string): value is DashboardEditTool {
  return EDIT_TOOLS.includes(value as DashboardEditTool);
}

export function normalizeDashboardEditRequest(
  tool: DashboardEditTool,
  payload: Record<string, unknown>,
): DashboardNormalizedEditRequest {
  return {
    end: normalizeTimecode(payload.end, "00:05"),
    extraInputs: normalizeStringArray(payload.extraInputs),
    factor: clampNumber(payload.factor, 0.25, 4, 1),
    fps: clampInteger(payload.fps, 24, 120, 60),
    inputPath: normalizeOptionalString(payload.input),
    maskPath: normalizeOptionalString(payload.mask),
    ratio: normalizeRatio(payload.ratio),
    resolution: normalizeResolution(payload.resolution),
    scale: clampInteger(payload.scale, 1, 4, 2),
    start: normalizeTimecode(payload.start, "00:00"),
    targetDurationSec: clampInteger(payload.targetDuration, 5, 90, 30),
    tool,
    transition: payload.transition === "fade" ? "fade" : "ai",
  };
}

export function getDashboardEditMissingInputs(
  request: DashboardNormalizedEditRequest,
): string[] {
  const missingInputs: string[] = [];

  if (!request.inputPath) {
    missingInputs.push("input");
  }

  if (request.tool === "remove-object" && !request.maskPath) {
    missingInputs.push("mask");
  }

  return missingInputs;
}

export function getDashboardEditRequiredBackends(
  tool: DashboardEditTool,
  inputPath?: string | null,
): Array<"comfyui" | "ffmpeg" | "propainter"> {
  switch (tool) {
    case "join":
    case "upscale":
      return ["comfyui"];
    case "remove-object":
      return ["propainter"];
    case "remove-watermark":
      return isImageLikePath(inputPath) ? ["comfyui"] : ["propainter"];
    case "concat":
    case "cut":
    case "interpolate":
    case "resize":
    case "smart-cut":
    case "speed":
    case "stabilize":
      return ["ffmpeg"];
    default:
      return [];
  }
}

export async function runDashboardEditTool(
  tool: DashboardEditTool,
  payload: Record<string, unknown>,
  rootDir: string,
) {
  const request = normalizeDashboardEditRequest(tool, payload);
  const ffmpeg = new FFmpegBackend({ rootDir });

  switch (request.tool) {
    case "join":
      return runJoinClips({
        clipsDir: request.inputPath ?? "",
        rootDir,
        simulate: false,
        transition: request.transition,
      });
    case "concat": {
      const inputs = [request.inputPath, ...request.extraInputs].filter(Boolean) as string[];
      const outputPath = buildEditOutputPath(rootDir, request.inputPath, "concat");
      await ffmpeg.concat(inputs, outputPath);
      return {
        operation: "concat",
        output_path: outputPath,
        status: "completed" as const,
      };
    }
    case "cut": {
      const outputPath = buildEditOutputPath(rootDir, request.inputPath, "cut");
      await ffmpeg.cut(request.inputPath ?? "", request.start, request.end, outputPath);
      return {
        operation: "cut",
        output_path: outputPath,
        status: "completed" as const,
      };
    }
    case "speed": {
      const outputPath = buildEditOutputPath(rootDir, request.inputPath, "speed");
      await ffmpeg.speed(request.inputPath ?? "", request.factor, outputPath);
      return {
        operation: "speed",
        output_path: outputPath,
        status: "completed" as const,
      };
    }
    case "resize": {
      const outputPath = buildEditOutputPath(rootDir, request.inputPath, "resize");
      await ffmpeg.resize(request.inputPath ?? "", request.ratio, request.resolution, outputPath);
      return {
        operation: "resize",
        output_path: outputPath,
        status: "completed" as const,
      };
    }
    case "stabilize": {
      const outputPath = buildEditOutputPath(rootDir, request.inputPath, "stabilize");
      await ffmpeg.stabilize(request.inputPath ?? "", outputPath);
      return {
        operation: "stabilize",
        output_path: outputPath,
        status: "completed" as const,
      };
    }
    case "upscale":
      return runUpscaleMedia({
        inputPath: request.inputPath ?? "",
        rootDir,
        scale: request.scale,
        simulate: false,
      });
    case "interpolate":
      return runInterpolateVideo({
        fps: request.fps,
        inputPath: request.inputPath ?? "",
        rootDir,
        simulate: false,
      });
    case "remove-watermark":
      return runRemoveWatermark({
        inputPath: request.inputPath ?? "",
        ...(request.maskPath ? { maskPath: request.maskPath } : {}),
        rootDir,
        simulate: false,
      });
    case "remove-object":
      return runRemoveObject({
        inputPath: request.inputPath ?? "",
        maskPath: request.maskPath ?? "",
        rootDir,
        simulate: false,
      });
    case "smart-cut":
      return runSmartCut({
        inputPath: request.inputPath ?? "",
        rootDir,
        simulate: false,
        targetDurationSec: request.targetDurationSec,
      });
    default:
      throw new Error(`Unsupported edit tool: ${String(tool)}`);
  }
}

function buildEditOutputPath(
  rootDir: string,
  inputPath: string | null,
  operation: string,
): string {
  const extension = path.extname(inputPath ?? "") || ".mp4";
  const stem = inputPath
    ? path.basename(inputPath, path.extname(inputPath))
    : operation;
  const suffix = Date.now();
  return path.resolve(rootDir, "outputs", `${stem}-${operation}-${suffix}${extension}`);
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }

  return Number(Math.min(max, Math.max(min, numeric)).toFixed(2));
}

function isImageLikePath(filePath?: string | null): boolean {
  const extension = path.extname(filePath ?? "").toLowerCase();
  return extension === ".png" || extension === ".jpg" || extension === ".jpeg" || extension === ".webp";
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRatio(value: unknown): DashboardNormalizedEditRequest["ratio"] {
  return value === "1:1" || value === "16:9" ? value : "9:16";
}

function normalizeResolution(value: unknown): DashboardNormalizedEditRequest["resolution"] {
  if (value === "720p" || value === "1440p") {
    return value;
  }

  return "1080p";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function normalizeTimecode(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}
