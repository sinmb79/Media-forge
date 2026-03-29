import { mkdtemp, readFile } from "node:fs/promises";
import * as assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import { generateStoryboardMode } from "../../src/novel/storyboard-mode.js";
import { runPipelineBatch } from "../../src/forge/pipeline/batch.js";

test("generateStoryboardMode falls back to four storyboard scenes without Ollama", async () => {
  const result = await generateStoryboardMode({
    desc_ko: "공주가 숲에서 나비를 쫓다가 마법의 호수를 발견한다",
    ollamaClient: {
      async isAvailable() {
        return false;
      },
      async generate() {
        throw new Error("offline");
      },
    },
  });

  assert.equal(result.scenes.length, 4);
  assert.equal(result.output.format, "mp4");
  assert.ok(result.scenes.every((scene) => scene.duration > 0));
});

test("runPipelineBatch resumes from checkpoint and skips completed items", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-batch-"));
  const checkpointPath = path.join(tempDir, "checkpoint.json");
  const executions: string[] = [];

  await runPipelineBatch({
    checkpointPath,
    items: [
      { id: "scene-1", payload: "first" },
      { id: "scene-2", payload: "second" },
    ],
    runItem: async (item) => {
      executions.push(item.id);
      if (item.id === "scene-2") {
        throw new Error("interrupt");
      }
      return { clip: `${item.id}.mp4` };
    },
  });

  const resumed = await runPipelineBatch({
    checkpointPath,
    items: [
      { id: "scene-1", payload: "first" },
      { id: "scene-2", payload: "second" },
    ],
    runItem: async (item) => {
      executions.push(item.id);
      return { clip: `${item.id}.mp4` };
    },
  });

  const checkpointRaw = await readFile(checkpointPath, "utf8");
  const checkpoint = JSON.parse(checkpointRaw) as { completed?: string[] };

  assert.deepEqual(executions, ["scene-1", "scene-2", "scene-2"]);
  assert.equal(resumed.completed_count, 2);
  assert.equal(resumed.resumed_from_checkpoint, true);
  assert.deepEqual(checkpoint.completed, ["scene-1", "scene-2"]);
});
