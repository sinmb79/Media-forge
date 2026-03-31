import * as os from "node:os";
import * as path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { VibeVoiceBackend, type VibeVoiceNarrationModel } from "../../backends/vibevoice.js";
import type { VoicePreset } from "./voice-presets.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export async function generateForgeAudioDrama(
  input: {
    model?: VibeVoiceNarrationModel;
    outputPath?: string;
    scriptPath?: string;
    scriptText?: string;
    speakerNames: string[];
    voicePresets?: VoicePreset[];
  },
  dependencies: {
    vibevoice?: {
      generateDrama(
        scriptPath: string,
        speakerNames: string[],
        outputPath: string,
        options?: {
          model?: VibeVoiceNarrationModel;
          voicePresets?: VoicePreset[];
        },
      ): Promise<string>;
    };
  } = {},
): Promise<{
  backend: "vibevoice";
  operation: "drama";
  output_path: string;
}> {
  const vibevoice = dependencies.vibevoice ?? new VibeVoiceBackend();
  const resolvedScriptPath = input.scriptPath ?? await materializeDramaScript(input.scriptText ?? "");
  const outputPath = input.outputPath ?? buildDramaOutputPath(resolvedScriptPath);
  const generatedPath = await vibevoice.generateDrama(
    resolvedScriptPath,
    input.speakerNames,
    outputPath,
    {
      ...(input.model ? { model: input.model } : {}),
      ...(input.voicePresets ? { voicePresets: input.voicePresets } : {}),
    },
  );

  return {
    backend: "vibevoice",
    operation: "drama",
    output_path: generatedPath,
  };
}

async function materializeDramaScript(scriptText: string): Promise<string> {
  const targetDir = path.resolve(resolveMediaForgeRoot(), "outputs", "temp");
  await mkdir(targetDir, { recursive: true });
  const filePath = path.join(targetDir, `vibevoice-drama-${Date.now()}.txt`);
  await writeFile(filePath, scriptText.length > 0 ? scriptText : "Speaker 1: ...\n", "utf8");
  return filePath;
}

function buildDramaOutputPath(scriptPath: string): string {
  const rootDir = resolveMediaForgeRoot();
  const stem = path.basename(scriptPath, path.extname(scriptPath)) || `drama-${os.tmpdir.length}`;
  return path.resolve(rootDir, "outputs", `${stem}-drama.wav`);
}
