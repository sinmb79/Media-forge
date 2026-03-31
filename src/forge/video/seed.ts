import * as path from "node:path";

import { FFmpegBackend } from "../../backends/ffmpeg.js";
import { resolveLLMClient } from "../../backends/resolve-llm-client.js";
import { buildForgePromptBundle, type ForgePromptClient } from "../../prompt/forge-prompt-builder.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { runVideoFromImage, type ForgeVideoResult } from "./from-image.js";
import { runVideoFromText } from "./from-text.js";
import { runSkyReelsRef2V } from "./ref2v.js";
import {
  createVideoThumbnail,
  relocateVideoArtifact,
} from "./session-files.js";
import {
  SeedSessionManager,
  type SeedSessionVoiceover,
  type SeedCandidate,
} from "./seed-session.js";
import type { ForgeVideoModel, ForgeVideoQuality } from "./build-video-generation-plan.js";

export interface VideoSeedSessionOptions {
  candidates: number;
  desc_ko: string;
  duration_sec: number;
  fromImagePath?: string;
  model: ForgeVideoModel;
  outputDir: string;
  quality: ForgeVideoQuality;
  referencePaths?: string[];
  rootDir?: string;
  simulate?: boolean;
  theme?: string | null;
  voiceover?: SeedSessionVoiceover;
}

export interface VideoSeedSessionResult {
  candidates: SeedCandidate[];
  manifest_path: string;
  prompt_en?: string;
  session_dir: string;
  status: "simulated" | "completed";
  workflow_ids: string[];
}

export async function runVideoSeedSession(
  input: VideoSeedSessionOptions,
  dependencies: {
    ffmpegBackend?: FFmpegBackend;
    ollamaClient?: ForgePromptClient;
  } = {},
): Promise<VideoSeedSessionResult> {
  const backendRoot = path.resolve(input.rootDir ?? process.cwd());
  const storageRoot = resolveMediaForgeRoot(backendRoot);
  const sessionDir = path.resolve(storageRoot, input.outputDir);
  const promptBundle = await buildPromptBundleWithFallback(
    input.desc_ko,
    backendRoot,
    dependencies.ollamaClient,
    input.theme,
  );
  const manager = await SeedSessionManager.create({
    candidateCount: input.candidates,
    duration: input.duration_sec,
    model: input.model,
    outputDir: sessionDir,
    prompt: input.desc_ko,
    promptEn: promptBundle.video_prompt,
    ...(input.referencePaths && input.referencePaths.length > 0 ? { refs: input.referencePaths } : {}),
    ...(input.fromImagePath ? { sourceImagePath: input.fromImagePath } : {}),
    ...(input.voiceover ? { voiceover: input.voiceover } : {}),
  });
  const ffmpeg = dependencies.ffmpegBackend ?? new FFmpegBackend({ rootDir: backendRoot });
  const workflowIds = new Set<string>();

  for (const candidate of manager.manifest.candidates) {
    const targetRelativePath = `${candidate.id}.mp4`;
    const thumbnailRelativePath = path.join("thumbnails", `${candidate.id}.jpg`);

    if (input.simulate) {
      await manager.registerCandidateResult(candidate.id, {
        file: targetRelativePath,
        seed: candidate.seed,
        status: "generated",
        thumbnail: thumbnailRelativePath,
      });
      continue;
    }

    const result = await runSeedCandidate({
      candidate,
      desc_ko: input.desc_ko,
      duration_sec: input.duration_sec,
      model: input.model,
      quality: input.quality,
      rootDir: backendRoot,
      ...(input.fromImagePath ? { fromImagePath: input.fromImagePath } : {}),
      ...(input.referencePaths && input.referencePaths.length > 0 ? { referencePaths: input.referencePaths } : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
    });
    workflowIds.add(result.workflow_id);

    const targetAbsolutePath = path.join(sessionDir, targetRelativePath);
    await relocateVideoArtifact(result.output_path, targetAbsolutePath);
    await createVideoThumbnail(
      targetAbsolutePath,
      path.join(sessionDir, thumbnailRelativePath),
      ffmpeg,
    );
    await manager.registerCandidateResult(candidate.id, {
      file: targetRelativePath,
      seed: candidate.seed,
      status: "generated",
      thumbnail: thumbnailRelativePath,
    });
  }

  return {
    candidates: manager.manifest.candidates,
    manifest_path: manager.manifestPath,
    prompt_en: promptBundle.video_prompt,
    session_dir: manager.sessionDir,
    status: input.simulate ? "simulated" : "completed",
    workflow_ids: workflowIds.size > 0 ? [...workflowIds] : [resolveWorkflowId(input.model, input.fromImagePath)],
  };
}

async function runSeedCandidate(
  input: {
    candidate: SeedCandidate;
    desc_ko: string;
    duration_sec: number;
    fromImagePath?: string;
    model: ForgeVideoModel;
    quality: ForgeVideoQuality;
    referencePaths?: string[];
    rootDir: string;
    theme?: string | null;
  },
): Promise<ForgeVideoResult> {
  if (input.model === "skyreels-ref2v" && input.referencePaths && input.referencePaths.length > 0) {
    return runSkyReelsRef2V({
      desc_ko: input.desc_ko,
      duration_sec: input.duration_sec,
      quality: input.quality,
      referencePaths: input.referencePaths,
      rootDir: input.rootDir,
      seed: input.candidate.seed,
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
    });
  }

  if (input.fromImagePath) {
    return runVideoFromImage({
      desc_ko: input.desc_ko,
      duration_sec: input.duration_sec,
      imagePath: input.fromImagePath,
      model: input.model === "ltx2" ? "ltx2" : "wan22",
      quality: input.quality,
      rootDir: input.rootDir,
      seed: input.candidate.seed,
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
    });
  }

  return runVideoFromText({
    desc_ko: input.desc_ko,
    duration_sec: input.duration_sec,
    model: input.model === "ltx2" ? "ltx2" : "wan22",
    quality: input.quality,
    rootDir: input.rootDir,
    seed: input.candidate.seed,
    ...(input.theme !== undefined ? { theme: input.theme } : {}),
  });
}

function resolveWorkflowId(model: ForgeVideoModel, fromImagePath?: string): string {
  if (model === "skyreels-ref2v") {
    return "skyreels_v3_ref2v_fp8";
  }

  if (fromImagePath) {
    return model === "ltx2" ? "ltx2_i2v_gguf_q4" : "wan22_i2v_gguf_q8";
  }

  return "wan22_t2v_gguf";
}

async function buildPromptBundleWithFallback(
  desc_ko: string,
  rootDir: string,
  ollamaClient?: ForgePromptClient,
  theme?: string | null,
) {
  try {
    return await buildForgePromptBundle({
      desc_ko,
      ollamaClient: ollamaClient ?? await resolveLLMClient({ rootDir }),
      ...(theme !== undefined ? { theme } : {}),
    });
  } catch {
    return {
      desc_ko,
      image_negative: "",
      image_prompt: desc_ko,
      source: "fallback" as const,
      theme: theme ?? null,
      video_negative: "",
      video_prompt: desc_ko,
    };
  }
}
