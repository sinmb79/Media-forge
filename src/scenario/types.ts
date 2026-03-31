import { readFile } from "node:fs/promises";

export interface ScenarioFile {
  schema_version: "0.1";
  title: string;
  synopsis: string;
  characters: ScenarioCharacter[];
  scenes: ScenarioScene[];
  output_formats: ScenarioOutputFormat[];
  style?: string;
  language?: "ko" | "en";
}

export type ScenarioOutputFormat = "webtoon" | "shortform" | "longform";

export interface ScenarioCharacter {
  name: string;
  description: string;
  character_id?: string;
  reference_image?: string;
  voice_preset?: string;
}

export interface ScenarioScene {
  scene_number: number;
  description: string;
  dialogue?: ScenarioDialogue[];
  duration_hint_sec?: number;
  camera?: string;
  emotion?: string;
  characters_in_scene?: string[];
}

export interface ScenarioDialogue {
  speaker: string;
  text: string;
  emotion?: string;
}

export interface ScenarioIngestResult {
  scenario: ScenarioFile;
  resolved_characters: ResolvedCharacter[];
  planned_outputs: ScenarioOutputPlan[];
  storyboard_path: string | null;
}

export interface ResolvedCharacter {
  name: string;
  character_id: string;
  reference_images: string[];
  newly_created: boolean;
}

export interface ScenarioOutputPlan {
  format: ScenarioOutputFormat;
  scene_count: number;
  estimated_duration_sec: number | null;
  status: "planned" | "in_progress" | "completed" | "failed";
  output_path: string | null;
}

export async function loadScenarioFile(filePath: string): Promise<ScenarioFile> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return validateScenarioFile(parsed);
}

function validateScenarioFile(raw: Record<string, unknown>): ScenarioFile {
  if (typeof raw.title !== "string" || !raw.title.trim()) {
    throw new Error("Scenario file must have a non-empty title.");
  }

  if (typeof raw.synopsis !== "string") {
    throw new Error("Scenario file must have a synopsis.");
  }

  const characters = Array.isArray(raw.characters)
    ? raw.characters.map(validateScenarioCharacter)
    : [];

  const scenes = Array.isArray(raw.scenes)
    ? raw.scenes.map(validateScenarioScene)
    : [];

  if (scenes.length === 0) {
    throw new Error("Scenario file must have at least one scene.");
  }

  const outputFormats = Array.isArray(raw.output_formats)
    ? raw.output_formats.filter(isValidOutputFormat)
    : ["longform" as const];

  return {
    schema_version: "0.1",
    title: raw.title.trim(),
    synopsis: raw.synopsis,
    characters,
    scenes,
    output_formats: outputFormats,
    ...(typeof raw.style === "string" ? { style: raw.style } : {}),
    ...(raw.language === "ko" || raw.language === "en" ? { language: raw.language } : {}),
  };
}

function validateScenarioCharacter(raw: unknown): ScenarioCharacter {
  const record = raw as Record<string, unknown>;
  if (typeof record.name !== "string" || !record.name.trim()) {
    throw new Error("Each character must have a name.");
  }

  return {
    name: record.name.trim(),
    description: typeof record.description === "string" ? record.description : "",
    ...(typeof record.character_id === "string" ? { character_id: record.character_id } : {}),
    ...(typeof record.reference_image === "string" ? { reference_image: record.reference_image } : {}),
    ...(typeof record.voice_preset === "string" ? { voice_preset: record.voice_preset } : {}),
  };
}

function validateScenarioScene(raw: unknown): ScenarioScene {
  const record = raw as Record<string, unknown>;
  return {
    scene_number: typeof record.scene_number === "number" ? record.scene_number : 0,
    description: typeof record.description === "string" ? record.description : "",
    ...(Array.isArray(record.dialogue)
      ? { dialogue: record.dialogue.map(validateDialogue) }
      : {}),
    ...(typeof record.duration_hint_sec === "number" ? { duration_hint_sec: record.duration_hint_sec } : {}),
    ...(typeof record.camera === "string" ? { camera: record.camera } : {}),
    ...(typeof record.emotion === "string" ? { emotion: record.emotion } : {}),
    ...(Array.isArray(record.characters_in_scene)
      ? { characters_in_scene: record.characters_in_scene.filter((v): v is string => typeof v === "string") }
      : {}),
  };
}

function validateDialogue(raw: unknown): ScenarioDialogue {
  const record = raw as Record<string, unknown>;
  return {
    speaker: typeof record.speaker === "string" ? record.speaker : "narrator",
    text: typeof record.text === "string" ? record.text : "",
    ...(typeof record.emotion === "string" ? { emotion: record.emotion } : {}),
  };
}

function isValidOutputFormat(value: unknown): value is ScenarioOutputFormat {
  return value === "webtoon" || value === "shortform" || value === "longform";
}
