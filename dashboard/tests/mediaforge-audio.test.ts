import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeDashboardAudioRequest,
} from "../src/lib/mediaforge-audio";

test("normalizeDashboardAudioRequest applies narration defaults", () => {
  const request = normalizeDashboardAudioRequest("tts", {
    text: "Hello from MediaForge",
  });

  assert.equal(request.tool, "tts");
  assert.equal(request.text, "Hello from MediaForge");
  assert.equal(request.lang, "ko");
  assert.equal(request.voice, "ko-KR-SunHiNeural");
  assert.equal(request.volume, 0.3);
});

test("normalizeDashboardAudioRequest clamps music mix levels and trims file inputs", () => {
  const request = normalizeDashboardAudioRequest("add-bgm", {
    input: " C:\\temp\\clip.mp4 ",
    music: " C:\\temp\\music.mp3 ",
    volume: "4.8",
  });

  assert.equal(request.tool, "add-bgm");
  assert.equal(request.inputPath, "C:\\temp\\clip.mp4");
  assert.equal(request.musicPath, "C:\\temp\\music.mp3");
  assert.equal(request.volume, 2);
});

test("normalizeDashboardAudioRequest clamps voice change pitch into a safe range", () => {
  const request = normalizeDashboardAudioRequest("voice-change", {
    input: "C:\\temp\\voice.wav",
    pitch: "0.05",
  });

  assert.equal(request.tool, "voice-change");
  assert.equal(request.inputPath, "C:\\temp\\voice.wav");
  assert.equal(request.pitch, 0.5);
});

test("normalizeDashboardAudioRequest keeps VibeVoice drama speaker names and model", () => {
  const request = normalizeDashboardAudioRequest("drama", {
    model: "tts-1.5b",
    script: "C:\\temp\\episode_dialogue.txt",
    speakers: "Hero, Ally, Informant",
    voiceDir: " C:\\temp\\voices ",
  });

  assert.equal(request.tool, "drama");
  assert.equal(request.scriptPath, "C:\\temp\\episode_dialogue.txt");
  assert.deepEqual(request.speakerNames, ["Hero", "Ally", "Informant"]);
  assert.equal(request.model, "tts-1.5b");
  assert.equal(request.voiceDir, "C:\\temp\\voices");
});

test("normalizeDashboardAudioRequest keeps VibeVoice narration model", () => {
  const request = normalizeDashboardAudioRequest("narrate", {
    model: "realtime-0.5b",
    text: "Preview narration",
  });

  assert.equal(request.tool, "narrate");
  assert.equal(request.model, "realtime-0.5b");
  assert.equal(request.text, "Preview narration");
});

test("normalizeDashboardAudioRequest keeps ASR engine choice", () => {
  const request = normalizeDashboardAudioRequest("asr", {
    engine: "vibevoice-asr",
    input: "C:\\temp\\episode.wav",
  });

  assert.equal(request.tool, "asr");
  assert.equal(request.engine, "vibevoice-asr");
  assert.equal(request.inputPath, "C:\\temp\\episode.wav");
});
