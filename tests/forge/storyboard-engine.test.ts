import * as assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import {
  loadStoryboardDefinition,
  runStoryboardVideo,
} from "../../src/forge/video/storyboard.js";

test("loadStoryboardDefinition normalizes feature-map storyboard JSON", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-storyboard-"));
  const storyboardPath = path.join(tempDir, "storyboard.json");

  await writeFile(
    storyboardPath,
    `${JSON.stringify({
      aspect_ratio: "16:9",
      model: "wan22-q8",
      resolution: "1080p",
      shots: [
        {
          camera: "slow_push_in",
          duration_sec: 3,
          id: 1,
          image: null,
          prompt_ko: "공주가 숲길을 걷는다",
        },
      ],
      sound_sync: false,
      subject: {
        name: "공주",
        reference_image: "refs/princess.png",
      },
      transition: "ai",
    }, null, 2)}\n`,
    "utf8",
  );

  const storyboard = await loadStoryboardDefinition(storyboardPath);

  assert.equal(storyboard.subject?.name, "공주");
  assert.equal(storyboard.shots.length, 1);
  assert.equal(storyboard.shots[0]?.camera, "slow_push_in");
  assert.equal(storyboard.transition, "ai");
});

test("runStoryboardVideo simulates per-shot clip generation and final render output", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-storyboard-"));
  const storyboardPath = path.join(tempDir, "storyboard.json");

  await writeFile(
    storyboardPath,
    `${JSON.stringify({
      aspect_ratio: "16:9",
      model: "wan22-q8",
      resolution: "1080p",
      shots: [
        {
          camera: "slow_push_in",
          duration_sec: 3,
          id: 1,
          image: "scene1.png",
          prompt_ko: "공주가 숲길을 걷는다",
        },
        {
          camera: "orbital",
          duration_sec: 5,
          id: 2,
          image: null,
          prompt_ko: "나비가 공주에게 다가온다",
        },
      ],
      sound_sync: false,
      transition: "cut",
    }, null, 2)}\n`,
    "utf8",
  );

  const result = await runStoryboardVideo({
    rootDir: tempDir,
    simulate: true,
    storyboardPath,
  });

  assert.equal(result.status, "simulated");
  assert.equal(result.shot_count, 2);
  assert.equal(result.clip_paths.length, 2);
  assert.equal(result.transition, "cut");
  assert.match(result.output_path, /mp4$/);
});

test("runStoryboardVideo routes image and text shots through the right generators", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-storyboard-"));
  const storyboardPath = path.join(tempDir, "storyboard.json");
  const calls: string[] = [];

  await writeFile(
    storyboardPath,
    `${JSON.stringify({
      aspect_ratio: "16:9",
      model: "wan22-q4",
      resolution: "720p",
      shots: [
        {
          duration_sec: 3,
          id: 1,
          image: "scene1.png",
          prompt_ko: "공주가 정원을 걷는다",
        },
        {
          duration_sec: 4,
          id: 2,
          image: null,
          prompt_ko: "카메라가 호수 쪽으로 이동한다",
        },
      ],
      sound_sync: false,
      transition: "cut",
    }, null, 2)}\n`,
    "utf8",
  );

  const result = await runStoryboardVideo(
    {
      rootDir: tempDir,
      storyboardPath,
    },
    {
      fromImageRunner: async () => {
        calls.push("from-image");
        return {
          output_path: path.join(tempDir, "clip-1.mp4"),
          prompt_bundle: {
            desc_ko: "공주가 정원을 걷는다",
            image_negative: "",
            image_prompt: "",
            source: "fallback",
            theme: null,
            video_negative: "",
            video_prompt: "",
          },
          request_id: "clip-1",
          status: "completed",
          workflow_id: "wan22_i2v_gguf_q4",
        };
      },
      fromTextRunner: async () => {
        calls.push("from-text");
        return {
          output_path: path.join(tempDir, "clip-2.mp4"),
          prompt_bundle: {
            desc_ko: "카메라가 호수 쪽으로 이동한다",
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
        };
      },
      joinStrategy: async (clipPaths, outputPath) => {
        calls.push(`join:${clipPaths.length}`);
        return outputPath;
      },
    },
  );

  assert.deepEqual(calls, ["from-image", "from-text", "join:2"]);
  assert.equal(result.status, "completed");
  assert.equal(result.clip_paths.length, 2);
});
