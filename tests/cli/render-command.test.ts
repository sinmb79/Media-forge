import { test } from "node:test";
import * as assert from "node:assert/strict";

import { runCli } from "../helpers/run-cli.js";

test("prints render manifest in JSON", () => {
  const result = runCli(["render", "tests/fixtures/valid-low-cost-request.json", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    schema_version?: string;
    engine?: string;
    output_filename?: string;
    segments?: Array<{ segment_id?: string }>;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.schema_version, "0.1");
  assert.equal(parsed.engine, "local");
  assert.match(parsed.output_filename ?? "", /\.mp4$/);
  assert.equal(parsed.segments?.[0]?.segment_id, "hook");
});

test("prints short human-readable render summary", () => {
  const result = runCli(["render", "tests/fixtures/valid-low-cost-request.json"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Render engine: local/);
  assert.match(result.stdout, /Segments: \d+/);
});
