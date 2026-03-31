import * as assert from "node:assert/strict";
import * as path from "node:path";
import { test } from "node:test";

import { addBackgroundMusicToVideo } from "../../src/forge/audio/add-bgm.js";
import { addSubtitlesToVideo } from "../../src/forge/audio/add-subs.js";
import { generateForgeAudioDrama } from "../../src/forge/audio/drama.js";
import { narrateForgeAudio } from "../../src/forge/audio/narrate.js";
import { transcribeForgeAudio } from "../../src/forge/audio/asr.js";
import { separateMediaAudio } from "../../src/forge/audio/separate.js";
import { synthesizeForgeSpeech } from "../../src/forge/audio/tts.js";
import { transcribeForgeMedia } from "../../src/forge/audio/transcribe.js";
import { changeVoicePitch } from "../../src/forge/audio/voice-change.js";
import { VibeVoiceBackend } from "../../src/backends/vibevoice.js";

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

test("changeVoicePitch uses ffmpeg with rubberband pitch shifting", async () => {
  const recorded: string[][] = [];

  const result = await changeVoicePitch(
    {
      inputPath: "voice.mp3",
      pitch: 1.5,
    },
    {
      ffmpeg: {
        async execute(request: { args?: string[] }) {
          recorded.push(request.args ?? []);
          return {
            exitCode: 0,
            stderr: "",
            stdout: "",
          };
        },
      },
    },
  );

  assert.equal(result.operation, "voice-change");
  assert.equal(result.backend, "ffmpeg");
  assert.match(recorded[0]?.join(" ") ?? "", /rubberband=pitch=1.5/);
});

test("generateForgeAudioDrama uses the VibeVoice backend with speaker names", async () => {
  const recorded: Array<{
    outputPath: string;
    scriptPath: string;
    speakerNames: string[];
    voicePresets?: Array<{ name: string }>;
  }> = [];

  const result = await generateForgeAudioDrama(
    {
      scriptPath: "episode_dialogue.txt",
      speakerNames: ["Hero", "Ally", "Informant"],
      voicePresets: [{ name: "Hero" }] as never,
    },
    {
      vibevoice: {
        async generateDrama(scriptPath, speakerNames, outputPath, options) {
          recorded.push({
            outputPath,
            scriptPath,
            speakerNames,
            ...(options?.voicePresets ? { voicePresets: options.voicePresets.map((preset) => ({ name: preset.name })) } : {}),
          });
          return outputPath;
        },
      },
    },
  );

  assert.equal(result.operation, "drama");
  assert.equal(recorded[0]?.scriptPath, "episode_dialogue.txt");
  assert.deepEqual(recorded[0]?.speakerNames, ["Hero", "Ally", "Informant"]);
  assert.deepEqual(recorded[0]?.voicePresets, [{ name: "Hero" }]);
});

test("narrateForgeAudio uses the VibeVoice narration backend", async () => {
  const recorded: Array<{ model: string; outputPath: string; text: string }> = [];

  const result = await narrateForgeAudio(
    {
      model: "realtime-0.5b",
      outputPath: "narration.wav",
      text: "MediaForge local narration preview",
    },
    {
      vibevoice: {
        async generateNarration(text, outputPath, options) {
          recorded.push({ model: options.model, outputPath, text });
          return outputPath;
        },
      },
    },
  );

  assert.equal(result.operation, "narrate");
  assert.equal(recorded[0]?.model, "realtime-0.5b");
  assert.equal(recorded[0]?.outputPath, "narration.wav");
});

test("transcribeForgeAudio falls back to Whisper when requested", async () => {
  const result = await transcribeForgeAudio(
    {
      engine: "whisper",
      inputPath: "episode.wav",
      lang: "ko",
    },
    {
      whisper: {
        async transcribe() {
          return "episode.srt";
        },
      },
    },
  );

  assert.equal(result.operation, "asr");
  assert.equal(result.backend, "whisper");
  assert.equal(result.output_path, "episode.srt");
});

