import { test } from "node:test";
import * as assert from "node:assert/strict";

import { runCli } from "../helpers/run-cli.js";

test("prints structured JSON for prompt --json", () => {
  const result = runCli(["prompt", "tests/fixtures/valid-low-cost-request.json", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    schema_version?: string;
    engine?: string;
    main_prompt?: string;
    params?: { duration_sec?: number };
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.schema_version, "0.1");
  assert.equal(parsed.engine, "local");
  assert.equal(parsed.params?.duration_sec, 20);
  assert.match(parsed.main_prompt ?? "", /AI meeting note tool/);
});

test("includes novel-derived prompt details for novel requests", () => {
  const result = runCli(["prompt", "tests/fixtures/novel-cliffhanger-request.json", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    schema_version?: string;
    main_prompt?: string;
    params?: { duration_sec?: number };
    style_descriptor?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.schema_version, "0.1");
  assert.equal(parsed.params?.duration_sec, 25);
  assert.match(parsed.main_prompt ?? "", /Novel highlight:/);
  assert.match(parsed.style_descriptor ?? "", /cliffhanger/);
});

test("prints human-readable prompt output", () => {
  const result = runCli(["prompt", "tests/fixtures/valid-low-cost-request.json"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Engine: local/);
  assert.match(result.stdout, /Main prompt:/);
});
