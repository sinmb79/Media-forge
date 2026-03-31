import {
  createCharacter,
  listCharacters,
  removeCharacter,
} from "../forge/character/manager.js";
import { runCharacterDubbing } from "../forge/character/dubbing.js";

export async function forgeCharacterCommand(
  positionals: string[],
  options: {
    json: boolean;
    optionValues: Record<string, string[]>;
    simulate: boolean;
  },
): Promise<{ exitCode: number; output: string }> {
  const [subcommand, maybeId] = positionals;

  switch (subcommand) {
    case "create": {
      const name = options.optionValues.name?.[0];
      const type = options.optionValues.type?.[0];
      const referenceImage = options.optionValues.ref?.[0];
      const description = options.optionValues.description?.[0] ?? "";

      if (!name || !type || !referenceImage) {
        break;
      }

      const character = await createCharacter({
        description,
        name,
        reference_images: [referenceImage],
        type: normalizeCharacterType(type),
        ...(options.optionValues.lora?.[0] ? { lora_path: options.optionValues.lora[0] } : {}),
        ...(options.optionValues.voice?.[0] ? { voice_preset: options.optionValues.voice[0] } : {}),
      });

      return {
        exitCode: 0,
        output: options.json
          ? `${JSON.stringify(character, null, 2)}\n`
          : `Created character: ${character.id}\n`,
      };
    }
    case "list": {
      const characters = await listCharacters();
      return {
        exitCode: 0,
        output: options.json
          ? `${JSON.stringify({ characters, count: characters.length }, null, 2)}\n`
          : `${characters.map((character) => `${character.id}  ${character.type}  ${character.name}`).join("\n")}\n`,
      };
    }
    case "remove":
      if (!maybeId) {
        break;
      }

      return {
        exitCode: 0,
        output: options.json
          ? `${JSON.stringify(await removeCharacter({ id: maybeId }), null, 2)}\n`
          : `Removed character: ${maybeId}\n`,
      };
    case "dub": {
      const characterId = options.optionValues.character?.[0] ?? maybeId;
      const text = options.optionValues.text?.[0];
      const language = options.optionValues.lang?.[0];

      if (!characterId || !text || !language) {
        break;
      }

      const result = await runCharacterDubbing({
        character_id: characterId,
        language: normalizeLanguage(language),
        simulate: options.simulate,
        text,
        ...(options.optionValues.audio?.[0] ? { audio_path: options.optionValues.audio[0] } : {}),
        ...(options.optionValues.emotion?.[0] ? { emotion: options.optionValues.emotion[0] } : {}),
      });

      return {
        exitCode: 0,
        output: options.json
          ? `${JSON.stringify(result, null, 2)}\n`
          : `Character dubbing ${result.status}: ${result.output_path}\n`,
      };
    }
    default:
      break;
  }

  return {
    exitCode: 1,
    output: "Usage: engine forge character <create|list|remove|dub> ...\n",
  };
}

function normalizeCharacterType(value: string): "realistic" | "anime" | "2d" | "custom" {
  if (value === "anime" || value === "2d" || value === "custom") {
    return value;
  }

  return "realistic";
}

function normalizeLanguage(value: string): "ko" | "en" | "ja" {
  if (value === "en" || value === "ja") {
    return value;
  }

  return "ko";
}
