import { test } from "node:test";
import * as assert from "node:assert/strict";
import { runCli } from "../helpers/run-cli.js";

test("engine execute --dry-run returns success and JSON output", () => {
  const result = runCli([
    "execute",
    "tests/fixtures/valid-low-cost-request.json",
    "--dry-run",
    "--json",
  ]);

  assert.equal(result.exitCode, 0);
  const parsed = JSON.parse(result.stdout) as {
    schema_version?: string;
    dry_run?: boolean;
    nodes?: unknown[];
    summary?: { total?: number; error?: number };
  };
  assert.equal(parsed.schema_version, "0.1");
  assert.equal(parsed.dry_run, true);
  assert.ok(Array.isArray(parsed.nodes));
  assert.ok((parsed.nodes?.length ?? 0) > 0);
  assert.equal(parsed.summary?.error, 0);
});

test("engine execute --dry-run prints human-readable summary", () => {
  const result = runCli([
    "execute",
    "tests/fixtures/valid-low-cost-request.json",
    "--dry-run",
  ]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /dry.run/i);
  assert.match(result.stdout, /nodes/i);
});

test("engine execute returns error for invalid request", () => {
  const result = runCli([
    "execute",
    "tests/fixtures/invalid-request.json",
    "--dry-run",
  ]);

  assert.notEqual(result.exitCode, 0);
});
