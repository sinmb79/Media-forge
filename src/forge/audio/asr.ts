import * as path from "node:path";

import { VibeVoiceBackend, type VibeVoiceAsrEngine } from "../../backends/vibevoice.js";
import { WhisperBackend } from "../../backends/whisper.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export async function transcribeForgeAudio(
  input: {
    engine: VibeVoiceAsrEngine;
    inputPath: string;
    lang: string;
    outputPath?: string;
  },
  dependencies: {
    vibevoice?: {
      transcribe(inputPath: string, outputPath: string, options?: { lang?: string }): Promise<string>;
    };
    whisper?: {
      transcribe(inputPath: string, lang: string, outputPath?: string): Promise<string>;
    };
  } = {},
): Promise<{
  backend: VibeVoiceAsrEngine;
  operation: "asr";
  output_path: string;
}> {
  const outputPath = input.outputPath ?? resolveAsrOutputPath(input.inputPath);

  if (input.engine === "vibevoice-asr") {
    const vibevoice = dependencies.vibevoice ?? new VibeVoiceBackend();
    const transcribedPath = await vibevoice.transcribe(input.inputPath, outputPath, {
      lang: input.lang,
    });

    return {
      backend: "vibevoice-asr",
      operation: "asr",
      output_path: transcribedPath,
    };
  }

  const whisper = dependencies.whisper ?? new WhisperBackend();
  const transcribedPath = await whisper.transcribe(input.inputPath, input.lang, outputPath);

  return {
    backend: "whisper",
    operation: "asr",
    output_path: transcribedPath,
  };
}

function resolveAsrOutputPath(inputPath: string): string {
  const rootDir = resolveMediaForgeRoot();
  const stem = path.basename(inputPath, path.extname(inputPath)) || "audio";
  return path.resolve(rootDir, "outputs", `${stem}.srt`);
}
