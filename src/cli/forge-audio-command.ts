import * as path from "node:path";

import { addBackgroundMusicToVideo } from "../forge/audio/add-bgm.js";
import { addSubtitlesToVideo } from "../forge/audio/add-subs.js";
import { separateMediaAudio } from "../forge/audio/separate.js";
import { synthesizeForgeSpeech } from "../forge/audio/tts.js";
import { transcribeForgeMedia } from "../forge/audio/transcribe.js";

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
    case "tts": {
      const text = options.optionValues.text?.[0];
      if (!text) break;
      const lang = options.optionValues.lang?.[0] ?? "ko";
      const outputPath = options.optionValues.output?.[0] ?? path.resolve(process.cwd(), "outputs", "speech.mp3");
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
    default:
      break;
  }

  return {
    exitCode: 1,
    output: "Usage: engine forge audio <tts|transcribe|add-subs|add-bgm|separate> ...\n",
  };
}

function resolveAudioOutputPath(input: string, operation: string): string {
  const extension = operation === "transcribe" ? ".srt" : operation === "tts" ? ".mp3" : path.extname(input) || ".mp3";
  return path.resolve(process.cwd(), "outputs", `${path.basename(input, path.extname(input)) || operation}-${operation}${extension}`);
}

function successResponse(json: boolean, operation: string, outputPath: string) {
  return {
    exitCode: 0,
    output: json
      ? `${JSON.stringify({ operation, output_path: outputPath, status: "completed" }, null, 2)}\n`
      : `${operation} completed: ${outputPath}\n`,
  };
}
