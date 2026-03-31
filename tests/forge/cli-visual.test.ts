import * as assert from "node:assert/strict";
import { test } from "node:test";

import { runCli } from "../helpers/run-cli.js";

test("engine forge visual list returns built-in templates", () => {
  const result = runCli([
    "forge",
    "visual",
    "list",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    count?: number;
    templates?: Array<{ id: string }>;
  };

  assert.equal(result.exitCode, 0);
  assert.ok((parsed.count ?? 0) >= 1);
  assert.ok(parsed.templates?.some((template) => template.id === "effects/lightning"));
});

test("engine forge visual list filters templates by category", () => {
  const result = runCli([
    "forge",
    "visual",
    "list",
    "--category",
    "music",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    count?: number;
    templates?: Array<{ category: string; id: string }>;
  };

  assert.equal(result.exitCode, 0);
  assert.ok((parsed.count ?? 0) >= 1);
  assert.ok(parsed.templates?.every((template) => template.category === "music"));
  assert.ok(parsed.templates?.some((template) => template.id === "music/equalizer-bars"));
});

test("engine forge visual create supports simulation mode", () => {
  const result = runCli([
    "forge",
    "visual",
    "create",
    "--prompt",
    "snow particles drifting through a moonlit forest",
    "--duration",
    "6",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    operation?: string;
    source?: string;
    status?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.operation, "visual-create");
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.source, "template-fallback");
});

test("engine forge visual music-viz supports simulation mode", () => {
  const result = runCli([
    "forge",
    "visual",
    "music-viz",
    "--audio",
    "tests/fixtures/audio-placeholder.mp3",
    "--style",
    "spectrum",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    operation?: string;
    status?: string;
    style?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.operation, "visual-music-viz");
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.style, "spectrum");
});
