import {
  listVoicePresets,
  saveVoicePreset,
} from "../../../dist/src/forge/audio/voice-presets.js";
import { getMediaForgeRuntime } from "./mediaforge-runtime";
import type { DashboardVoicePresetRecord } from "./mediaforge-types";

export interface SaveDashboardVoicePresetInput {
  emotion?: string;
  loraPath?: string;
  name: string;
  notes?: string;
  refSample?: string;
  speed?: number;
  voice?: string;
}

interface VoicePresetRecord {
  created_at: number;
  emotion: string;
  lora_path?: string;
  name: string;
  notes?: string;
  ref_sample?: string;
  speed: number;
  storage_path: string;
  updated_at: number;
  voice?: string;
}

export async function listDashboardVoicePresets(): Promise<DashboardVoicePresetRecord[]> {
  const runtime = getMediaForgeRuntime();
  const presets = await listVoicePresets({ rootDir: runtime.rootDir });
  return presets
    .map(buildDashboardVoicePresetRecord)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function saveDashboardVoicePreset(
  input: SaveDashboardVoicePresetInput,
): Promise<DashboardVoicePresetRecord> {
  const runtime = getMediaForgeRuntime();
  const preset = await saveVoicePreset({
    ...(input.emotion ? { emotion: input.emotion } : {}),
    ...(input.loraPath ? { lora_path: input.loraPath } : {}),
    name: input.name,
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.refSample ? { ref_sample: input.refSample } : {}),
    rootDir: runtime.rootDir,
    ...(typeof input.speed === "number" ? { speed: input.speed } : {}),
    ...(input.voice ? { voice: input.voice } : {}),
  });

  return buildDashboardVoicePresetRecord(preset);
}

export function buildDashboardVoicePresetRecord(
  preset: VoicePresetRecord,
): DashboardVoicePresetRecord {
  return {
    created_at: preset.created_at,
    emotion: preset.emotion,
    has_lora: Boolean(preset.lora_path),
    has_ref_sample: Boolean(preset.ref_sample),
    id: preset.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "voice-preset",
    name: preset.name,
    ...(preset.notes ? { notes: preset.notes } : {}),
    ...(preset.ref_sample ? { ref_sample: preset.ref_sample } : {}),
    speed: preset.speed,
    storage_path: preset.storage_path,
    summary: buildVoicePresetSummary(preset),
    updated_at: preset.updated_at,
    ...(preset.voice ? { voice: preset.voice } : {}),
  };
}

export function buildVoicePresetSummary(preset: Pick<
  VoicePresetRecord,
  "emotion" | "lora_path" | "ref_sample" | "speed" | "voice"
>): string {
  const parts = [
    `감정: ${preset.emotion}`,
    `속도: ${preset.speed.toFixed(2)}x`,
    preset.voice ? `음성: ${preset.voice}` : null,
    preset.ref_sample ? "레퍼런스 샘플 준비됨" : "레퍼런스 샘플 없음",
    preset.lora_path ? "LoRA 연결됨" : null,
  ].filter((value): value is string => Boolean(value));

  return parts.join(" / ");
}
