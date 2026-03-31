import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { resolveLLMClient } from "../backends/resolve-llm-client.js";
import type { ForgePromptClient } from "../prompt/forge-prompt-builder.js";
import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";
import type { StoryboardDefinition, StoryboardShot, StoryboardSubject } from "../forge/video/storyboard.js";
import type { ResolvedCharacter, ScenarioFile, ScenarioScene } from "./types.js";

const SHORTFORM_MAX_DURATION_SEC = 60;
const DEFAULT_SCENE_DURATION_SEC = 5;

export interface VideoPipelineOptions {
  rootDir?: string;
  outputDir?: string;
  simulate?: boolean;
  style?: string;
  model?: "wan22-q8" | "wan22-q4" | "ltx2";
  resolution?: "720p" | "1080p";
  aspect_ratio?: "smart" | "9:16" | "1:1" | "16:9";
}

export interface VideoPipelineResult {
  format: "shortform" | "longform";
  storyboard_path: string;
  scene_count: number;
  estimated_duration_sec: number;
  status: "planned";
}

export interface VideoPipelineDependencies {
  llmClient?: ForgePromptClient;
}

export async function buildShortformStoryboard(
  scenario: ScenarioFile,
  characters: ResolvedCharacter[],
  options: VideoPipelineOptions = {},
  dependencies: VideoPipelineDependencies = {},
): Promise<VideoPipelineResult> {
  const rootDir = resolveMediaForgeRoot(options.rootDir ?? process.cwd());
  const outputDir = path.resolve(rootDir, options.outputDir ?? "outputs", "shortform");
  await mkdir(outputDir, { recursive: true });

  const keyScenes = await selectKeyScenes(scenario, dependencies, rootDir);
  const totalDuration = keyScenes.reduce(
    (sum, scene) => sum + (scene.duration_hint_sec ?? DEFAULT_SCENE_DURATION_SEC),
    0,
  );
  const scaleFactor = totalDuration > SHORTFORM_MAX_DURATION_SEC
    ? SHORTFORM_MAX_DURATION_SEC / totalDuration
    : 1;

  const primaryCharacter = findPrimaryCharacter(scenario, characters);
  const storyboard = buildStoryboardFromScenes(
    keyScenes,
    primaryCharacter,
    scaleFactor,
    options,
  );

  const storyboardPath = path.resolve(outputDir, `${sanitize(scenario.title)}-shortform.json`);
  await writeFile(storyboardPath, `${JSON.stringify(storyboard, null, 2)}\n`, "utf8");

  const estimatedDuration = storyboard.shots.reduce((sum, shot) => sum + shot.duration_sec, 0);

  return {
    format: "shortform",
    storyboard_path: storyboardPath,
    scene_count: keyScenes.length,
    estimated_duration_sec: estimatedDuration,
    status: "planned",
  };
}

export async function buildLongformStoryboard(
  scenario: ScenarioFile,
  characters: ResolvedCharacter[],
  options: VideoPipelineOptions = {},
): Promise<VideoPipelineResult> {
  const rootDir = resolveMediaForgeRoot(options.rootDir ?? process.cwd());
  const outputDir = path.resolve(rootDir, options.outputDir ?? "outputs", "longform");
  await mkdir(outputDir, { recursive: true });

  const primaryCharacter = findPrimaryCharacter(scenario, characters);
  const storyboard = buildStoryboardFromScenes(
    scenario.scenes,
    primaryCharacter,
    1,
    options,
  );

  const storyboardPath = path.resolve(outputDir, `${sanitize(scenario.title)}-longform.json`);
  await writeFile(storyboardPath, `${JSON.stringify(storyboard, null, 2)}\n`, "utf8");

  const estimatedDuration = storyboard.shots.reduce((sum, shot) => sum + shot.duration_sec, 0);

  return {
    format: "longform",
    storyboard_path: storyboardPath,
    scene_count: scenario.scenes.length,
    estimated_duration_sec: estimatedDuration,
    status: "planned",
  };
}

async function selectKeyScenes(
  scenario: ScenarioFile,
  dependencies: VideoPipelineDependencies,
  rootDir: string,
): Promise<ScenarioScene[]> {
  if (scenario.scenes.length <= 5) {
    return scenario.scenes;
  }

  try {
    const llmClient = dependencies.llmClient ?? await resolveLLMClient({ rootDir });
    const sceneList = scenario.scenes
      .map((s) => `${s.scene_number}: ${s.description}`)
      .join("\n");

    const response = await llmClient.generate(
      `From these scenes, select the 3-5 most important for a 60-second highlight video.
Title: ${scenario.title}
Synopsis: ${scenario.synopsis}

Scenes:
${sceneList}

Output ONLY a comma-separated list of scene numbers (e.g., "1,3,5"). No explanation.`,
    );

    const selectedNumbers = response.trim()
      .split(/[,\s]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);

    if (selectedNumbers.length > 0) {
      const selected = scenario.scenes.filter((s) => selectedNumbers.includes(s.scene_number));
      if (selected.length > 0) return selected;
    }
  } catch {
    // Fall through to deterministic selection.
  }

  const step = Math.max(1, Math.floor(scenario.scenes.length / 5));
  return scenario.scenes.filter((_, index) => index % step === 0).slice(0, 5);
}

function findPrimaryCharacter(
  _scenario: ScenarioFile,
  characters: ResolvedCharacter[],
): StoryboardSubject | undefined {
  const firstCharacter = characters[0];
  if (!firstCharacter) return undefined;

  const refImage = firstCharacter.reference_images[0];
  return {
    name: firstCharacter.name,
    character_id: firstCharacter.character_id,
    ...(refImage ? { reference_image: refImage } : {}),
  };
}

function buildStoryboardFromScenes(
  scenes: ScenarioScene[],
  subject: StoryboardSubject | undefined,
  durationScale: number,
  options: VideoPipelineOptions,
): StoryboardDefinition {
  const shots: StoryboardShot[] = scenes.map((scene) => ({
    id: scene.scene_number,
    duration_sec: Math.max(3, Math.round((scene.duration_hint_sec ?? DEFAULT_SCENE_DURATION_SEC) * durationScale)),
    prompt_ko: scene.description,
    image: null,
    ...(scene.camera ? { camera: scene.camera } : {}),
  }));

  return {
    shots,
    scenes: shots.map((shot) => ({
      desc: shot.prompt_ko,
      duration: shot.duration_sec,
      image: shot.image ?? "",
    })),
    output: {
      resolution: options.resolution ?? "1080p",
      format: "mp4",
    },
    transition: "fade",
    model: options.model ?? "wan22-q8",
    resolution: options.resolution ?? "1080p",
    aspect_ratio: options.aspect_ratio ?? "16:9",
    sound_sync: false,
    ...(subject ? { subject } : {}),
  };
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9가-힣_-]/g, "_").slice(0, 64);
}
