import * as assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import { composeSeedSession } from "../../src/forge/video/compose.js";
import { SeedSessionManager } from "../../src/forge/video/seed-session.js";

test("composeSeedSession mixes generated voiceover audio when withAudio is enabled", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mediaforge-compose-audio-"));
  const sessionDir = path.join(tempRoot, "workspace", "seeds", "ep23-noggin");
  const manager = await SeedSessionManager.create({
    candidateCount: 1,
    duration: 10,
    model: "skyreels-ref2v",
    outputDir: sessionDir,
    prompt: "Noggin drums on his head and starts to wobble.",
    voiceover: {
      enabled: true,
      segments: [
        {
          dialogue: "Tap tap tap.",
          end: 4,
          speaker: "narrator",
          start: 0,
          subtitle: "TAP TAP TAP",
        },
        {
          dialogue: "I can see stars now.",
          end: 8,
          speaker: "noggin",
          start: 4,
          subtitle: "DIZZY EYES",
        },
      ],
    },
  });

  await manager.registerCandidateResult("seed-001", {
    file: "seed-001.mp4",
    status: "generated",
  });
  await writeFile(path.join(sessionDir, "seed-001.mp4"), "video", "utf8");

  const calls: string[] = [];
  const outputPath = path.join(sessionDir, "final.mp4");

  const result = await composeSeedSession(
    {
      outputPath,
      rootDir: tempRoot,
      sessionDir,
      sourceId: "seed-001",
      withAudio: true,
    },
    {
      audioDramaRunner: async ({ outputPath, scriptText, speakerNames }) => {
        calls.push(`audio:${speakerNames.join(",")}:${scriptText}`);
        return {
          backend: "vibevoice" as const,
          operation: "drama" as const,
          output_path: outputPath ?? path.join(tempRoot, "seed-001-voiceover.wav"),
        };
      },
      ffmpegBackend: {
        addAudio: async (video: string, audio: string, volume: number, output: string) => {
          calls.push(`mix:${path.basename(video)}:${path.basename(audio)}:${volume}:${path.basename(output)}`);
          return output;
        },
        addSubtitles: async (video: string, srt: string, output: string) => {
          calls.push(`subs:${path.basename(video)}:${path.basename(srt)}:${path.basename(output)}`);
          return output;
        },
        concat: async () => outputPath,
      } as never,
    },
  );

  assert.equal(result.with_audio, true);
  assert.match(result.audio_path ?? "", /seed-001-voiceover\.wav$/);
  assert.equal(calls[0], "audio:narrator,noggin:narrator: Tap tap tap.\nnoggin: I can see stars now.");
  assert.match(calls[1] ?? "", /^mix:mediaforge-compose-base-.*\.mp4:seed-001-voiceover\.wav:1:mediaforge-compose-mixed-.*\.mp4$/);
  assert.match(calls[2] ?? "", /^subs:mediaforge-compose-mixed-.*\.mp4:seed-001-voiceover\.srt:final\.mp4$/);
});

test("composeSeedSession burns subtitles into the mixed video when voiceover metadata is available", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mediaforge-compose-subs-"));
  const sessionDir = path.join(tempRoot, "workspace", "seeds", "ep23-noggin");
  const manager = await SeedSessionManager.create({
    candidateCount: 1,
    duration: 10,
    model: "skyreels-ref2v",
    outputDir: sessionDir,
    prompt: "Noggin drums on his head and starts to wobble.",
    voiceover: {
      enabled: true,
      segments: [
        {
          dialogue: "Tap tap tap.",
          end: 4,
          speaker: "narrator",
          start: 0,
          subtitle: "TAP TAP TAP",
        },
      ],
    },
  });

  await manager.registerCandidateResult("seed-001", {
    file: "seed-001.mp4",
    status: "generated",
  });
  await writeFile(path.join(sessionDir, "seed-001.mp4"), "video", "utf8");

  const calls: string[] = [];
  const outputPath = path.join(sessionDir, "final.mp4");

  await composeSeedSession(
    {
      outputPath,
      rootDir: tempRoot,
      sessionDir,
      sourceId: "seed-001",
      withAudio: true,
    },
    {
      audioDramaRunner: async ({ outputPath: audioOutputPath }) => ({
        backend: "vibevoice" as const,
        operation: "drama" as const,
        output_path: audioOutputPath ?? path.join(tempRoot, "seed-001-voiceover.wav"),
      }),
      ffmpegBackend: {
        addAudio: async (video: string, audio: string, volume: number, output: string) => {
          calls.push(`mix:${path.basename(video)}:${path.basename(audio)}:${volume}:${path.basename(output)}`);
          return output;
        },
        addSubtitles: async (video: string, srt: string, output: string) => {
          calls.push(`subs:${path.basename(video)}:${path.basename(srt)}:${path.basename(output)}`);
          return output;
        },
        concat: async () => outputPath,
      } as never,
    },
  );

  assert.match(calls[0] ?? "", /^mix:mediaforge-compose-base-.*\.mp4:seed-001-voiceover\.wav:1:mediaforge-compose-mixed-.*\.mp4$/);
  assert.match(calls[1] ?? "", /^subs:mediaforge-compose-mixed-.*\.mp4:seed-001-voiceover\.srt:final\.mp4$/);
});
