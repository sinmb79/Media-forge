import * as assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import {
  getVoicePreset,
  listVoicePresets,
  saveVoicePreset,
} from "../../src/forge/audio/voice-presets.js";
import { prepareDialogueScript } from "../../src/forge/audio/tag-speakers.js";
import { runEpisodeAudioPipeline } from "../../src/forge/pipeline/episode-audio.js";
import { runTalkingScenePipeline } from "../../src/forge/pipeline/talking-scene.js";

test("voice preset storage saves, lists, and loads character voice presets", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-vibes-"));

  const saved = await saveVoicePreset({
    emotion: "calm",
    name: "Hero",
    ref_sample: "voices/hero-ref.wav",
    rootDir: tempDir,
    speed: 0.95,
    voice: "hero-voice",
  });
  const listed = await listVoicePresets({ rootDir: tempDir });
  const loaded = await getVoicePreset({
    name: "Hero",
    rootDir: tempDir,
  });

  assert.equal(saved.name, "Hero");
  assert.equal(listed.length, 1);
  assert.equal(loaded?.voice, "hero-voice");
  assert.equal(loaded?.ref_sample, "voices/hero-ref.wav");
});

test("prepareDialogueScript tags unlabeled lines with the provided speakers", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-vibes-"));

  const result = await prepareDialogueScript({
    rootDir: tempDir,
    speakerNames: ["Hero", "Ally"],
    text: "We are out of time.\nThen we move now.\nStay close.",
  });
  const script = await readFile(result.script_path, "utf8");

  assert.equal(result.line_count, 3);
  assert.deepEqual(result.speaker_names, ["Hero", "Ally"]);
  assert.match(script, /^Hero: We are out of time\./m);
  assert.match(script, /^Ally: Then we move now\./m);
  assert.match(script, /^Hero: Stay close\./m);
});

test("runEpisodeAudioPipeline prepares a script, generates drama audio, and optional subtitles", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-vibes-"));
  const calls: string[] = [];
  const forwardedPresetNames: string[][] = [];

  const result = await runEpisodeAudioPipeline(
    {
      include_subtitles: true,
      rootDir: tempDir,
      speakerNames: ["Hero", "Ally"],
      text: "We leave tonight.\nUnderstood.",
      voiceRootDir: path.join(tempDir, "workspace", "series", "current", "voices"),
    },
    {
      asrRunner: async ({ inputPath }: { inputPath: string }) => {
        calls.push(`asr:${path.basename(inputPath)}`);
        return {
          backend: "whisper",
          operation: "asr",
          output_path: path.join(tempDir, "episode-audio.srt"),
        };
      },
      dramaRunner: async ({
        scriptPath,
        speakerNames,
        voicePresets,
      }: {
        scriptPath: string;
        speakerNames: string[];
        voicePresets?: Array<{ name: string }>;
      }) => {
        calls.push(`drama:${path.basename(scriptPath)}:${speakerNames.join(",")}`);
        forwardedPresetNames.push((voicePresets ?? []).map((preset) => preset.name));
        return {
          backend: "vibevoice",
          operation: "drama",
          output_path: path.join(tempDir, "episode-audio.wav"),
        };
      },
      presetLoader: async () => [
        {
          created_at: Date.now(),
          emotion: "calm",
          name: "Hero",
          speed: 1,
          storage_path: path.join(tempDir, "voices", "hero", "config.json"),
          updated_at: Date.now(),
        },
      ],
    },
  );

  assert.equal(result.status, "completed");
  assert.equal(result.speaker_count, 2);
  assert.equal(result.resolved_presets.length, 1);
  assert.match(result.output_path, /episode-audio\.wav$/);
  assert.match(result.subtitles_path ?? "", /episode-audio\.srt$/);
  assert.deepEqual(result.resolved_presets.map((preset) => preset.name), ["Hero"]);
  assert.deepEqual(calls, [
    "drama:episode-audio-script.txt:Hero,Ally",
    "asr:episode-audio.wav",
  ]);
  assert.deepEqual(forwardedPresetNames, [["Hero"]]);
});

test("runTalkingScenePipeline generates narration audio before the SkyReels talking pass", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-talking-scene-"));
  const calls: string[] = [];

  await saveVoicePreset({
    name: "Hero",
    rootDir: tempDir,
    voice: "hero-voice",
  });

  const result = await runTalkingScenePipeline(
    {
      desc_ko: "Confident close-up, direct eye contact",
      portraitPath: path.join(tempDir, "portrait.png"),
      quality: "production",
      rootDir: tempDir,
      text: "We leave now. Stay close.",
      voicePresetName: "Hero",
    },
    {
      narrationRunner: async ({ outputPath, voice }) => {
        calls.push(`narrate:${path.basename(outputPath)}:${voice}`);
        return {
          backend: "vibevoice",
          operation: "narrate",
          output_path: outputPath,
        };
      },
      talkingRunner: async ({ audioPath, portraitPath }, _dependencies) => {
        calls.push(`talking:${path.basename(audioPath)}:${path.basename(portraitPath)}`);
        return {
          output_path: path.join(tempDir, "talking-scene.mp4"),
          prompt_bundle: {
            desc_ko: "Confident close-up, direct eye contact",
            image_negative: "",
            image_prompt: "",
            source: "fallback" as const,
            theme: null,
            video_negative: "",
            video_prompt: "",
          },
          request_id: "req_test",
          status: "completed" as const,
          workflow_id: "skyreels_v3_a2v_fp8",
        };
      },
    },
  );

  assert.equal(result.resolved_preset?.name, "Hero");
  assert.match(result.audio_path, /dialogue\.wav$/);
  assert.equal(result.workflow_id, "skyreels_v3_a2v_fp8");
  assert.deepEqual(calls, [
    `narrate:${path.basename(result.audio_path)}:hero-voice`,
    `talking:${path.basename(result.audio_path)}:portrait.png`,
  ]);
});