test("VibeVoiceBackend can route drama generation through ComfyUI workflows", { timeout: 10_000 }, async () => {
  let queuedWorkflow: unknown = null;

  const backend = new VibeVoiceBackend({
    comfyClient: {
      async queueWorkflow(workflow) {
        queuedWorkflow = workflow;
        return { prompt_id: "prompt-1" };
      },
      async saveDownloadedOutput(_output, targetPath) {
        return targetPath;
      },
      async waitForCompletion() {
        return {
          completed: true,
          outputs: [{ filename: "episode.wav", subfolder: "", type: "output" }],
          prompt_id: "prompt-1",
          raw: {},
          status: "success",
        };
      },
    },
    loadWorkflowTemplateFn: async (workflowId, variables) => ({
      variables,
      workflowId,
    }),
    runtimePreference: "comfyui",
    rootDir: process.cwd(),
  });

  const outputPath = await backend.generateDrama(
    "episode_dialogue.txt",
    ["Hero", "Ally"],
    "episode.wav",
    {
      voicePresets: [{
        emotion: "calm",
        lora_path: "loras/hero.safetensors",
        name: "Hero",
        ref_sample: "voices/hero.wav",
        speed: 1,
      }],
    },
  );

  assert.equal(outputPath, "episode.wav");
  assert.equal((queuedWorkflow as { workflowId?: string }).workflowId, "vibevoice_dialogue_drama");
  assert.equal((queuedWorkflow as { variables?: { output_path?: string } }).variables?.output_path, "episode.wav");
  assert.equal((queuedWorkflow as { variables?: { quantize_llm_4bit?: boolean } }).variables?.quantize_llm_4bit, true);
  assert.equal(
    (queuedWorkflow as { variables?: { speaker_reference_paths?: string } }).variables?.speaker_reference_paths,
    "voices/hero.wav",
  );
  assert.equal(
    (queuedWorkflow as { variables?: { speaker_lora_paths?: string } }).variables?.speaker_lora_paths,
    "loras/hero.safetensors",
  );
  assert.equal((queuedWorkflow as { variables?: { speaker_names?: string } }).variables?.speaker_names, "Hero,Ally");
  assert.match(
    String((queuedWorkflow as { variables?: { model_path?: string } }).variables?.model_path),
    /microsoft[\\/]+VibeVoice-1\.5B$/,
  );
});

test("VibeVoiceBackend embeds speaker preset metadata in the ComfyUI workflow payload", async () => {
  let queuedWorkflow: unknown = null;

  const backend = new VibeVoiceBackend({
    comfyClient: {
      async queueWorkflow(workflow) {
        queuedWorkflow = workflow;
        return { prompt_id: "prompt-2" };
      },
      async saveDownloadedOutput(_output, targetPath) {
        return targetPath;
      },
      async waitForCompletion() {
        return {
          completed: true,
          outputs: [{ filename: "episode.wav", subfolder: "", type: "output" }],
          prompt_id: "prompt-2",
          raw: {},
          status: "success",
        };
      },
    },
    loadWorkflowTemplateFn: async (workflowId, variables) => ({ workflowId, variables }),
    runtimePreference: "comfyui",
    rootDir: process.cwd(),
  });

  await backend.generateDrama(
    "episode_dialogue.txt",
    ["Hero"],
    "episode.wav",
    {
      voicePresets: [{
        emotion: "calm",
        lora_path: "loras/hero.safetensors",
        name: "Hero",
        notes: "Series lead",
        ref_sample: "voices/hero.wav",
        speed: 0.97,
        voice: "hero-voice",
      }],
    },
  );

  const payload = queuedWorkflow as { variables?: { speaker_preset_json?: string } };
  assert.match(payload.variables?.speaker_preset_json ?? "", /hero-voice/);
});
