import * as assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import { loadScenarioFile } from "../../src/scenario/types.js";
import { ingestScenario } from "../../src/scenario/ingest.js";

function makeTempDir(): string {
  return path.join(os.tmpdir(), `mediaforge-scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

async function writeScenarioFile(dir: string, scenario: Record<string, unknown>): Promise<string> {
  const filePath = path.resolve(dir, "test-scenario.json");
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(scenario), "utf8");
  return filePath;
}

const VALID_SCENARIO = {
  schema_version: "0.1",
  title: "Test Story",
  synopsis: "A test story about a princess",
  characters: [
    { name: "Princess", description: "Young princess with long hair", character_id: "char-1" },
    { name: "Dragon", description: "Friendly dragon" },
  ],
  scenes: [
    { scene_number: 1, description: "Princess wakes up in the castle", emotion: "calm", characters_in_scene: ["Princess"] },
    { scene_number: 2, description: "Dragon appears in the sky", emotion: "surprise", characters_in_scene: ["Dragon"] },
    { scene_number: 3, description: "Princess meets the dragon", emotion: "wonder", characters_in_scene: ["Princess", "Dragon"] },
  ],
  output_formats: ["shortform", "longform"],
  style: "anime",
};

test("loadScenarioFile parses a valid scenario JSON", async () => {
  const dir = makeTempDir();
  const filePath = await writeScenarioFile(dir, VALID_SCENARIO);
  const scenario = await loadScenarioFile(filePath);

  assert.equal(scenario.title, "Test Story");
  assert.equal(scenario.characters.length, 2);
  assert.equal(scenario.scenes.length, 3);
  assert.deepEqual(scenario.output_formats, ["shortform", "longform"]);
  assert.equal(scenario.style, "anime");
});

test("loadScenarioFile throws for missing scenes", async () => {
  const dir = makeTempDir();
  const filePath = await writeScenarioFile(dir, {
    title: "Bad",
    synopsis: "no scenes",
    scenes: [],
  });

  await assert.rejects(() => loadScenarioFile(filePath), {
    message: /at least one scene/,
  });
});

test("loadScenarioFile throws for missing title", async () => {
  const dir = makeTempDir();
  const filePath = await writeScenarioFile(dir, {
    synopsis: "no title",
    scenes: [{ scene_number: 1, description: "test" }],
  });

  await assert.rejects(() => loadScenarioFile(filePath), {
    message: /non-empty title/,
  });
});

test("ingestScenario resolves characters and plans outputs with simulate", async () => {
  const dir = makeTempDir();
  const configDir = path.join(dir, "config");
  await mkdir(configDir, { recursive: true });
  await writeFile(path.join(configDir, "backend-paths.yaml"), JSON.stringify({ backends: {} }));
  await writeFile(path.join(configDir, "defaults.yaml"), JSON.stringify({
    forge: { output_dir: "outputs" },
    llm: { provider: "ollama" },
  }));

  const scenarioPath = await writeScenarioFile(dir, {
    ...VALID_SCENARIO,
    output_formats: ["shortform"],
  });

  const fakeCharacter = {
    id: "char-1",
    name: "Princess",
    type: "anime" as const,
    reference_images: ["/fake/ref.png"],
    description: "Young princess",
  };

  const result = await ingestScenario(
    { scenarioPath, rootDir: dir, simulate: true },
    {
      getCharacterFn: async (input) => {
        if (input.idOrName === "char-1") return fakeCharacter;
        return null;
      },
      createCharacterFn: async (input) => ({
        id: `new-${input.name}`,
        name: input.name,
        type: input.type,
        reference_images: input.reference_images,
        description: input.description,
      }),
    },
  );

  assert.equal(result.scenario.title, "Test Story");
  assert.equal(result.resolved_characters.length, 2);

  const princess = result.resolved_characters.find((c) => c.name === "Princess");
  assert.ok(princess);
  assert.equal(princess.newly_created, false);
  assert.equal(princess.character_id, "char-1");

  const dragon = result.resolved_characters.find((c) => c.name === "Dragon");
  assert.ok(dragon);
  assert.equal(dragon.newly_created, true);

  assert.equal(result.planned_outputs.length, 1);
  assert.equal(result.planned_outputs[0]?.format, "shortform");
});
