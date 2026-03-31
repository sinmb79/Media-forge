import * as path from "node:path";

import { VibeVoiceBackend, type VibeVoiceNarrationModel } from "../../backends/vibevoice.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export async function narrateForgeAudio(
  input: {
    lang?: string;
    model: VibeVoiceNarrationModel;
    outputPath: string;
    text: string;
    voice?: string;
  },
  dependencies: {
    vibevoice?: {
      generateNarration(
        text: string,
        outputPath: string,
        options: {
          lang?: string;
          model: VibeVoiceNarrationModel;
          voice?: string;
        },
      ): Promise<string>;
    };
  } = {},
): Promise<{
  backend: "vibevoice";
  operation: "narrate";
  output_path: string;
}> {
  const vibevoice = dependencies.vibevoice ?? new VibeVoiceBackend();
  const generatedPath = await vibevoice.generateNarration(input.text, input.outputPath, {
    model: input.model,
    ...(input.lang ? { lang: input.lang } : {}),
    ...(input.voice ? { voice: input.voice } : {}),
  });

  return {
    backend: "vibevoice",
    operation: "narrate",
    output_path: generatedPath,
  };
}

export function resolveNarrationOutputPath(stem: string = "narration"): string {
  return path.resolve(resolveMediaForgeRoot(), "outputs", `${stem}-narrate.wav`);
}
