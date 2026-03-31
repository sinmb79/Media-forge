import { test } from "node:test";
import * as assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { runCli } from "../helpers/run-cli.js";

test("engine forge edit cut supports simulation mode", () => {
  const result = runCli([
    "forge",
    "edit",
    "cut",
    "tests/fixtures/video-placeholder.mp4",
    "--start",
    "00:05",
    "--end",
    "00:15",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; operation?: string };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.operation, "cut");
});

test("engine forge audio tts supports simulation mode", () => {
  const result = runCli([
    "forge",
    "audio",
    "tts",
    "--text",
    "안녕하세요",
    "--lang",
    "ko",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; operation?: string };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.operation, "tts");
});

test("engine forge audio drama supports simulation mode", () => {
  const result = runCli([
    "forge",
    "audio",
    "drama",
    "--script",
    "episode_dialogue.txt",
    "--speakers",
    "Hero,Ally,Informant",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { engine?: string; operation?: string; status?: string };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.operation, "drama");
  assert.equal(parsed.engine, "vibevoice");
});

test("engine forge audio narrate supports simulation mode", () => {
  const result = runCli([
    "forge",
    "audio",
    "narrate",
    "--text",
    "MediaForge narration preview",
    "--model",
    "realtime-0.5b",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { engine?: string; operation?: string; status?: string };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.operation, "narrate");
  assert.equal(parsed.engine, "vibevoice");
});

test("engine forge audio asr supports simulation mode", () => {
  const result = runCli([
    "forge",
    "audio",
    "asr",
    "tests/fixtures/audio-placeholder.mp3",
    "--engine",
    "whisper",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { engine?: string; operation?: string; status?: string };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.operation, "asr");
  assert.equal(parsed.engine, "whisper");
});

test("engine forge audio preset-save and preset-list manage local voice presets", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-cli-vibes-"));

  const saveResult = runCli([
    "forge",
    "audio",
    "preset-save",
    "Hero",
    "--ref",
    "voices/hero-ref.wav",
    "--voice",
    "hero-voice",
    "--json",
  ], {
    env: {
      MEDIAFORGE_ROOT: tempDir,
    },
  });
  const listResult = runCli([
    "forge",
    "audio",
    "preset-list",
    "--json",
  ], {
    env: {
      MEDIAFORGE_ROOT: tempDir,
    },
  });
  const saved = JSON.parse(saveResult.stdout) as { name?: string; voice?: string };
  const listed = JSON.parse(listResult.stdout) as { presets?: Array<{ name?: string }> };

  assert.equal(saveResult.exitCode, 0);
  assert.equal(saved.name, "Hero");
  assert.equal(saved.voice, "hero-voice");
  assert.equal(listResult.exitCode, 0);
  assert.equal(listed.presets?.[0]?.name, "Hero");
});

test("engine forge pipeline sketch-to-video supports simulation mode", () => {
  const result = runCli([
    "forge",
    "pipeline",
    "sketch-to-video",
    "tests/fixtures/sketch-placeholder.png",
    "--desc",
    "공주가 숲에서 나비를 쫓는다",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; step_count?: number };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.step_count, 2);
});

test("engine forge pipeline episode-audio supports simulation mode", () => {
  const result = runCli([
    "forge",
    "pipeline",
    "episode-audio",
    "--text",
    "We leave tonight. Understood.",
    "--speakers",
    "Hero,Ally",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; step_count?: number };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.step_count, 3);
});

test("engine forge pipeline sketch-to-long-video supports simulation mode", () => {
  const result = runCli([
    "forge",
    "pipeline",
    "sketch-to-long-video",
    "tests/fixtures/sketch-placeholder.png",
    "--desc",
    "공주가 숲에서 나비를 쫓다가 마법의 호수를 발견한다",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; step_count?: number };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.step_count, 3);
});

test("engine forge prompt feedback stores a scored entry", () => {
  const result = runCli([
    "forge",
    "prompt",
    "feedback",
    "result_1",
    "--score",
    "5",
    "--theme",
    "fairy_tale",
    "--desc",
    "공주가 숲에서 나비를 쫓는다",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { id?: string; score?: number };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.id, "result_1");
  assert.equal(parsed.score, 5);
});

test("engine forge prompt suggest returns success patterns", () => {
  const result = runCli([
    "forge",
    "prompt",
    "suggest",
    "--theme",
    "fairy_tale",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { theme?: string; suggestions?: unknown[] };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.theme, "fairy_tale");
  assert.ok(Array.isArray(parsed.suggestions));
});

test("engine forge install returns backend setup guidance", () => {
  const result = runCli([
    "forge",
    "install",
    "comfyui",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    backend?: string;
    install_guide_url?: string;
    status?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.backend, "comfyui");
  assert.equal(parsed.status, "guide");
  assert.match(String(parsed.install_guide_url), /^https:\/\//);
});

test("engine forge video motion supports simulation mode", () => {
  const result = runCli([
    "forge",
    "video",
    "motion",
    "tests/fixtures/sketch-placeholder.png",
    "--action",
    "orbital",
    "--duration",
    "5",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; workflow_id?: string };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.match(String(parsed.workflow_id), /wan22|ltx2/);
});

test("engine forge video restyle supports simulation mode", () => {
  const result = runCli([
    "forge",
    "video",
    "restyle",
    "tests/fixtures/video-placeholder.mp4",
    "--prompt",
    "change the scene into a dreamy cyber city",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; workflow_id?: string };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.workflow_id, "wan22_v2v_restyle");
});

test("engine forge video reference supports simulation mode", () => {
  const result = runCli([
    "forge",
    "video",
    "reference",
    "tests/fixtures/video-placeholder.mp4",
    "--prompt",
    "match the staging and color timing",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; workflow_id?: string };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.workflow_id, "wan22_reference_video");
});

test("engine forge video talking supports simulation mode with generated dialogue audio", () => {
  const result = runCli([
    "forge",
    "video",
    "talking",
    "tests/fixtures/sketch-placeholder.png",
    "--text",
    "We leave now. Stay close.",
    "--desc",
    "Confident close-up, direct eye contact",
    "--voice-preset",
    "Hero",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    audio_path?: string;
    output_path?: string;
    status?: string;
    workflow_id?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.workflow_id, "skyreels_v3_a2v_fp8");
  assert.match(String(parsed.audio_path), /\.wav$/);
  assert.match(String(parsed.output_path), /\.mp4$/);
});

test("engine forge edit smart-cut supports simulation mode", () => {
  const result = runCli([
    "forge",
    "edit",
    "smart-cut",
    "tests/fixtures/video-placeholder.mp4",
    "--target-duration",
    "30",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; operation?: string };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.operation, "smart-cut");
});

test("engine forge audio voice-change supports simulation mode", () => {
  const result = runCli([
    "forge",
    "audio",
    "voice-change",
    "tests/fixtures/audio-placeholder.mp3",
    "--pitch",
    "1.2",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; operation?: string };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.operation, "voice-change");
});

test("engine forge visual composite supports simulation mode", () => {
  const result = runCli([
    "forge",
    "visual",
    "composite",
    "--fg",
    "tests/fixtures/video-placeholder.mp4",
    "--bg",
    "effects/snowfall.html",
    "--blend",
    "overlay",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; operation?: string };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.operation, "visual-composite");
});
