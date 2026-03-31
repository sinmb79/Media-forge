import * as path from "node:path";

import { type VibeVoiceNarrationModel } from "../../backends/vibevoice.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { generateForgeAudioDrama } from "../audio/drama.js";
import { prepareDialogueScript } from "../audio/tag-speakers.js";
import { transcribeForgeAudio } from "../audio/asr.js";
import {
  type VoicePreset,
  listVoicePresets,
  resolveVoicePresetDirectory,
} from "../audio/voice-presets.js";
import { runPipelineChain } from "./chain.js";

export async function runEpisodeAudioPipeline(
  input: {
    include_subtitles?: boolean;
    lang?: string;
    model?: VibeVoiceNarrationModel;
    outputPath?: string;
    rootDir?: string;
    scriptPath?: string;
    speakerNames: string[];
    text?: string;
    voiceRootDir?: string;
  },
  dependencies: {
    asrRunner?: (input: {
      engine: "whisper";
      inputPath: string;
      lang: string;
      outputPath?: string;
    }) => Promise<{ output_path: string }>;
    dramaRunner?: (input: {
      model?: VibeVoiceNarrationModel;
      outputPath?: string;
      scriptPath: string;
      speakerNames: string[];
      voicePresets?: VoicePreset[];
    }) => Promise<{ output_path: string }>;
    presetLoader?: (input: { presetDir?: string; rootDir?: string }) => Promise<VoicePreset[]>;
    scriptPreparer?: (input: {
      outputPath?: string;
      rootDir?: string;
      scriptPath?: string;
      speakerNames: string[];
      stem?: string;
      text?: string;
    }) => Promise<{
      line_count: number;
      script_path: string;
      speaker_names: string[];
    }>;
  } = {},
): Promise<{
  output_path: string;
  request_id: string;
  resolved_presets: VoicePreset[];
  script_path: string;
  speaker_count: number;
  status: "completed";
  step_count: number;
  subtitles_path?: string;
}> {
  const rootDir = input.rootDir ?? resolveMediaForgeRoot();
  const presetDir = resolveVoicePresetDirectory({
    rootDir,
    ...(input.voiceRootDir ? { presetDir: input.voiceRootDir } : {}),
  });
  const presetLoader = dependencies.presetLoader ?? listVoicePresets;
  const allPresets = await presetLoader({
    rootDir,
    ...(presetDir ? { presetDir } : {}),
  });
  const resolvedPresets = allPresets.filter((preset) => input.speakerNames.includes(preset.name));
  const requestId = createRequestId({
    input: {
      include_subtitles: input.include_subtitles ?? false,
      model: input.model ?? "tts-1.5b",
      speakerNames: input.speakerNames,
      text: input.text ?? "",
    },
    type: "episode-audio",
  });
  const audioOutputPath = input.outputPath ?? path.resolve(rootDir, "outputs", "episode-audio.wav");
  const subtitlesOutputPath = path.resolve(rootDir, "outputs", "episode-audio.srt");
  const scriptPreparer = dependencies.scriptPreparer ?? prepareDialogueScript;
  const dramaRunner = dependencies.dramaRunner ?? generateForgeAudioDrama;
  const asrRunner = dependencies.asrRunner ?? transcribeForgeAudio;

  const pipelineResult = await runPipelineChain({
    error_strategy: "skip_optional_continue",
    id: "episode-audio",
    steps: [
      {
        backend: "python",
        name: "resolve_presets",
        run: async () => ({
          preset_count: String(resolvedPresets.length),
        }),
      },
      {
        backend: "python",
        name: "prepare_script",
        run: async () => {
          const prepared = await scriptPreparer({
            outputPath: path.resolve(rootDir, "outputs", "episode-audio-script.txt"),
            rootDir,
            speakerNames: input.speakerNames,
            stem: "episode-audio",
            ...(input.scriptPath ? { scriptPath: input.scriptPath } : {}),
            ...(input.text ? { text: input.text } : {}),
          });

          return {
            script: prepared.script_path,
          };
        },
      },
      {
        backend: "python",
        input: { script: "$steps.prepare_script.script" },
        name: "generate_drama",
        run: async (context) => {
          const scriptPath = context.inputs.script;
          if (!scriptPath) {
            throw new Error("Missing prepared dialogue script.");
          }

          const result = await dramaRunner({
            model: input.model ?? "tts-1.5b",
            outputPath: audioOutputPath,
            scriptPath,
            speakerNames: input.speakerNames,
            ...(resolvedPresets.length > 0 ? { voicePresets: resolvedPresets } : {}),
          });

          return {
            audio: result.output_path,
          };
        },
      },
      ...(input.include_subtitles
        ? [{
            backend: "python",
            input: { audio: "$steps.generate_drama.audio" },
            name: "transcribe_audio",
            optional: true,
            run: async (context: { inputs: Record<string, string> }) => {
              const audioPath = context.inputs.audio;
              if (!audioPath) {
                throw new Error("Missing generated drama audio.");
              }

              const result = await asrRunner({
                engine: "whisper",
                inputPath: audioPath,
                lang: input.lang ?? "ko",
                outputPath: subtitlesOutputPath,
              });

              return {
                subtitles: result.output_path,
              };
            },
          }]
        : []),
    ],
  });

  if (pipelineResult.status === "failed") {
    const failedStep = pipelineResult.steps.find((step) => step.status === "failed");
    throw new Error(failedStep?.error ?? "Episode audio pipeline failed.");
  }

  return {
    output_path: pipelineResult.outputs.audio ?? audioOutputPath,
    request_id: requestId,
    resolved_presets: resolvedPresets,
    script_path: pipelineResult.outputs.script ?? path.resolve(rootDir, "outputs", "episode-audio-script.txt"),
    speaker_count: input.speakerNames.length,
    status: "completed",
    step_count: pipelineResult.steps.length,
    ...(pipelineResult.outputs.subtitles ? { subtitles_path: pipelineResult.outputs.subtitles } : {}),
  };
}
