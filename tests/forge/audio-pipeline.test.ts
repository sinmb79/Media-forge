import { test } from "node:test";
import * as assert from "node:assert/strict";

import { TTSBackend } from "../../src/backends/tts.js";
import { WhisperBackend } from "../../src/backends/whisper.js";
import { runPipelineChain } from "../../src/forge/pipeline/chain.js";

test("WhisperBackend transcribe builds an srt output command", async () => {
  const calls: Array<{ file: string; args: string[] }> = [];
  const backend = new WhisperBackend({
    execFileFn: async (file: string, args: string[]) => {
      calls.push({ args, file });
      return { exitCode: 0, stderr: "", stdout: "" };
    },
  });

  const output = await backend.transcribe("clip.mp4", "ko");

  assert.equal(output.endsWith(".srt"), true);
  assert.equal(calls[0]?.file, "whisper");
  assert.ok(calls[0]?.args.includes("--language"));
});

test("TTSBackend uses the Korean default voice", async () => {
  const calls: Array<{ file: string; args: string[] }> = [];
  const backend = new TTSBackend({
    execFileFn: async (file: string, args: string[]) => {
      calls.push({ args, file });
      return { exitCode: 0, stderr: "", stdout: "" };
    },
  });

  const output = await backend.synthesize("안녕하세요", "ko", undefined, "speech.mp3");

  assert.equal(output, "speech.mp3");
  assert.equal(calls[0]?.file, "edge-tts");
  assert.ok(calls[0]?.args.includes("ko-KR-SunHiNeural"));
});

test("runPipelineChain skips optional failures and carries outputs forward", async () => {
  const result = await runPipelineChain({
    id: "demo",
    steps: [
      {
        name: "first",
        backend: "local",
        output: { image: "image.png" },
        run: async () => ({ image: "image.png" }),
      },
      {
        name: "optional_fail",
        backend: "local",
        optional: true,
        run: async () => {
          throw new Error("boom");
        },
      },
      {
        name: "second",
        backend: "local",
        input: { image: "$steps.first.image" },
        output: { video: "video.mp4" },
        run: async (context: {
          inputs: Record<string, string>;
          outputs: Record<string, string>;
          stepResults: Record<string, Record<string, string>>;
        }) => ({ video: String(context.inputs.image).replace("image", "video") }),
      },
    ],
  });

  assert.equal(result.status, "success_with_warnings");
  assert.equal(result.steps[1]?.status, "skipped");
  assert.equal(result.outputs.video, "video.png");
});
