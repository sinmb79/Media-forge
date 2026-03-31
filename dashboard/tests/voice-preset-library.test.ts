import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardVoicePresetRecord,
  buildVoicePresetSummary,
} from "../src/lib/voice-preset-library";

test("buildVoicePresetSummary highlights the important voice preset traits", () => {
  const summary = buildVoicePresetSummary({
    emotion: "confident",
    lora_path: "loras/hero.safetensors",
    ref_sample: "voices/hero-ref.wav",
    speed: 0.92,
    voice: "hero-voice",
  });

  assert.match(summary, /confident/i);
  assert.match(summary, /0.92x/);
  assert.match(summary, /레퍼런스 샘플 준비됨/);
  assert.match(summary, /LoRA 연결됨/);
  assert.match(summary, /hero-voice/);
});

test("buildDashboardVoicePresetRecord maps forge presets into dashboard cards", () => {
  const card = buildDashboardVoicePresetRecord({
    created_at: 1,
    emotion: "calm",
    lora_path: "loras/ally.safetensors",
    name: "Ally Voice",
    notes: "Warm support role",
    ref_sample: "voices/ally.wav",
    speed: 1,
    storage_path: "workspace/series/current/voices/ally/config.json",
    updated_at: 2,
    voice: "ally-voice",
  });

  assert.equal(card.id, "ally-voice");
  assert.equal(card.has_lora, true);
  assert.equal(card.has_ref_sample, true);
  assert.equal(card.notes, "Warm support role");
  assert.match(card.summary, /음성: ally-voice/);
});
