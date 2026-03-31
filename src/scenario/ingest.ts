import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";
import { resolveScenarioCharacters, type CharacterSetupDependencies } from "./character-setup.js";
import { loadScenarioFile, type ScenarioIngestResult, type ScenarioOutputPlan } from "./types.js";
import { buildLongformStoryboard, buildShortformStoryboard } from "./video-pipeline.js";
import { generateWebtoon, type WebtoonMode } from "./webtoon.js";

export interface IngestScenarioOptions {
  scenarioPath: string;
  rootDir?: string;
  outputDir?: string;
  simulate?: boolean;
  webtoonMode?: WebtoonMode;
  dbPath?: string;
}

export interface IngestScenarioDependencies extends CharacterSetupDependencies {}

export async function ingestScenario(
  options: IngestScenarioOptions,
  dependencies: IngestScenarioDependencies = {},
): Promise<ScenarioIngestResult> {
  const rootDir = resolveMediaForgeRoot(options.rootDir ?? process.cwd());
  const scenario = await loadScenarioFile(options.scenarioPath);

  const resolvedCharacters = await resolveScenarioCharacters(
    scenario.characters,
    {
      rootDir,
      ...(options.outputDir ? { outputDir: options.outputDir } : {}),
      ...(scenario.style ? { style: scenario.style } : {}),
      ...(options.simulate !== undefined ? { simulate: options.simulate } : {}),
      ...(options.dbPath ? { dbPath: options.dbPath } : {}),
    },
    dependencies,
  );

  const plannedOutputs: ScenarioOutputPlan[] = [];
  let storyboardPath: string | null = null;

  for (const format of scenario.output_formats) {
    if (format === "webtoon") {
      if (options.simulate) {
        plannedOutputs.push({
          format: "webtoon",
          scene_count: scenario.scenes.length,
          estimated_duration_sec: null,
          status: "planned",
          output_path: null,
        });
        continue;
      }

      const result = await generateWebtoon(scenario, resolvedCharacters, {
        mode: options.webtoonMode ?? "panel",
        rootDir,
        ...(options.outputDir ? { outputDir: options.outputDir } : {}),
        ...(options.simulate !== undefined ? { simulate: options.simulate } : {}),
        ...(scenario.style ? { style: scenario.style } : {}),
      });

      plannedOutputs.push({
        format: "webtoon",
        scene_count: result.pages.length,
        estimated_duration_sec: null,
        status: "completed",
        output_path: result.output_dir,
      });
    }

    if (format === "shortform") {
      const result = await buildShortformStoryboard(scenario, resolvedCharacters, {
        rootDir,
        ...(options.outputDir ? { outputDir: options.outputDir } : {}),
        ...(options.simulate !== undefined ? { simulate: options.simulate } : {}),
        ...(scenario.style ? { style: scenario.style } : {}),
      });

      storyboardPath = storyboardPath ?? result.storyboard_path;
      plannedOutputs.push({
        format: "shortform",
        scene_count: result.scene_count,
        estimated_duration_sec: result.estimated_duration_sec,
        status: result.status,
        output_path: result.storyboard_path,
      });
    }

    if (format === "longform") {
      const result = await buildLongformStoryboard(scenario, resolvedCharacters, {
        rootDir,
        ...(options.outputDir ? { outputDir: options.outputDir } : {}),
        ...(options.simulate !== undefined ? { simulate: options.simulate } : {}),
        ...(scenario.style ? { style: scenario.style } : {}),
      });

      storyboardPath = storyboardPath ?? result.storyboard_path;
      plannedOutputs.push({
        format: "longform",
        scene_count: result.scene_count,
        estimated_duration_sec: result.estimated_duration_sec,
        status: result.status,
        output_path: result.storyboard_path,
      });
    }
  }

  return {
    scenario,
    resolved_characters: resolvedCharacters,
    planned_outputs: plannedOutputs,
    storyboard_path: storyboardPath,
  };
}
