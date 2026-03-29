import { test } from "node:test";
import * as assert from "node:assert/strict";

import { runCli } from "../helpers/run-cli.js";

test("prints publish manifest in JSON", () => {
  const result = runCli(["publish", "tests/fixtures/valid-low-cost-request.json", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    schema_version?: string;
    platform?: string;
    title?: string;
    hashtags?: string[];
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.schema_version, "0.1");
  assert.equal(parsed.platform, "youtube_shorts");
  assert.match(parsed.title ?? "", /AI meeting note tool/);
  assert.ok(parsed.hashtags?.includes("#explainer"));
});

test("prints short human-readable publish summary", () => {
  const result = runCli(["publish", "tests/fixtures/valid-low-cost-request.json"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Publish platform: youtube_shorts/);
  assert.match(result.stdout, /Hashtags: \d+/);
});
