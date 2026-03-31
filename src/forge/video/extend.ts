import * as path from "node:path";

import { FFmpegBackend } from "../../backends/ffmpeg.js";
import { ComfyUIBackend } from "../../backends/comfyui.js";
import { resolveLLMClient } from "../../backends/resolve-llm-client.js";
import { buildForgePromptBundle, type ForgePromptClient } from "../../prompt/forge-prompt-builder.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { loadJsonConfigFile } from "../config/load-json-config.js";
import type { HardwareProfile } from "../contracts.js";
import { loadWorkflowTemplate } from "../workflows/load-workflow-template.js";
import { buildVideoGenerationPlan, type ForgeVideoQuality } from "./build-video-generation-plan.js";
import { composeSeedSession } from "./compose.js";
import type { ForgeVideoResult } from "./from-image.js";
import {
  createVideoThumbnail,
  relocateVideoArtifact,
  resolveSessionArtifactPath,
  rootSeedIdFromClipId,
} from "./session-files.js";
import { SeedSessionManager } from "./seed-session.js";

export interface SkyReelsExtendOptions {
  desc_ko: string;
  duration_sec?: number;
  outputDir?: string;
  overlap_frames?: number;
  quality: ForgeVideoQuality;
  rootDir?: string;
  seed?: number;
  simulate?: boolean;
  sourceVideoPath: string;
  theme?: string | null;
}

export async function runSkyReelsVideoExtend(
  input: SkyReelsExtendOptions,
  dependencies: {
    comfyClient?: ComfyUIBackend;
    freeVramGb?: number | null;
    hardwareProfile?: HardwareProfile | null;
    ollamaClient?: ForgePromptClient;
  } = {},
): Promise<ForgeVideoResult> {
  const requestId = createRequestId(input);
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const promptBundle = await buildForgePromptBundle({
    desc_ko: input.desc_ko,
    ollamaClient: dependencies.ollamaClient ?? await resolveLLMClient({ rootDir }),
    theme: input.theme,
  });
  const hardwareProfile = dependencies.hardwareProfile ?? await loadHardwareProfile(rootDir);
  const plan = await buildVideoGenerationPlan({
    desc_ko: input.desc_ko,
    freeVramGb: dependencies.freeVramGb ?? hardwareProfile?.gpu?.vram_gb ?? null,
    hardwareProfile,
    mode: "extend",
    model: "skyreels-v2v",
    quality: input.quality,
    sourceVideoPath: input.sourceVideoPath,
    ...(typeof input.overlap_frames === "number" ? { overlapFrames: input.overlap_frames } : {}),
  });
  const outputPath = path.resolve(rootDir, input.outputDir ?? "outputs", `${requestId}.mp4`);

  if (input.simulate) {
    return {
      output_path: outputPath,
      prompt_bundle: promptBundle,
      request_id: requestId,
      status: "simulated",
      workflow_id: plan.workflow_id,
    };
  }

  const workflow = await loadWorkflowTemplate(plan.workflow_id, {
    duration_sec: input.duration_sec ?? 5,
    negative_prompt: promptBundle.video_negative,
    output_path: outputPath,
    overlap_frames: input.overlap_frames ?? 8,
    prompt: promptBundle.video_prompt,
    seed: input.seed ?? Math.floor(Math.random() * 2147483647),
    source_video_path: input.sourceVideoPath,
  }, rootDir);
  const comfyClient = dependencies.comfyClient ?? new ComfyUIBackend({ autoStart: true, rootDir });
  const queued = await comfyClient.queueWorkflow(workflow);
  const status = await comfyClient.waitForCompletion(queued.prompt_id);
  const firstOutput = status.outputs[0];

  if (!firstOutput) {
    throw new Error("ComfyUI SkyReels extension workflow finished without video outputs.");
  }

  await comfyClient.saveDownloadedOutput(firstOutput, outputPath);

  return {
    output_path: outputPath,
    prompt_bundle: promptBundle,
    request_id: requestId,
    status: "completed",
    workflow_id: plan.workflow_id,
  };
}

async function loadHardwareProfile(rootDir: string): Promise<HardwareProfile | null> {
  try {
    return await loadJsonConfigFile<HardwareProfile>(
      path.resolve(rootDir, "config", "hardware-profile.yaml"),
    );
  } catch {
    return null;
  }
}

