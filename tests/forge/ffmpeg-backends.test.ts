import { test } from "node:test";
import * as assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { FFmpegBackend } from "../../src/backends/ffmpeg.js";
import { ProPainterBackend } from "../../src/backends/propainter.js";

test("FFmpegBackend cut builds the expected ffmpeg arguments", async () => {
  const calls: Array<{ file: string; args: string[] }> = [];
  const backend = new FFmpegBackend({
    execFileFn: async (file: string, args: string[]) => {
      calls.push({ args, file });
      return { exitCode: 0, stderr: "", stdout: "" };
    },
    executablePath: "ffmpeg",
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

test("FFmpegBackend prefers resolved executable paths over bare command names", async () => {
  const calls: Array<{ file: string; args: string[] }> = [];
  const backend = new FFmpegBackend({
    execFileFn: async (file: string, args: string[]) => {
      calls.push({ args, file });
      if (String(file).includes("ffprobe")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: JSON.stringify({
            format: { duration: "1.0" },
            streams: [
              { codec_name: "aac", codec_type: "audio" },
            ],
          }),
        };
      }
      return { exitCode: 0, stderr: "", stdout: "" };
    },
    resolveExecutablePaths: async () => ({
      ffmpegPath: "C:/ffmpeg/bin/ffmpeg.exe",
      ffprobePath: "C:/ffmpeg/bin/ffprobe.exe",
    }),
  });

  await backend.cut("input.mp4", "00:05", "00:15", "output.mp4");
  await backend.getMediaInfo("input.mp4");

  assert.equal(calls[0]?.file, "C:/ffmpeg/bin/ffmpeg.exe");
  assert.equal(calls[1]?.file, "C:/ffmpeg/bin/ffprobe.exe");
});

test("ProPainterBackend resolves default 16GB-friendly frame size", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-propainter-test-"));
  const calls: Array<{ file: string; args: string[] }> = [];
  const backend = new ProPainterBackend({
    execFileFn: async (file: string, args: string[]) => {
      calls.push({ args, file });
      const outputRoot = args[args.indexOf("--output") + 1];
      assert.ok(outputRoot);
      const generatedOutputPath = path.join(outputRoot, "input", "inpaint_out.mp4");
      await mkdir(path.dirname(generatedOutputPath), { recursive: true });
      await writeFile(generatedOutputPath, "propainter-output", { encoding: "utf8" });
      return { exitCode: 0, stderr: "", stdout: "" };
    },
    pythonPath: "python",
    scriptPath: "inference_propainter.py",
  });

  const outputPath = path.join(tempDir, "output.mp4");
  const result = await backend.run({
    inputPath: "input",
    maskPath: "mask.png",
    outputPath,
  });

  assert.equal(calls[0]?.file, "python");
  assert.ok(calls[0]?.args.includes("--fp16"));
  assert.ok(calls[0]?.args.includes("--height"));
  assert.ok(calls[0]?.args.includes("320"));
  assert.ok(calls[0]?.args.includes("--width"));
  assert.ok(calls[0]?.args.includes("576"));
  assert.equal(result, outputPath);
  assert.equal(await readFile(outputPath, "utf8"), "propainter-output");
});

test("ProPainterBackend can run with an installed venv runtime", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-propainter-runtime-"));
  const calls: Array<{ file: string; args: string[]; cwd?: string }> = [];
  const backend = new ProPainterBackend({
    execFileFn: async (file: string, args: string[], options?: { cwd?: string }) => {
      calls.push({
        args,
        file,
        ...(options?.cwd ? { cwd: options.cwd } : {}),
      });
      const outputRoot = args[args.indexOf("--output") + 1];
      assert.ok(outputRoot);
      const generatedOutputPath = path.join(outputRoot, "input", "inpaint_out.mp4");
      await mkdir(path.dirname(generatedOutputPath), { recursive: true });
      await writeFile(generatedOutputPath, "runtime-output", { encoding: "utf8" });
      return { exitCode: 0, stderr: "", stdout: "" };
    },
    resolveRuntime: async () => ({
      cwd: "C:/Users/test/ProPainter",
      pythonPath: "C:/Users/test/ProPainter/.venv/Scripts/python.exe",
      scriptPath: "C:/Users/test/ProPainter/inference_propainter.py",
    }),
  });

  const outputPath = path.join(tempDir, "output.mp4");
  const result = await backend.run({
    inputPath: "input",
    maskPath: "mask.png",
    outputPath,
  });

  assert.equal(calls[0]?.file, "C:/Users/test/ProPainter/.venv/Scripts/python.exe");
  assert.equal(calls[0]?.cwd, "C:/Users/test/ProPainter");
  assert.equal(calls[0]?.args[0], "C:/Users/test/ProPainter/inference_propainter.py");
  assert.equal(result, outputPath);
  assert.equal(await readFile(outputPath, "utf8"), "runtime-output");
});
