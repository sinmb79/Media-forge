import { mapCameraLanguageToWan22 } from "../../motion/wan22-camera-map.js";
import { runVideoFromImage, type VideoFromImageOptions, type ForgeVideoResult } from "./from-image.js";

export interface MotionOptions {
  image_path: string;
  action: string;
  custom_motion?: string;
  duration_sec: number;
  direction: "forward" | "mirror";
  rootDir?: string;
  simulate?: boolean;
}

const MOTION_PRESETS: Record<string, string> = {
  belly_dance: "subject performs a rhythmic belly dance with flowing hip motion",
  chewing: "subject makes a subtle chewing motion with small facial movement",
  orbital: "camera orbits clockwise around subject",
  slow_push_in: "camera slowly pushes forward with shallow depth of field",
};

export function listMotionPresets(): Array<{ id: string; prompt: string }> {
  return Object.entries(MOTION_PRESETS).map(([id, prompt]) => ({ id, prompt }));
}

export function resolveMotionPrompt(options: MotionOptions): string {
  const basePrompt = options.action === "custom"
    ? options.custom_motion ?? "camera moves with a gentle cinematic motion"
    : MOTION_PRESETS[options.action] ?? options.action;

  if (options.direction === "mirror") {
    return `${basePrompt}, mirrored movement`;
  }

  return basePrompt;
}

export async function runMotionVideo(
  options: MotionOptions,
): Promise<ForgeVideoResult> {
  const prompt = mapCameraLanguageToWan22(resolveMotionPrompt(options));
  const input: VideoFromImageOptions = {
    desc_ko: prompt,
    imagePath: options.image_path,
    model: "wan22",
    quality: "draft",
    ...(options.rootDir ? { rootDir: options.rootDir } : {}),
    ...(options.simulate !== undefined ? { simulate: options.simulate } : {}),
  };

  return runVideoFromImage(input);
}
