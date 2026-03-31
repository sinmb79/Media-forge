import * as assert from "node:assert/strict";
import * as path from "node:path";
import { test } from "node:test";

import { listVisualTemplates, runVisualRender } from "../../src/forge/visual/render.js";
import { runVisualComposite } from "../../src/forge/visual/compositor.js";

test("runVisualComposite simulates a visual overlay composition", async () => {
  const result = await runVisualComposite({
    background: "effects/snowfall.html",
    blend: "overlay",
    foreground: "tests/fixtures/video-placeholder.mp4",
    simulate: true,
  });

  assert.equal(result.status, "simulated");
  assert.equal(result.operation, "visual-composite");
  assert.equal(path.extname(result.output_path), ".mp4");
});

test("listVisualTemplates exposes built-in visual effects", () => {
  const templates = listVisualTemplates();

  assert.ok(templates.some((template) => template.id === "effects/lightning"));
  assert.ok(templates.some((template) => template.id === "effects/snowfall"));
});

test("listVisualTemplates supports category and search filters", () => {
  const musicTemplates = listVisualTemplates({
    category: "music",
  });
  const searched = listVisualTemplates({
    search: "aurora",
  });

  assert.ok(musicTemplates.every((template) => template.category === "music"));
  assert.ok(musicTemplates.some((template) => template.id === "music/equalizer-bars"));
  assert.ok(searched.some((template) => template.id === "effects/aurora-flow"));
});

test("runVisualRender simulates a template render output", async () => {
  const result = await runVisualRender({
    durationSec: 5,
    template: "effects/snowfall",
  });

  assert.equal(result.status, "simulated");
  assert.equal(result.operation, "visual-render");
  assert.equal(path.extname(result.output_path), ".mp4");
});

test("runVisualComposite uses ffmpeg overlay when not simulating", async () => {
  const calls: string[][] = [];

  const result = await runVisualComposite(
    {
      background: "effects/snowfall",
      blend: "overlay",
      foreground: "tests/fixtures/video-placeholder.mp4",
      simulate: false,
    },
    {
      ffmpeg: {
        async execute(request) {
          calls.push(request.args ?? []);
          return {
            exitCode: 0,
            stderr: "",
            stdout: "",
          };
        },
      },
      renderBackground: async () => ({ output_path: "rendered-background.mp4" }),
    },
  );

  assert.equal(result.status, "completed");
  assert.match(calls[0]?.join(" ") ?? "", /overlay/);
});
