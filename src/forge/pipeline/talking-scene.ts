import * as path from "node:path";

import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { narrateForgeAudio } from "../audio/narrate.js";
import {
  getVoicePreset,
  type VoicePreset,
} from "../audio/voice-presets.js";
import { runSkyReelsTalkingAvatar } from "../video/talking.js";
import type { ForgeVideoQuality } from "../video/build-video-generation-plan.js";
import type { ForgeVideoResult } from "../video/from-image.js";
import type { VibeVoiceNarrationModel } from "../../backends/vibevoice.js";

export interface TalkingScenePipelineInput {
  audioPath?: string;
  desc_ko: string;
  duration_sec?: number;
  lang?: string;
  narrationModel?: VibeVoiceNarrationModel;
  portraitPath: string;
  quality: ForgeVideoQuality;
  rootDir?: string;
  simulate?: boolean;
  text?: string;
  theme?: string | null;
  voice?: string;
  voicePresetName?: string;
  voiceRootDir?: string;
}

export interface TalkingScenePipelineResult extends ForgeVideoResult {
  audio_path: string;
  resolved_preset: VoicePreset | null;
}

export async function runTalkingScenePipeline(
  input: TalkingScenePipelineInput,
  dependencies: {
    narrationRunner?: typeof narrateForgeAudio;
    presetLoader?: typeof getVoicePreset;
    talkingRunner?: typeof runSkyReelsTalkingAvatar;
  } = {},
): Promise<TalkingScenePipelineResult> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const narrationRunner = dependencies.narrationRunner ?? narrateForgeAudio;
  const presetLoader = dependencies.presetLoader ?? getVoicePreset;
  const talkingRunner = dependencies.talkingRunner ?? runSkyReelsTalkingAvatar;
  const requestId = createRequestId({
    audioPath: input.audioPath ?? null,
    desc_ko: input.desc_ko,
    duration_sec: input.duration_sec ?? 10,
    portraitPath: input.portraitPath,
    quality: input.quality,
    text: input.text ?? null,
    voice: input.voice ?? null,
    voicePresetName: input.voicePresetName ?? null,
  });
  const resolvedPreset = input.voicePresetName
    ? await presetLoader({
      name: input.voicePresetName,
      ...(input.voiceRootDir ? { presetDir: input.voiceRootDir } : { rootDir }),
    })
    : null;
  const generatedAudioPath = path.resolve(rootDir, "outputs", `${requestId}-dialogue.wav`);
  const resolvedAudioPath = input.audioPath?.trim()
    ? input.audioPath
    : generatedAudioPath;

  if (!input.audioPath && !input.text) {
    throw new Error("Talking scene pipeline requires either audioPath or text.");
  }

  if (!input.audioPath) {
    if (!input.simulate) {
      await narrationRunner({
        lang: input.lang ?? "ko",
        model: input.narrationModel ?? (input.quality === "production" ? "tts-1.5b" : "realtime-0.5b"),
        outputPath: resolvedAudioPath,
        text: input.text ?? "",
        ...(resolvedPreset?.voice
          ? { voice: resolvedPreset.voice }
          : input.voice
            ? { voice: input.voice }
            : {}),
      });
    }
  }

  const videoResult = await talkingRunner({
    audioPath: resolvedAudioPath,
    desc_ko: input.desc_ko,
    ...(typeof input.duration_sec === "number" ? { duration_sec: input.duration_sec } : {}),
    portraitPath: input.portraitPath,
    quality: input.quality,
    rootDir,
    ...(typeof input.simulate === "boolean" ? { simulate: input.simulate } : {}),
    ...(input.theme ? { theme: input.theme } : {}),
  });

  return {
    ...videoResult,
    audio_path: resolvedAudioPath,
    resolved_preset: resolvedPreset,
  };
}
