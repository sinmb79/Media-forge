import { TTSBackend } from "../../backends/tts.js";

export async function synthesizeForgeSpeech(
  input: {
    lang: string;
    outputPath: string;
    text: string;
    voice?: string;
  },
  dependencies: {
    tts?: {
      synthesize(
        text: string,
        lang: string,
        voice: string | undefined,
        output: string,
      ): Promise<string>;
    };
  } = {},
): Promise<{
  operation: "tts";
  output_path: string;
}> {
  const tts = dependencies.tts ?? new TTSBackend();
  const outputPath = await tts.synthesize(input.text, input.lang, input.voice, input.outputPath);

  return {
    operation: "tts",
    output_path: outputPath,
  };
}
