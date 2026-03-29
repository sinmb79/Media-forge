import { WhisperBackend } from "../../backends/whisper.js";

export async function transcribeForgeMedia(
  input: {
    inputPath: string;
    lang: string;
    outputPath?: string;
  },
  dependencies: {
    whisper?: {
      transcribe(inputPath: string, lang: string, outputPath?: string): Promise<string>;
    };
  } = {},
): Promise<{
  operation: "transcribe";
  output_path: string;
}> {
  const whisper = dependencies.whisper ?? new WhisperBackend();
  const outputPath = await whisper.transcribe(input.inputPath, input.lang, input.outputPath);

  return {
    operation: "transcribe",
    output_path: outputPath,
  };
}