export async function runSessionVideoExtend(
  input: {
    desc_ko: string;
    duration_sec?: number;
    loops?: number;
    overlap_frames?: number;
    quality: ForgeVideoQuality;
    rootDir?: string;
    sessionDir: string;
    simulate?: boolean;
    sourceId: string;
    theme?: string | null;
  },
  dependencies: {
    comfyClient?: ComfyUIBackend;
    ffmpegBackend?: FFmpegBackend;
    freeVramGb?: number | null;
    hardwareProfile?: HardwareProfile | null;
    ollamaClient?: ForgePromptClient;
  } = {},
): Promise<{
  composed_output_path: string;
  extension_id: string;
  output_path: string;
  session_dir: string;
  source_id: string;
  status: "simulated" | "completed";
}> {
  const backendRoot = path.resolve(input.rootDir ?? process.cwd());
  const storageRoot = resolveMediaForgeRoot(backendRoot);
  const manager = await SeedSessionManager.load(path.resolve(storageRoot, input.sessionDir));
  const ffmpeg = dependencies.ffmpegBackend ?? new FFmpegBackend({ rootDir: backendRoot });
  const loops = Math.max(1, input.loops ?? 1);
  let sourceId = input.sourceId;
  let lastOutputPath = "";
  let lastExtensionId = "";

  for (let index = 0; index < loops; index += 1) {
    const sourceClip = manager.findClip(sourceId);
    const extensionId = (() => {
      const rootId = rootSeedIdFromClipId(sourceClip.id);
      const rootSuffix = rootId.split("-")[1] ?? "001";
      const count = manager.manifest.extensions.filter((entry) => entry.id.startsWith(`ext-${rootSuffix}-`)).length + 1;
      return `ext-${rootSuffix}-${String(count).padStart(3, "0")}`;
    })();
    const extensionRelativePath = `${extensionId}.mp4`;

    if (input.simulate) {
      await manager.addExtension({
        addedDuration: input.duration_sec ?? 5,
        file: extensionRelativePath,
        overlapFrames: input.overlap_frames ?? 8,
        parent: sourceClip.id,
        prompt: input.desc_ko,
      });
      lastOutputPath = path.join(manager.sessionDir, extensionRelativePath);
      lastExtensionId = extensionId;
      sourceId = extensionId;
      continue;
    }

    const sourceVideoPath = resolveSessionArtifactPath(manager.sessionDir, sourceClip.file);
    const result = await runSkyReelsVideoExtend(
      {
        desc_ko: input.desc_ko,
        ...(typeof input.duration_sec === "number" ? { duration_sec: input.duration_sec } : {}),
        ...(typeof input.overlap_frames === "number" ? { overlap_frames: input.overlap_frames } : {}),
        quality: input.quality,
        rootDir: backendRoot,
        simulate: false,
        sourceVideoPath,
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
      },
      dependencies,
    );
    const extensionAbsolutePath = path.join(manager.sessionDir, extensionRelativePath);
    const thumbnailRelativePath = path.join("thumbnails", `${extensionId}.jpg`);

    await relocateVideoArtifact(result.output_path, extensionAbsolutePath);
    await createVideoThumbnail(
      extensionAbsolutePath,
      path.join(manager.sessionDir, thumbnailRelativePath),
      ffmpeg,
    );
    await manager.addExtension({
      addedDuration: input.duration_sec ?? 5,
      file: extensionRelativePath,
      overlapFrames: input.overlap_frames ?? 8,
      parent: sourceClip.id,
      prompt: input.desc_ko,
      thumbnail: thumbnailRelativePath,
    });
    lastOutputPath = extensionAbsolutePath;
    lastExtensionId = extensionId;
    sourceId = extensionId;
  }

  const composed = await composeSeedSession({
    rootDir: backendRoot,
    sessionDir: manager.sessionDir,
    ...(input.simulate !== undefined ? { simulate: input.simulate } : {}),
    sourceId: rootSeedIdFromClipId(input.sourceId),
  }, {
    ffmpegBackend: ffmpeg,
  });

  return {
    composed_output_path: composed.output_path,
    extension_id: lastExtensionId,
    output_path: lastOutputPath,
    session_dir: manager.sessionDir,
    source_id: input.sourceId,
    status: input.simulate ? "simulated" : "completed",
  };
}
