import * as assert from "node:assert/strict";
import { test } from "node:test";

import { runCli } from "../helpers/run-cli.js";

test("engine dashboard --json returns launch metadata", () => {
  const result = runCli(["dashboard", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    command?: string;
    status?: string;
    url?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.command, "dashboard");
  assert.equal(parsed.status, "ready");
  assert.match(parsed.url ?? "", /^http:\/\/127\.0\.0\.1:3210/);
});

test("engine dashboard --port 3211 --json honors custom port", () => {
  const result = runCli(["dashboard", "--port", "3211", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    port?: number;
    url?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.port, 3211);
  assert.match(parsed.url ?? "", /3211/);
});
