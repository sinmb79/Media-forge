import * as path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { resolveLLMClient } from "../backends/resolve-llm-client.js";
import { runImageGenerate } from "../forge/image/generate.js";
import type { ForgePromptClient } from "../prompt/forge-prompt-builder.js";
import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";
import type { ResolvedCharacter, ScenarioFile, ScenarioScene } from "./types.js";

export type WebtoonMode = "panel" | "page";

export interface WebtoonOptions {
  mode?: WebtoonMode;
  panels_per_page?: number;
  rootDir?: string;
  outputDir?: string;
  simulate?: boolean;
  style?: string;
}

export interface WebtoonResult {
  mode: WebtoonMode;
  pages: WebtoonPage[];
  output_dir: string;
  status: "simulated" | "completed";
}

export interface WebtoonPage {
  page_number: number;
  image_path: string;
  panel_paths: string[];
  scene_numbers: number[];
}

export interface WebtoonDependencies {
  llmClient?: ForgePromptClient;
  generateImage?: typeof runImageGenerate;
}

export async function generateWebtoon(
  scenario: ScenarioFile,
  characters: ResolvedCharacter[],
  options: WebtoonOptions = {},
  dependencies: WebtoonDependencies = {},
): Promise<WebtoonResult> {
  const rootDir = resolveMediaForgeRoot(options.rootDir ?? process.cwd());
  const mode = options.mode ?? "panel";
  const panelsPerPage = options.panels_per_page ?? 4;
  const outputDir = path.resolve(rootDir, options.outputDir ?? "outputs", "webtoon", sanitize(scenario.title));
  const style = options.style ?? scenario.style ?? "anime";

  await mkdir(outputDir, { recursive: true });

  if (options.simulate) {
    const pages = buildSimulatedPages(scenario.scenes, panelsPerPage, outputDir, mode);
    return { mode, pages, output_dir: outputDir, status: "simulated" };
  }

  const llmClient = dependencies.llmClient ?? await resolveLLMClient({ rootDir });
  const generateImage = dependencies.generateImage ?? runImageGenerate;
  const characterMap = buildCharacterMap(characters);

  if (mode === "panel") {
    return generatePanelWebtoon(scenario, characterMap, llmClient, generateImage, style, panelsPerPage, outputDir, rootDir);
  }

  return generatePageWebtoon(scenario, characterMap, llmClient, generateImage, style, outputDir, rootDir);
}

async function generatePanelWebtoon(
  scenario: ScenarioFile,
  characterMap: Map<string, ResolvedCharacter>,
  llmClient: ForgePromptClient,
  generateImage: typeof runImageGenerate,
  style: string,
  panelsPerPage: number,
  outputDir: string,
  rootDir: string,
): Promise<WebtoonResult> {
  const panelPaths: Array<{ path: string; sceneNumber: number }> = [];

  for (const scene of scenario.scenes) {
    const prompt = await buildPanelPrompt(scene, characterMap, llmClient, style);
    const result = await generateImage({
      prompt,
      model: "sdxl",
      resolution: "2k",
      aspect_ratio: "3:4",
      batch_count: 1,
      outputDir,
      rootDir,
      theme: style,
    });

    const imagePath = result.output_paths[0];
    if (imagePath) {
      panelPaths.push({ path: imagePath, sceneNumber: scene.scene_number });
    }
  }

  const pages: WebtoonPage[] = [];
  for (let i = 0; i < panelPaths.length; i += panelsPerPage) {
    const chunk = panelPaths.slice(i, i + panelsPerPage);
    const pageNumber = pages.length + 1;
    const pagePath = path.resolve(outputDir, `page-${pageNumber}.png`);

    pages.push({
      page_number: pageNumber,
      image_path: pagePath,
      panel_paths: chunk.map((p) => p.path),
      scene_numbers: chunk.map((p) => p.sceneNumber),
    });
  }

  await writeWebtoonManifest(outputDir, scenario.title, pages);

  return { mode: "panel", pages, output_dir: outputDir, status: "completed" };
}

