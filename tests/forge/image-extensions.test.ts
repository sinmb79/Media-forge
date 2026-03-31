import * as assert from "node:assert/strict";
import * as path from "node:path";
import { test } from "node:test";

import { runImageGenerate } from "../../src/forge/image/generate.js";
import { runImageInpaint } from "../../src/forge/image/inpaint.js";
import { runImg2Img } from "../../src/forge/image/img2img.js";
import { runRemoveBackground } from "../../src/forge/image/remove-bg.js";

test("runImageGenerate builds batch output paths for simulation", async () => {
  const result = await runImageGenerate({
    aspect_ratio: "16:9",
    batch_count: 2,
    model: "sdxl",
    prompt: "공주가 숲 속 호수 앞에 서 있다",
    resolution: "2k",
  });

  assert.equal(result.status, "simulated");
  assert.equal(result.output_paths.length, 2);
  assert.equal(result.workflow_id, "sdxl_text_to_image");
});

test("runImg2Img returns a styled output path in simulation mode", async () => {
  const result = await runImg2Img({
    input_path: "tests/fixtures/sketch-placeholder.png",
    model: "sdxl",
    prompt: "anime fantasy concept art",
    strength: 0.7,
    style: "anime",
  });

  assert.equal(result.status, "simulated");
  assert.equal(path.extname(result.output_path), ".png");
});

test("runRemoveBackground returns an isolated png result in simulation mode", async () => {
  const result = await runRemoveBackground({
    inputPath: "tests/fixtures/sketch-placeholder.png",
    simulate: true,
  });

  assert.equal(result.status, "simulated");
  assert.equal(result.backend, "python");
  assert.equal(path.extname(result.output_path), ".png");
});

test("runImageInpaint returns an inpaint workflow result in simulation mode", async () => {
  const result = await runImageInpaint({
    inputPath: "tests/fixtures/sketch-placeholder.png",
    maskPath: "tests/fixtures/mask-placeholder.png",
    prompt: "blue twilight sky",
    simulate: true,
  });

  assert.equal(result.status, "simulated");
  assert.equal(result.workflow_id, "sdxl_inpaint");
  assert.equal(path.extname(result.output_path), ".png");
});
