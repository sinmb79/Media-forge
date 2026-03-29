import * as assert from "node:assert/strict";
import * as path from "node:path";
import { test } from "node:test";

import { addBackgroundMusicToVideo } from "../../src/forge/audio/add-bgm.js";
import { addSubtitlesToVideo } from "../../src/forge/audio/add-subs.js";
import { separateMediaAudio } from "../../src/forge/audio/separate.js";
import { synthesizeForgeSpeech } from "../../src/forge/audio/tts.js";
import { transcribeForgeMedia } from "../../src/forge/audio/transcribe.js";

test("synthesizeForgeSpeech forwards language and output path to the TTS backend", async () => {
  const recorded: Array<{ lang: string; output: string; text: string; voice: string | undefined }> = [];

  const result = await synthesizeForgeSpeech(
    {
      lang: "ko",
      outputPath: "speech.mp3",
      text: "안녕하세요",
    },
    {
      tts: {
        async synthesize(text, lang, voice, output) {
          recorded.push({ lang, output, text, voice });
          return output;
        },
      },
    },
  );

  assert.equal(result.output_path, "speech.mp3");
  if (!recorded[0]) {
    throw new Error("Expected the TTS backend to be called.");
  }
  assert.equal(recorded[0].lang, "ko");
  assert.equal(recorded[0].text, "안녕하세요");
});

test("transcribeForgeMedia uses Whisper and returns an srt file", async () => {
  const result = await transcribeForgeMedia(
    {
      inputPath: "clip.mp4",
      lang: "ko",
    },
    {
      whisper: {
        async transcribe() {
          return "clip.srt";
        },
      },
    },
  );

  assert.equal(result.output_path, "clip.srt");
  assert.equal(result.operation, "transcribe");
});

test("addSubtitlesToVideo returns the ffmpeg output path", async () => {
  const result = await addSubtitlesToVideo(
    {
      outputPath: "clip-subs.mp4",
      subtitlesPath: "captions.srt",
      videoPath: "clip.mp4",
    },
    {
      ffmpeg: {
        async addSubtitles() {
          return "clip-subs.mp4";
        },
      },
    },
  );

  assert.equal(result.output_path, "clip-subs.mp4");
});

test("addBackgroundMusicToVideo preserves the requested volume", async () => {
  let recordedVolume: number | null = null;

  const result = await addBackgroundMusicToVideo(
    {
      musicPath: "music.mp3",
      videoPath: "clip.mp4",
      volume: 0.3,
    },
    {
      ffmpeg: {
        async addAudio(_video, _audio, volume, output) {
          recordedVolume = volume;
          return output;
        },
      },
    },
  );

  assert.equal(recordedVolume, 0.3);
  assert.equal(path.basename(result.output_path), "clip-add-bgm.mp4");
});

test("separateMediaAudio falls back to ffmpeg extraction when no stem backend is provided", async () => {
  const result = await separateMediaAudio(
    {
      inputPath: "clip.mp4",
    },
    {
      ffmpeg: {
        async extractAudio(_video, output) {
          return output;
        },
      },
    },
  );

  assert.equal(result.backend, "ffmpeg");
  assert.equal(path.basename(result.output_path), "clip-separate.mp4");
});
