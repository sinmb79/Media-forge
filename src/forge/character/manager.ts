import {
  addForgeAsset,
  getForgeAsset,
  listForgeAssets,
  removeForgeAsset,
} from "../assets/library.js";

export interface Character {
  id: string;
  name: string;
  type: "realistic" | "anime" | "2d" | "custom";
  reference_images: string[];
  lora_path?: string;
  voice_preset?: string;
  description: string;
}

export interface CreateCharacterInput {
  name: string;
  type: Character["type"];
  reference_images: string[];
  description: string;
  lora_path?: string;
  voice_preset?: string;
  rootDir?: string;
  dbPath?: string;
}

export async function createCharacter(input: CreateCharacterInput): Promise<Character> {
  const character: Omit<Character, "id"> = {
    description: input.description,
    name: input.name,
    reference_images: input.reference_images,
    type: input.type,
    ...(input.lora_path ? { lora_path: input.lora_path } : {}),
    ...(input.voice_preset ? { voice_preset: input.voice_preset } : {}),
  };

  const asset = await addForgeAsset({
    category: "characters",
    data: character as unknown as Record<string, unknown>,
    is_official: false,
    name: input.name,
    type: "character_profile",
    ...(input.dbPath ? { dbPath: input.dbPath } : {}),
    ...(input.rootDir ? { rootDir: input.rootDir } : {}),
  });

  return {
    ...character,
    id: asset.id,
  };
}

export async function listCharacters(input: {
  dbPath?: string;
  rootDir?: string;
} = {}): Promise<Character[]> {
  const assets = await listForgeAssets({
    category: "characters",
    type: "character_profile",
    ...(input.dbPath ? { dbPath: input.dbPath } : {}),
    ...(input.rootDir ? { rootDir: input.rootDir } : {}),
  });

  return assets.map(mapAssetToCharacter);
}

export async function getCharacter(input: {
  idOrName: string;
  dbPath?: string;
  rootDir?: string;
}): Promise<Character | null> {
  const byId = await getForgeAsset({
    id: input.idOrName,
    ...(input.dbPath ? { dbPath: input.dbPath } : {}),
    ...(input.rootDir ? { rootDir: input.rootDir } : {}),
  });

  if (byId && byId.category === "characters" && byId.type === "character_profile") {
    return mapAssetToCharacter(byId);
  }

  const allCharacters = await listCharacters({
    ...(input.dbPath ? { dbPath: input.dbPath } : {}),
    ...(input.rootDir ? { rootDir: input.rootDir } : {}),
  });
  return allCharacters.find((character) => character.name === input.idOrName) ?? null;
}

export async function removeCharacter(input: {
  id: string;
  dbPath?: string;
  rootDir?: string;
}): Promise<{ id: string; removed: boolean }> {
  return removeForgeAsset({
    id: input.id,
    ...(input.dbPath ? { dbPath: input.dbPath } : {}),
    ...(input.rootDir ? { rootDir: input.rootDir } : {}),
  });
}

function mapAssetToCharacter(asset: {
  id: string;
  name: string;
  data: Record<string, unknown>;
}): Character {
  const referenceImages = Array.isArray(asset.data.reference_images)
    ? asset.data.reference_images.filter((value): value is string => typeof value === "string")
    : [];

  return {
    description: typeof asset.data.description === "string" ? asset.data.description : "",
    id: asset.id,
    name: typeof asset.data.name === "string" ? asset.data.name : asset.name,
    reference_images: referenceImages,
    type: mapCharacterType(asset.data.type),
    ...(typeof asset.data.lora_path === "string" ? { lora_path: asset.data.lora_path } : {}),
    ...(typeof asset.data.voice_preset === "string" ? { voice_preset: asset.data.voice_preset } : {}),
  };
}

function mapCharacterType(value: unknown): Character["type"] {
  if (value === "anime" || value === "2d" || value === "custom") {
    return value;
  }

  return "realistic";
}
