import * as assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import {
  addForgeAsset,
  listForgeAssets,
  removeForgeAsset,
  seedForgeAssetLibrary,
} from "../../src/forge/assets/library.js";

test("seedForgeAssetLibrary loads official seed assets into SQLite", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-assets-"));
  const dbPath = path.join(tempDir, "mediaforge.db");
  const result = await seedForgeAssetLibrary({
    dbPath,
    rootDir: process.cwd(),
  });
  const backgrounds = await listForgeAssets({
    category: "backgrounds",
    dbPath,
  });

  assert.equal(result.status, "seeded");
  assert.ok(result.seeded_count >= 5);
  assert.ok(backgrounds.length > 0);
  assert.ok(backgrounds.every((asset) => asset.category === "backgrounds"));
});

test("forge asset library supports add and remove operations", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-assets-"));
  const dbPath = path.join(tempDir, "mediaforge.db");
  const added = await addForgeAsset({
    category: "effects",
    data: {
      prompt: "cinematic lightning flash",
    },
    dbPath,
    name: "Lightning Flash",
    rootDir: process.cwd(),
    type: "visual_template",
  });
  const listed = await listForgeAssets({
    dbPath,
    type: "visual_template",
  });
  const removed = await removeForgeAsset({
    dbPath,
    id: added.id,
  });
  const afterRemove = await listForgeAssets({ dbPath });

  assert.ok(listed.some((asset) => asset.id === added.id));
  assert.equal(removed.removed, true);
  assert.ok(afterRemove.every((asset) => asset.id !== added.id));
});

test("seedForgeAssetLibrary can load seed files from an explicit workspace root", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-assets-root-"));
  const dbPath = path.join(tempDir, "mediaforge.db");
  const seedRoot = path.join(tempDir, "workspace");

  await mkdir(path.join(seedRoot, "data", "seeds"), { recursive: true });
  await writeFile(
    path.join(seedRoot, "data", "seeds", "backgrounds.json"),
    `${JSON.stringify([
      {
        category: "backgrounds",
        data: { prompt: "quiet cafe interior" },
        id: "bg-cafe",
        name: "Cafe Interior",
        type: "prompt_preset",
      },
    ], null, 2)}\n`,
    "utf8",
  );

  for (const fileName of ["characters.json", "effects.json", "motions.json", "props.json"]) {
    await writeFile(path.join(seedRoot, "data", "seeds", fileName), "[]\n", "utf8");
  }

  const result = await seedForgeAssetLibrary({
    dbPath,
    rootDir: seedRoot,
  });
  const listed = await listForgeAssets({
    dbPath,
  });

  assert.equal(result.seeded_count, 1);
  assert.equal(listed[0]?.id, "bg-cafe");
});
