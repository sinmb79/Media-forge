import * as assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import { runStoryboardVideo } from "../../src/forge/video/storyboard.js";
import type { BackendExecutionRequest, BackendExecutionResult } from "../../src/backends/types.js";

test("runStoryboardVideo uses ffmpeg xfade for fade transitions", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-storyboard-fade-"));
  const storyboardPath = path.join(tempDir, "storyboard.json");
  const executeCalls: string[][] = [];

  await writeFile(
    storyboardPath,
    `${JSON.stringify({
      aspect_ratio: "16:9",
      model: "wan22-q8",
      resolution: "1080p",
      shots: [
        { duration_sec: 3, id: 1, image: "scene1.png", prompt_ko: "first clip" },
        { duration_sec: 4, id: 2, image: null, prompt_ko: "second clip" },
      ],
      transition: "fade",
    }, null, 2)}\n`,
    "utf8",
  );

  const result = await runStoryboardVideo(
    {
      rootDir: tempDir,
      storyboardPath,
    },
    {
      ffmpegBackend: {
        async execute(request: BackendExecutionRequest): Promise<BackendExecutionResult> {
          executeCalls.push(request.args ?? []);
          return {
            exitCode: 0,
            stderr: "",
            stdout: "",
          };
        },
        async getMediaInfo(inputPath: string) {
          return {
            codec: "h264",
            duration: inputPath.endsWith("clip-1.mp4") ? 3 : 4,
            fps: 24,
            resolution: "1280x720",
          };
        },
      } as never,
      fromImageRunner: async () => ({
        output_path: path.join(tempDir, "clip-1.mp4"),
        prompt_bundle: {
          desc_ko: "first clip",
          image_negative: "",
          image_prompt: "",
          source: "fallback",
          theme: null,
          video_negative: "",
          video_prompt: "",
        },
        request_id: "clip-1",
        status: "completed",
        workflow_id: "wan22_i2v_gguf_q8",
      }),
      fromTextRunner: async () => ({
        output_path: path.join(tempDir, "clip-2.mp4"),
        prompt_bundle: {
          desc_ko: "second clip",
          image_negative: "",
          image_prompt: "",
          source: "fallback",
          theme: null,
          video_negative: "",
          video_prompt: "",
        },
        request_id: "clip-2",
        status: "completed",
        workflow_id: "wan22_t2v_gguf",
      }),
    },
  );

  assert.equal(result.status, "completed");
  assert.equal(result.transition, "fade");
  assert.equal(executeCalls.length, 1);
  assert.ok(executeCalls[0]?.includes("-filter_complex"));
  assert.match(executeCalls[0]?.join(" ") ?? "", /xfade=transition=fade:duration=0\.5:offset=2\.5/);
});
