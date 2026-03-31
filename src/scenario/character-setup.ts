import * as path from "node:path";

import { resolveLLMClient } from "../backends/resolve-llm-client.js";
import { createCharacter, getCharacter } from "../forge/character/manager.js";
import { runImageGenerate } from "../forge/image/generate.js";
import type { ForgePromptClient } from "../prompt/forge-prompt-builder.js";
import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";
import type { ResolvedCharacter, ScenarioCharacter } from "./types.js";

export interface CharacterSetupOptions {
  rootDir?: string;
  outputDir?: string;
  style?: string;
  simulate?: boolean;
  dbPath?: string;
}

export interface CharacterSetupDependencies {
  llmClient?: ForgePromptClient;
  generateImage?: typeof runImageGenerate;
  createCharacterFn?: typeof createCharacter;
  getCharacterFn?: typeof getCharacter;
}

export async function resolveScenarioCharacters(
  characters: ScenarioCharacter[],
  options: CharacterSetupOptions = {},
  dependencies: CharacterSetupDependencies = {},
): Promise<ResolvedCharacter[]> {
  const results: ResolvedCharacter[] = [];

  for (const scenarioChar of characters) {
    const resolved = await resolveOneCharacter(scenarioChar, options, dependencies);
    results.push(resolved);
  }

  return results;
}

async function resolveOneCharacter(
  scenarioChar: ScenarioCharacter,
  options: CharacterSetupOptions,
  dependencies: CharacterSetupDependencies,
): Promise<ResolvedCharacter> {
  const rootDir = resolveMediaForgeRoot(options.rootDir ?? process.cwd());
  const getCharacterFn = dependencies.getCharacterFn ?? getCharacter;

  if (scenarioChar.character_id) {
    const existing = await getCharacterFn({
      idOrName: scenarioChar.character_id,
      rootDir,
      ...(options.dbPath ? { dbPath: options.dbPath } : {}),
    });

    if (existing) {
      return {
        character_id: existing.id,
        name: existing.name,
        newly_created: false,
        reference_images: existing.reference_images,
      };
    }
  }

  const byName = await getCharacterFn({
    idOrName: scenarioChar.name,
    rootDir,
    ...(options.dbPath ? { dbPath: options.dbPath } : {}),
  });

  if (byName) {
    return {
      character_id: byName.id,
      name: byName.name,
      newly_created: false,
      reference_images: byName.reference_images,
    };
  }

  return createNewCharacter(scenarioChar, options, dependencies);
}

async function createNewCharacter(
  scenarioChar: ScenarioCharacter,
  options: CharacterSetupOptions,
  dependencies: CharacterSetupDependencies,
): Promise<ResolvedCharacter> {
  const rootDir = resolveMediaForgeRoot(options.rootDir ?? process.cwd());
  const referenceImages: string[] = [];

  if (scenarioChar.reference_image) {
    referenceImages.push(scenarioChar.reference_image);
  } else if (!options.simulate) {
    const refImagePath = await generateCharacterReferenceImage(
      scenarioChar,
      options,
      dependencies,
    );
    if (refImagePath) {
      referenceImages.push(refImagePath);
    }
  }

  const createCharacterFn = dependencies.createCharacterFn ?? createCharacter;
  const style = options.style ?? "realistic";
  const characterType = style === "anime" || style === "ghibli" ? "anime"
    : style === "2d" ? "2d"
    : "realistic";

  const character = await createCharacterFn({
    name: scenarioChar.name,
    description: scenarioChar.description,
    reference_images: referenceImages,
    type: characterType,
    rootDir,
    ...(scenarioChar.voice_preset ? { voice_preset: scenarioChar.voice_preset } : {}),
    ...(options.dbPath ? { dbPath: options.dbPath } : {}),
  });

  return {
    character_id: character.id,
    name: character.name,
    newly_created: true,
    reference_images: character.reference_images,
  };
}

async function generateCharacterReferenceImage(
  scenarioChar: ScenarioCharacter,
  options: CharacterSetupOptions,
  dependencies: CharacterSetupDependencies,
): Promise<string | null> {
  const rootDir = resolveMediaForgeRoot(options.rootDir ?? process.cwd());
  const llmClient = dependencies.llmClient ?? await resolveLLMClient({ rootDir });
  const style = options.style ?? "realistic";

  const characterPrompt = await llmClient.generate(
    `Create a detailed character portrait prompt for SDXL image generation.
Character: ${scenarioChar.name}
Description: ${scenarioChar.description}
Style: ${style}
Output a single English prompt suitable for SDXL, focusing on the character's face and upper body. No JSON, just the prompt text.`,
  );

  const prompt = characterPrompt.trim() || `${style} character portrait, ${scenarioChar.description}, detailed face, upper body, high quality`;

  try {
    const generateImage = dependencies.generateImage ?? runImageGenerate;
    const result = await generateImage({
      prompt,
      model: "sdxl",
      resolution: "2k",
      aspect_ratio: "3:4",
      batch_count: 1,
      outputDir: path.join(options.outputDir ?? "outputs", "characters"),
      rootDir,
      theme: style,
    });

    return result.output_paths[0] ?? null;
  } catch {
    return null;
  }
}
