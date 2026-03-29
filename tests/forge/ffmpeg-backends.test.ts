import { test } from "node:test";
import * as assert from "node:assert/strict";

import { FFmpegBackend } from "../../src/backends/ffmpeg.js";
import { ProPainterBackend } from "../../src/backends/propainter.js";

test("FFmpegBackend cut builds the expected ffmpeg arguments", async () => {
  const calls: Array<{ file: string; args: string[] }> = [];
  const backend = new FFmpegBackend({
    execFileFn: async (file: string, args: string[]) => {
      calls.push({ args, file });
      return { exitCode: 0, stderr: "", stdout: "" };
    },
  });

  await backend.cut("input.mp4", "00:05", "00:15", "output.mp4");

  assert.equal(calls[0]?.file, "ffmpeg");
  assert.deepEqual(calls[0]?.args, ["-y", "-i", "input.mp4", "-ss", "00:05", "-to", "00:15", "-c", "copy", "output.mp4"]);
});

test("FFmpegBackend parses ffprobe JSON media info", async () => {
  const backend = new FFmpegBackend({
    execFileFn: async () => ({
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify({
        format: { duration: "12.5" },
        streams: [
          { codec_name: "h264", codec_type: "video", avg_frame_rate: "30/1", width: 1080, height: 1920 },
        ],
      }),
    }),
    ffprobePath: "ffprobe",
  });

  const info = await backend.getMediaInfo("input.mp4");

  assert.equal(info.duration, 12.5);
  assert.equal(info.resolution, "1080x1920");
  assert.equal(info.fps, 30);
  assert.equal(info.codec, "h264");
});

test("ProPainterBackend resolves default 16GB-friendly frame size", async () => {
  const calls: Array<{ file: string; args: string[] }> = [];
  const backend = new ProPainterBackend({
    execFileFn: async (file: string, args: string[]) => {
      calls.push({ args, file });
      return { exitCode: 0, stderr: "", stdout: "" };
    },
    pythonPath: "python",
    scriptPath: "inference_propainter.py",
  });

  await backend.run({
    inputPath: "input.mp4",
    maskPath: "mask.png",
    outputPath: "output.mp4",
  });

  assert.equal(calls[0]?.file, "python");
  assert.ok(calls[0]?.args.includes("--fp16"));
  assert.ok(calls[0]?.args.includes("--height"));
  assert.ok(calls[0]?.args.includes("320"));
  assert.ok(calls[0]?.args.includes("--width"));
  assert.ok(calls[0]?.args.includes("576"));
});