async function generatePageWebtoon(
  scenario: ScenarioFile,
  characterMap: Map<string, ResolvedCharacter>,
  llmClient: ForgePromptClient,
  generateImage: typeof runImageGenerate,
  style: string,
  outputDir: string,
  rootDir: string,
): Promise<WebtoonResult> {
  const pages: WebtoonPage[] = [];

  for (const [index, scene] of scenario.scenes.entries()) {
    const prompt = await buildPagePrompt(scene, characterMap, llmClient, style);
    const result = await generateImage({
      prompt,
      model: "sdxl",
      resolution: "2k",
      aspect_ratio: "9:16",
      batch_count: 1,
      outputDir,
      rootDir,
      theme: style,
    });

    const imagePath = result.output_paths[0];
    if (imagePath) {
      pages.push({
        page_number: index + 1,
        image_path: imagePath,
        panel_paths: [imagePath],
        scene_numbers: [scene.scene_number],
      });
    }
  }

  await writeWebtoonManifest(outputDir, scenario.title, pages);

  return { mode: "page", pages, output_dir: outputDir, status: "completed" };
}

async function buildPanelPrompt(
  scene: ScenarioScene,
  characterMap: Map<string, ResolvedCharacter>,
  llmClient: ForgePromptClient,
  style: string,
): Promise<string> {
  const characterDescs = (scene.characters_in_scene ?? [])
    .map((name) => characterMap.get(name))
    .filter(Boolean)
    .map((c) => c!.name)
    .join(", ");

  const raw = await llmClient.generate(
    `Convert this scene into a webtoon panel prompt for SDXL.
Scene: ${scene.description}
Characters: ${characterDescs || "none specified"}
Style: ${style} webtoon panel, manga style, clean lines
Emotion: ${scene.emotion ?? "neutral"}
Output a single English SDXL prompt. No JSON.`,
  );

  return raw.trim() || `${style} webtoon panel, ${scene.description}, detailed, clean lines`;
}

async function buildPagePrompt(
  scene: ScenarioScene,
  characterMap: Map<string, ResolvedCharacter>,
  llmClient: ForgePromptClient,
  style: string,
): Promise<string> {
  const characterDescs = (scene.characters_in_scene ?? [])
    .map((name) => characterMap.get(name))
    .filter(Boolean)
    .map((c) => c!.name)
    .join(", ");

  const raw = await llmClient.generate(
    `Convert this scene into a full webtoon page prompt for SDXL.
Scene: ${scene.description}
Characters: ${characterDescs || "none specified"}
Style: ${style} webtoon page, vertical scroll format, cinematic composition
Emotion: ${scene.emotion ?? "neutral"}
Output a single English SDXL prompt. No JSON.`,
  );

  return raw.trim() || `${style} webtoon page, ${scene.description}, vertical, cinematic`;
}

function buildCharacterMap(characters: ResolvedCharacter[]): Map<string, ResolvedCharacter> {
  const map = new Map<string, ResolvedCharacter>();
  for (const c of characters) {
    map.set(c.name, c);
  }
  return map;
}

function buildSimulatedPages(
  scenes: ScenarioScene[],
  panelsPerPage: number,
  outputDir: string,
  mode: WebtoonMode,
): WebtoonPage[] {
  if (mode === "page") {
    return scenes.map((scene, index) => ({
      page_number: index + 1,
      image_path: path.resolve(outputDir, `page-${index + 1}.png`),
      panel_paths: [],
      scene_numbers: [scene.scene_number],
    }));
  }

  const pages: WebtoonPage[] = [];
  for (let i = 0; i < scenes.length; i += panelsPerPage) {
    const chunk = scenes.slice(i, i + panelsPerPage);
    const pageNumber = pages.length + 1;
    pages.push({
      page_number: pageNumber,
      image_path: path.resolve(outputDir, `page-${pageNumber}.png`),
      panel_paths: chunk.map((_, j) => path.resolve(outputDir, `panel-${i + j + 1}.png`)),
      scene_numbers: chunk.map((s) => s.scene_number),
    });
  }
  return pages;
}

async function writeWebtoonManifest(outputDir: string, title: string, pages: WebtoonPage[]): Promise<void> {
  const manifest = { title, page_count: pages.length, pages };
  await writeFile(path.resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9가-힣_-]/g, "_").slice(0, 64);
}
