import { mkdir } from "node:fs/promises";
import * as path from "node:path";

import { FFmpegBackend } from "../../backends/ffmpeg.js";
import { TTSBackend } from "../../backends/tts.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { getCharacter } from "./manager.js";

export interface DubbingOptions {
  character_id: string;
  text: string;
  audio_path?: string;
  language: "ko" | "en" | "ja";
  emotion?: string;
  rootDir?: string;
  dbPath?: string;
  outputDir?: string;
  simulate?: boolean;
}

export interface CharacterDubbingResult {
  character_id: string;
  audio_path: string;
  output_path: string;
  reference_image: string;
  request_id: string;
  status: "simulated" | "completed";
}

export async function runCharacterDubbing(
  input: DubbingOptions,
  dependencies: {
    ffmpegBackend?: FFmpegBackend;
    renderDubbedVideo?: (input: {
      audioPath: string;
      outputPath: string;
      referenceImage: string;
    }) => Promise<string>;
    ttsBackend?: TTSBackend;
  } = {},
): Promise<CharacterDubbingResult> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const outputDir = path.resolve(rootDir, input.outputDir ?? "outputs", "character");
  const character = await getCharacter({
    idOrName: input.character_id,
    ...(input.dbPath ? { dbPath: input.dbPath } : {}),
    rootDir,
  });

  if (!character) {
    throw new Error(`Character not found: ${input.character_id}`);
  }

  const referenceImage = character.reference_images[0];
  if (!referenceImage) {
    throw new Error(`Character ${character.name} does not have a reference image.`);
  }

  await mkdir(outputDir, { recursive: true });

  const requestId = createRequestId({
    character_id: character.id,
    language: input.language,
    text: input.text,
  });
  const audioPath = path.resolve(outputDir, input.audio_path ?? `${requestId}-speech.mp3`);
  const outputPath = path.resolve(outputDir, `${requestId}-dub.mp4`);

  if (input.simulate) {
    return {
      audio_path: audioPath,
      character_id: character.id,
      output_path: outputPath,
      reference_image: referenceImage,
      request_id: requestId,
      status: "simulated",
    };
  }

  const resolvedAudioPath = input.audio_path
    ? path.resolve(rootDir, input.audio_path)
    : await (dependencies.ttsBackend ?? new TTSBackend()).synthesize(
      input.text,
      input.language,
      character.voice_preset,
      audioPath,
    );

  if (dependencies.renderDubbedVideo) {
    await dependencies.renderDubbedVideo({
      audioPath: resolvedAudioPath,
      outputPath,
      referenceImage,
    });
  } else {
    await (dependencies.ffmpegBackend ?? new FFmpegBackend()).execute({
      args: [
        "-y",
        "-loop",
        "1",
        "-i",
        referenceImage,
        "-i",
        resolvedAudioPath,
        "-c:v",
        "libx264",
        "-tune",
        "stillimage",
        "-pix_fmt",
        "yuv420p",
        "-shortest",
        outputPath,
      ],
    });
  }

  return {
    audio_path: resolvedAudioPath,
    character_id: character.id,
    output_path: outputPath,
    reference_image: referenceImage,
    request_id: requestId,
    status: "completed",
  };
}
