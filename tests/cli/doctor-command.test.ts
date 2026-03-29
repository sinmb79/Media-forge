import { test } from "node:test";
import * as assert from "node:assert/strict";

import { runCli } from "../helpers/run-cli.js";

test("prints environment doctor report in JSON", () => {
  const result = runCli(["doctor", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    schema_version?: string;
    status?: string;
    checks?: Array<{ name?: string; status?: string }>;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.schema_version, "0.1");
  assert.equal(parsed.status, "ok");
  assert.ok(parsed.checks?.some((check) => check.name === "node_version" && check.status === "ok"));
});

test("prints short human-readable doctor summary", () => {
  const result = runCli(["doctor"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Doctor status: ok/);
  assert.match(result.stdout, /Warnings: 0/);
});
