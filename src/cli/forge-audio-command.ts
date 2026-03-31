import * as path from "node:path";

import { addBackgroundMusicToVideo } from "../forge/audio/add-bgm.js";
import { addSubtitlesToVideo } from "../forge/audio/add-subs.js";
import { generateForgeAudioDrama } from "../forge/audio/drama.js";
import { narrateForgeAudio, resolveNarrationOutputPath } from "../forge/audio/narrate.js";
import { separateMediaAudio } from "../forge/audio/separate.js";
import { transcribeForgeAudio } from "../forge/audio/asr.js";
import { getVoicePreset, listVoicePresets, saveVoicePreset } from "../forge/audio/voice-presets.js";
import { synthesizeForgeSpeech } from "../forge/audio/tts.js";
import { transcribeForgeMedia } from "../forge/audio/transcribe.js";
import { changeVoicePitch } from "../forge/audio/voice-change.js";
import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";

export async function forgeAudioCommand(
  positionals: string[],
  options: {
    json: boolean;
    optionValues: Record<string, string[]>;
    simulate: boolean;
  },
): Promise<{ exitCode: number; output: string }> {
  const [subcommand, input] = positionals;

  if (options.simulate) {
    if (subcommand === "drama" || subcommand === "narrate" || subcommand === "asr") {
      const engine = subcommand === "asr"
        ? (options.optionValues.engine?.[0] === "vibevoice-asr" ? "vibevoice-asr" : "whisper")
        : "vibevoice";
      return {
        exitCode: 0,
        output: `${JSON.stringify({
          engine,
          operation: subcommand,
          output_path: resolveAudioOutputPath(input ?? "audio.out", subcommand ?? "audio"),
          status: "simulated",
        }, null, 2)}\n`,
      };
    }

    return {
      exitCode: 0,
      output: `${JSON.stringify({
        operation: subcommand,
        output_path: resolveAudioOutputPath(input ?? "audio.out", subcommand ?? "audio"),
        status: "simulated",
      }, null, 2)}\n`,
    };
  }

  switch (subcommand) {
    case "preset-save": {
      if (!input) {
        break;
      }

      const preset = await saveVoicePreset({
        name: input,
        ...(options.optionValues.emotion?.[0] ? { emotion: options.optionValues.emotion[0] } : {}),
        ...(options.optionValues.lora?.[0] ? { lora_path: options.optionValues.lora[0] } : {}),
        ...(options.optionValues.notes?.[0] ? { notes: options.optionValues.notes[0] } : {}),
        ...(options.optionValues.ref?.[0] ? { ref_sample: options.optionValues.ref[0] } : {}),
        ...(options.optionValues.speed?.[0] ? { speed: Number(options.optionValues.speed[0]) } : {}),
        ...(options.optionValues.voice?.[0] ? { voice: options.optionValues.voice[0] } : {}),
      });

      return {
        exitCode: 0,
        output: options.json
          ? `${JSON.stringify(preset, null, 2)}\n`
          : `voice preset saved: ${preset.name}\n`,
      };
    }
    case "preset-list": {
      const presets = await listVoicePresets();
      return {
        exitCode: 0,
        output: options.json
          ? `${JSON.stringify({ presets }, null, 2)}\n`
          : `${presets.map((preset) => preset.name).join("\n")}\n`,
      };
    }
    case "preset-show": {
      if (!input) {
        break;
      }

      const preset = await getVoicePreset({ name: input });
      if (!preset) {
        return {
          exitCode: 1,
          output: `Voice preset not found: ${input}\n`,
        };
      }

      return {
        exitCode: 0,
        output: options.json
          ? `${JSON.stringify(preset, null, 2)}\n`
          : `voice preset: ${preset.name}\n`,
      };
    }
    case "tts": {
      const text = options.optionValues.text?.[0];
      if (!text) break;
      const lang = options.optionValues.lang?.[0] ?? "ko";
      const outputPath = options.optionValues.output?.[0] ?? path.resolve(resolveMediaForgeRoot(), "outputs", "speech.mp3");
      return successResponse(
        options.json,
        "tts",
        (await synthesizeForgeSpeech({
          lang,
          outputPath,
          text,
          ...(options.optionValues.voice?.[0] ? { voice: options.optionValues.voice[0] } : {}),
        })).output_path,
      );
    }
    case "drama": {
      const scriptPath = options.optionValues.script?.[0];
      const speakerNames = options.optionValues.speakers?.[0]
        ?.split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        ?? [];
      if (!scriptPath || speakerNames.length === 0) break;
      return successResponse(
        options.json,
        "drama",
        (await generateForgeAudioDrama({
          model: options.optionValues.model?.[0] === "realtime-0.5b" ? "realtime-0.5b" : "tts-1.5b",
          scriptPath,
          speakerNames,
          ...(options.optionValues.output?.[0] ? { outputPath: options.optionValues.output[0] } : {}),
        })).output_path,
        "vibevoice",
      );
    }
    case "narrate": {
      const text = options.optionValues.text?.[0];
      if (!text) break;
      const model = options.optionValues.model?.[0] === "tts-1.5b" ? "tts-1.5b" : "realtime-0.5b";
      return successResponse(
        options.json,
        "narrate",
        (await narrateForgeAudio({
          lang: options.optionValues.lang?.[0] ?? "ko",
          model,
          outputPath: options.optionValues.output?.[0] ?? resolveNarrationOutputPath("narration"),
          text,
          ...(options.optionValues.voice?.[0] ? { voice: options.optionValues.voice[0] } : {}),
        })).output_path,
        "vibevoice",
      );
    }
    case "asr":
      if (!input) break;
      return successResponse(
        options.json,
        "asr",
        (await transcribeForgeAudio({
          engine: options.optionValues.engine?.[0] === "vibevoice-asr" ? "vibevoice-asr" : "whisper",
          inputPath: input,
          lang: options.optionValues.lang?.[0] ?? "ko",
          ...(options.optionValues.output?.[0] ? { outputPath: options.optionValues.output[0] } : {}),
        })).output_path,
        options.optionValues.engine?.[0] === "vibevoice-asr" ? "vibevoice-asr" : "whisper",
      );
    case "transcribe":
      if (!input) break;
      return successResponse(
        options.json,
        "transcribe",
        (await transcribeForgeMedia({
          inputPath: input,
          lang: options.optionValues.lang?.[0] ?? "ko",
        })).output_path,
      );
    case "add-subs":
      if (!input) break;
      return successResponse(
        options.json,
        "add-subs",
        (await addSubtitlesToVideo({
          outputPath: resolveAudioOutputPath(input, "subs"),
          subtitlesPath: options.optionValues.subs?.[0] ?? "",
          videoPath: input,
        })).output_path,
      );
    case "add-bgm":
      if (!input) break;
      return successResponse(
        options.json,
        "add-bgm",
        (await addBackgroundMusicToVideo({
          musicPath: options.optionValues.music?.[0] ?? "",
          outputPath: resolveAudioOutputPath(input, "bgm"),
          videoPath: input,
          volume: Number(options.optionValues.volume?.[0] ?? "0.3"),
        })).output_path,
      );
    case "separate":
      if (!input) break;
      return successResponse(
        options.json,
        "separate",
        (await separateMediaAudio({
          inputPath: input,
          outputPath: resolveAudioOutputPath(input, "separate"),
        })).output_path,
      );
    case "voice-change":
      if (!input) break;
      return successResponse(
        options.json,
        "voice-change",
        (await changeVoicePitch({
          inputPath: input,
          pitch: Number(options.optionValues.pitch?.[0] ?? "1"),
          simulate: options.simulate,
        })).output_path,
      );
    default:
      break;
  }

  return {
    exitCode: 1,
    output: "Usage: engine forge audio <preset-save|preset-list|preset-show|tts|drama|narrate|asr|transcribe|add-subs|add-bgm|separate|voice-change> ...\n",
  };
}

function resolveAudioOutputPath(input: string, operation: string): string {
  const extension = operation === "transcribe" ? ".srt" : operation === "tts" ? ".mp3" : path.extname(input) || ".mp3";
  return path.resolve(resolveMediaForgeRoot(), "outputs", `${path.basename(input, path.extname(input)) || operation}-${operation}${extension}`);
}

function successResponse(json: boolean, operation: string, outputPath: string, engine?: string) {
  return {
    exitCode: 0,
    output: json
      ? `${JSON.stringify({ ...(engine ? { engine } : {}), operation, output_path: outputPath, status: "completed" }, null, 2)}\n`
      : `${operation} completed: ${outputPath}\n`,
  };
}
