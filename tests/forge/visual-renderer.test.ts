import * as assert from "node:assert/strict";
import { test } from "node:test";

import { runVisualCreate } from "../../src/forge/visual/create.js";
import { runMusicVisualization } from "../../src/forge/visual/music-viz.js";
import { buildVisualTemplateDocument, runVisualRender } from "../../src/forge/visual/render.js";

test("buildVisualTemplateDocument injects frame-driven rendering parameters", () => {
  const html = buildVisualTemplateDocument({
    params: { density: 0.7, glow: "soft" },
    template: "effects/snowfall",
  });

  assert.match(html, /window\.location\.search/);
  assert.match(html, /frameIndex/);
  assert.match(html, /effects\/snowfall/);
  assert.match(html, /density/);
});

test("buildVisualTemplateDocument keeps palette parameters available to the renderer", () => {
  const html = buildVisualTemplateDocument({
    params: { palette: "rose", intensity: 0.8 },
    template: "effects/aurora-flow",
  });

  assert.match(html, /palette/);
  assert.match(html, /intensity/);
  assert.match(html, /effects\/aurora-flow/);
});

test("runVisualRender renders browser frames and stitches them with ffmpeg", async () => {
  const capturedFrames: Array<{ framePath: string; frameUrl: string }> = [];
  const ffmpegCalls: string[][] = [];

  const result = await runVisualRender(
    {
      durationSec: 2,
      fps: 4,
      simulate: false,
      template: "effects/lightning",
    },
    {
      browserRenderer: {
        async renderFrame(request: { framePath: string; frameUrl: string }) {
          capturedFrames.push({
            framePath: request.framePath,
            frameUrl: request.frameUrl,
          });
        },
      },
      ffmpeg: {
        async execute(request) {
          ffmpegCalls.push(request.args ?? []);
          return {
            exitCode: 0,
            stderr: "",
            stdout: "",
          };
        },
      },
    },
  );

  assert.equal(result.status, "completed");
  assert.equal(capturedFrames.length, 8);
  assert.match(capturedFrames[0]?.frameUrl ?? "", /frame=0/);
  assert.match(capturedFrames[7]?.frameUrl ?? "", /frame=7/);
  assert.match(ffmpegCalls[0]?.join(" ") ?? "", /frame_%05d\.png/);
});

test("runVisualCreate falls back to a built-in template when generated HTML is invalid", async () => {
  const renderedUrls: string[] = [];

  const result = await runVisualCreate(
    {
      durationSec: 1,
      prompt: "a storm of neon lightning around a city skyline",
      simulate: false,
    },
    {
      browserRenderer: {
        async renderFrame(request: { framePath: string; frameUrl: string }) {
          renderedUrls.push(request.frameUrl);
        },
      },
      ffmpeg: {
        async execute() {
          return {
            exitCode: 0,
            stderr: "",
            stdout: "",
          };
        },
      },
      ollama: {
        async generate() {
          return "not html";
        },
      },
    },
  );

  assert.equal(result.status, "completed");
  assert.equal(result.source, "template-fallback");
  assert.match(renderedUrls[0] ?? "", /effects\/lightning/);
});

test("runMusicVisualization builds an ffmpeg spectrum render when not simulating", async () => {
  const calls: string[][] = [];

  const result = await runMusicVisualization(
    {
      audioPath: "tests/fixtures/audio-placeholder.mp3",
      simulate: false,
      style: "spectrum",
    },
    {
      ffmpeg: {
        async execute(request: { args?: string[] }) {
          calls.push(request.args ?? []);
          return {
            exitCode: 0,
            stderr: "",
            stdout: "",
          };
        },
      },
    },
  );

  assert.equal(result.status, "completed");
  assert.match(calls[0]?.join(" ") ?? "", /showspectrum/);
});
