import { test } from "node:test";
import * as assert from "node:assert/strict";

import { runCli } from "../helpers/run-cli.js";

test("prints request analysis report in JSON", () => {
  const result = runCli(["analyze", "tests/fixtures/valid-low-cost-request.json", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    schema_version?: string;
    request_id?: string;
    recommended_backend?: string;
    warning_count?: number;
    readiness?: { render?: boolean; publish?: boolean };
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.schema_version, "0.1");
  assert.equal(parsed.recommended_backend, "local");
  assert.equal(parsed.readiness?.render, true);
  assert.equal(parsed.readiness?.publish, true);
  assert.equal(typeof parsed.request_id, "string");
  assert.equal(typeof parsed.warning_count, "number");
});

test("prints short human-readable analysis summary", () => {
  const result = runCli(["analyze", "tests/fixtures/valid-low-cost-request.json"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Recommended backend: local/);
  assert.match(result.stdout, /Warnings: \d+/);
});
