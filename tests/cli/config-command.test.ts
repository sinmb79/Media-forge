import { test } from "node:test";
import * as assert from "node:assert/strict";

import { runCli } from "../helpers/run-cli.js";

test("prints built-in profile catalog for config --json", () => {
  const result = runCli(["config", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    schema_version?: string;
    default_profile?: string;
    profiles?: Array<{ profile_id?: string }>;
    supported_commands?: string[];
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.schema_version, "0.1");
  assert.equal(parsed.default_profile, "youtube_explainer");
  assert.ok(parsed.profiles?.some((profile) => profile.profile_id === "novel_cliffhanger"));
  assert.ok(parsed.supported_commands?.includes("publish"));
});

test("prints short human-readable config summary", () => {
  const result = runCli(["config"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Default profile: youtube_explainer/);
  assert.match(result.stdout, /Profiles: \d+/);
});
