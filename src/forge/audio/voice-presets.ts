import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export interface VoicePreset {
  name: string;
  created_at: number;
  updated_at: number;
  emotion: string;
  speed: number;
  storage_path: string;
  ref_sample?: string;
  lora_path?: string;
  notes?: string;
  voice?: string;
}

export interface SaveVoicePresetInput {
  name: string;
  emotion?: string;
  speed?: number;
  rootDir?: string;
  presetDir?: string;
  ref_sample?: string;
  lora_path?: string;
  notes?: string;
  voice?: string;
}

export async function saveVoicePreset(input: SaveVoicePresetInput): Promise<VoicePreset> {
  const presetDir = resolveVoicePresetDirectory(input);
  const storageDir = path.resolve(presetDir, sanitizePresetName(input.name));
  const storagePath = path.resolve(storageDir, "config.json");
  const existing = await readPresetFile(storagePath);
  const timestamp = Date.now();

  const preset: VoicePreset = {
    created_at: existing?.created_at ?? timestamp,
    emotion: input.emotion?.trim() || existing?.emotion || "neutral",
    name: input.name,
    speed: input.speed ?? existing?.speed ?? 1,
    storage_path: storagePath,
    updated_at: timestamp,
    ...(input.ref_sample ? { ref_sample: input.ref_sample } : existing?.ref_sample ? { ref_sample: existing.ref_sample } : {}),
    ...(input.lora_path ? { lora_path: input.lora_path } : existing?.lora_path ? { lora_path: existing.lora_path } : {}),
    ...(input.notes ? { notes: input.notes } : existing?.notes ? { notes: existing.notes } : {}),
    ...(input.voice ? { voice: input.voice } : existing?.voice ? { voice: existing.voice } : {}),
  };

  await mkdir(storageDir, { recursive: true });
  await writeFile(storagePath, `${JSON.stringify(preset, null, 2)}\n`, "utf8");
  return preset;
}

export async function listVoicePresets(input: {
  rootDir?: string;
  presetDir?: string;
} = {}): Promise<VoicePreset[]> {
  const presetDir = resolveVoicePresetDirectory(input);

  try {
    const entries = await readdir(presetDir, { withFileTypes: true });
    const presets = await Promise.all(entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => readPresetFile(path.resolve(presetDir, entry.name, "config.json"))));

    return presets
      .filter((preset): preset is VoicePreset => preset !== null)
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    return [];
  }
}

export async function getVoicePreset(input: {
  name: string;
  rootDir?: string;
  presetDir?: string;
}): Promise<VoicePreset | null> {
  const presetDir = resolveVoicePresetDirectory(input);
  const directPath = path.resolve(presetDir, sanitizePresetName(input.name), "config.json");
  const directPreset = await readPresetFile(directPath);
  if (directPreset) {
    return directPreset;
  }

  const presets = await listVoicePresets(input);
  return presets.find((preset) => preset.name === input.name) ?? null;
}

export function resolveVoicePresetDirectory(input: {
  rootDir?: string;
  presetDir?: string;
} = {}): string {
  if (input.presetDir) {
    return path.resolve(input.presetDir);
  }

  const rootDir = input.rootDir ?? resolveMediaForgeRoot();
  return path.resolve(rootDir, "workspace", "series", "current", "voices");
}

async function readPresetFile(storagePath: string): Promise<VoicePreset | null> {
  try {
    const raw = await readFile(storagePath, "utf8");
    return JSON.parse(raw) as VoicePreset;
  } catch {
    return null;
  }
}

function sanitizePresetName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    || "voice-preset";
}
