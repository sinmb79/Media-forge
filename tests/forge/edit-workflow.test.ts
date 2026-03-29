import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import * as assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import { runInterpolateVideo } from "../../src/forge/edit/interpolate.js";
import { runJoinClips } from "../../src/forge/edit/join.js";
import { runRemoveObject } from "../../src/forge/edit/remove-object.js";
import { runUpscaleMedia } from "../../src/forge/edit/upscale.js";

test("runJoinClips sorts numbered clips and returns the VACE workflow in simulation mode", async () => {
  const clipsDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-join-"));
  await mkdir(clipsDir, { recursive: true });
  await writeFile(path.join(clipsDir, "scene-10.mp4"), "");
  await writeFile(path.join(clipsDir, "scene-2.mp4"), "");
  await writeFile(path.join(clipsDir, "scene-1.mp4"), "");

  const result = await runJoinClips({
    clipsDir,
    simulate: true,
    transition: "ai",
  });

  assert.equal(result.status, "simulated");
  assert.equal(result.workflow_id, "wan_vace_join");
  assert.deepEqual(
    result.clip_paths.map((clipPath) => path.basename(clipPath)),
    ["scene-1.mp4", "scene-2.mp4", "scene-10.mp4"],
  );
});

test("runRemoveObject delegates to ProPainter and returns the output path", async () => {
  const recordedInput: Array<{
    inputPath: string;
    maskPath: string;
    outputPath: string;
  }> = [];

  const result = await runRemoveObject(
    {
      inputPath: "input.mp4",
      maskPath: "mask.png",
    },
    {
      propainter: {
        async run(input) {
          recordedInput.push(input);
          return input.outputPath;
        },
      },
    },
  );

  assert.equal(result.backend, "propainter");
  assert.equal(path.basename(result.output_path), "input-remove-object.mp4");
  if (!recordedInput[0]) {
    throw new Error("Expected ProPainter to receive an input payload.");
  }
  assert.equal(recordedInput[0].maskPath, "mask.png");
});

test("runUpscaleMedia returns the Real-ESRGAN workflow in simulation mode", async () => {
  const result = await runUpscaleMedia({
    inputPath: "clip.mp4",
    scale: 2,
    simulate: true,
  });

  assert.equal(result.status, "simulated");
  assert.equal(result.workflow_id, "realesrgan_upscale");
  assert.equal(result.scale, 2);
});

test("runInterpolateVideo forwards the target fps to ffmpeg", async () => {
  const calls: Array<{ args: string[]; file: string }> = [];

  const result = await runInterpolateVideo(
    {
      fps: 60,
      inputPath: "clip.mp4",
    },
    {
      ffmpeg: {
        async execute(request) {
          calls.push({
            args: request.args ?? [],
            file: "ffmpeg",
          });
          return {
            exitCode: 0,
            stderr: "",
            stdout: "",
          };
        },
      },
    },
  );

  assert.equal(result.backend, "ffmpeg");
  assert.equal(path.basename(result.output_path), "clip-interpolate.mp4");
  assert.ok(calls[0]);
  assert.match(calls[0].args.join(" "), /minterpolate=fps=60/);
});
