import * as assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import {
  createCharacter,
  getCharacter,
  listCharacters,
  removeCharacter,
} from "../../src/forge/character/manager.js";
import { runCharacterDubbing } from "../../src/forge/character/dubbing.js";

test("character manager supports create, list, lookup, and remove", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-character-"));
  const dbPath = path.join(tempDir, "mediaforge.db");

  const created = await createCharacter({
    dbPath,
    description: "A fairy tale princess character preset.",
    name: "Princess",
    reference_images: ["refs/princess.png"],
    type: "anime",
    voice_preset: "ko-KR-SunHiNeural",
  });
  const listed = await listCharacters({ dbPath });
  const lookedUp = await getCharacter({
    dbPath,
    idOrName: "Princess",
  });
  const removed = await removeCharacter({
    dbPath,
    id: created.id,
  });

  assert.equal(listed.length, 1);
  assert.equal(lookedUp?.name, "Princess");
  assert.equal(lookedUp?.type, "anime");
  assert.equal(removed.removed, true);
});

test("runCharacterDubbing returns a simulated dubbing result for a saved character", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-character-"));
  const dbPath = path.join(tempDir, "mediaforge.db");
  const created = await createCharacter({
    dbPath,
    description: "Narrator preset",
    name: "Narrator",
    reference_images: ["refs/narrator.png"],
    type: "realistic",
  });

  const result = await runCharacterDubbing({
    character_id: created.id,
    dbPath,
    language: "ko",
    rootDir: tempDir,
    simulate: true,
    text: "안녕하세요. MediaForge입니다.",
  });

  assert.equal(result.status, "simulated");
  assert.equal(result.character_id, created.id);
  assert.match(result.audio_path, /mp3$/);
  assert.match(result.output_path, /mp4$/);
  assert.equal(result.reference_image, "refs/narrator.png");
});
