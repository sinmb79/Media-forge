import * as assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import { runAutoExtendPipeline } from "../../src/forge/pipeline/auto-extend.js";

test("runAutoExtendPipeline prefers the highest scored candidate when autoPick is best", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mediaforge-auto-extend-best-"));
  const outputPath = path.join(tempRoot, "final.mp4");

  const result = await runAutoExtendPipeline(
    {
      autoPick: "best",
      candidates: 2,
      desc_ko: "너긴이 자기 머리를 두드린다.",
      extend_duration_sec: 5,
      extend_loops: 0,
      model: "skyreels-ref2v",
      outputPath,
      quality: "production",
      rootDir: tempRoot,
      seed_duration_sec: 10,
      simulate: true,
    },
    {
      scoreCandidate: async (candidate) => candidate.id === "seed-002" ? 0.92 : 0.41,
    },
  );

  assert.equal(result.status, "simulated");
  assert.deepEqual(result.pick.selected, ["seed-002"]);
  assert.equal(result.pick.mode, "best");
});
