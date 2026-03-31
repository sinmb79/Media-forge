import * as path from "node:path";

import {
  addBackgroundMusicToVideo,
} from "../../../dist/src/forge/audio/add-bgm.js";
import {
  addSubtitlesToVideo,
} from "../../../dist/src/forge/audio/add-subs.js";
import {
  generateForgeAudioDrama,
} from "../../../dist/src/forge/audio/drama.js";
import {
  listVoicePresets,
} from "../../../dist/src/forge/audio/voice-presets.js";
import {
  narrateForgeAudio,
} from "../../../dist/src/forge/audio/narrate.js";
import {
  separateMediaAudio,
} from "../../../dist/src/forge/audio/separate.js";
import {
  transcribeForgeAudio,
} from "../../../dist/src/forge/audio/asr.js";
import {
  transcribeForgeMedia,
} from "../../../dist/src/forge/audio/transcribe.js";
import {
  synthesizeForgeSpeech,
} from "../../../dist/src/forge/audio/tts.js";
import {
  changeVoicePitch,
} from "../../../dist/src/forge/audio/voice-change.js";

export type DashboardAudioTool =
  | "add-bgm"
  | "add-subs"
  | "asr"
  | "drama"
  | "narrate"
  | "separate"
  | "transcribe"
  | "tts"
  | "voice-change";

export interface DashboardNormalizedAudioRequest {
  engine: "vibevoice-asr" | "whisper";
  inputPath: string | null;
  lang: string;
  model: "realtime-0.5b" | "tts-1.5b";
  musicPath: string | null;
  outputPath: string | null;
  pitch: number;
  scriptPath: string | null;
  scriptText: string;
  speakerNames: string[];
  subsPath: string | null;
  text: string;
  tool: DashboardAudioTool;
  voice: string;
  voiceDir: string | null;
  volume: number;
}

const AUDIO_TOOLS: DashboardAudioTool[] = [
  "tts",
  "drama",
  "narrate",
  "asr",
  "transcribe",
  "add-subs",
  "add-bgm",
  "separate",
  "voice-change",
] as const;

export function isDashboardAudioTool(value: string): value is DashboardAudioTool {
  return AUDIO_TOOLS.includes(value as DashboardAudioTool);
}

export function normalizeDashboardAudioRequest(
  tool: DashboardAudioTool,
  payload: Record<string, unknown>,
): DashboardNormalizedAudioRequest {
  const normalizedModel = payload.model === "tts-1.5b"
    ? "tts-1.5b"
    : tool === "drama"
      ? "tts-1.5b"
      : "realtime-0.5b";

  return {
    engine: payload.engine === "vibevoice-asr" ? "vibevoice-asr" : "whisper",
    inputPath: normalizeOptionalString(payload.input),
    lang: normalizeString(payload.lang, "ko"),
    model: normalizedModel,
    musicPath: normalizeOptionalString(payload.music),
    outputPath: normalizeOptionalString(payload.output),
    pitch: clampNumber(payload.pitch, 0.5, 2, 1),
    scriptPath: normalizeOptionalString(payload.script),
    scriptText: normalizeString(payload.scriptText, ""),
    speakerNames: normalizeSpeakerNames(payload.speakers),
    subsPath: normalizeOptionalString(payload.subs),
    text: normalizeString(payload.text, ""),
    tool,
    voice: normalizeString(payload.voice, "ko-KR-SunHiNeural"),
    voiceDir: normalizeOptionalString(payload.voiceDir),
    volume: clampNumber(payload.volume, 0, 2, 0.3),
  };
}

export function getDashboardAudioMissingInputs(
  request: DashboardNormalizedAudioRequest,
): string[] {
  const missingInputs: string[] = [];

  switch (request.tool) {
    case "tts":
      if (request.text.length === 0) {
        missingInputs.push("text");
      }
      break;
    case "drama":
      if (!request.scriptPath && request.scriptText.length === 0) {
        missingInputs.push("script");
      }
      if (request.speakerNames.length === 0) {
        missingInputs.push("speakers");
      }
      break;
    case "narrate":
      if (request.text.length === 0) {
        missingInputs.push("text");
      }
      break;
    case "asr":
      if (!request.inputPath) {
        missingInputs.push("input");
      }
      break;
    case "transcribe":
    case "separate":
    case "voice-change":
      if (!request.inputPath) {
        missingInputs.push("input");
      }
      break;
    case "add-subs":
      if (!request.inputPath) {
        missingInputs.push("input");
      }
      if (!request.subsPath) {
        missingInputs.push("subs");
      }
      break;
    case "add-bgm":
      if (!request.inputPath) {
        missingInputs.push("input");
      }
      if (!request.musicPath) {
        missingInputs.push("music");
      }
      break;
    default:
      break;
  }

  return missingInputs;
}

export function getDashboardAudioRequiredBackends(
  tool: DashboardAudioTool,
): Array<"ffmpeg" | "python"> {
  switch (tool) {
    case "tts":
    case "transcribe":
    case "drama":
    case "narrate":
    case "asr":
      return ["python"];
    case "add-bgm":
    case "add-subs":
    case "separate":
    case "voice-change":
      return ["ffmpeg"];
    default:
      return [];
  }
}

export async function runDashboardAudioTool(
  tool: DashboardAudioTool,
  payload: Record<string, unknown>,
  rootDir: string,
) {
  const request = normalizeDashboardAudioRequest(tool, payload);

  switch (request.tool) {
    case "tts":
      return synthesizeForgeSpeech({
        lang: request.lang,
        outputPath: request.outputPath ?? buildAudioOutputPath(rootDir, null, "tts", ".mp3"),
        text: request.text,
        voice: request.voice,
      });
    case "drama":
      const voicePresets = await resolveDramaVoicePresets(rootDir, request.voiceDir, request.speakerNames);
      return generateForgeAudioDrama({
        model: request.model,
        outputPath: request.outputPath ?? buildAudioOutputPath(rootDir, request.scriptPath, "drama", ".wav"),
        scriptPath: request.scriptPath ?? undefined,
        scriptText: request.scriptText,
        speakerNames: request.speakerNames,
        ...(voicePresets.length > 0 ? { voicePresets } : {}),
      });
    case "narrate":
      return narrateForgeAudio({
        lang: request.lang,
        model: request.model,
        outputPath: request.outputPath ?? buildAudioOutputPath(rootDir, null, "narrate", ".wav"),
        text: request.text,
        voice: request.voice,
      });
    case "asr":
      return transcribeForgeAudio({
        engine: request.engine,
        inputPath: request.inputPath ?? "",
        lang: request.lang,
        outputPath: request.outputPath ?? buildAudioOutputPath(rootDir, request.inputPath, "asr", ".srt"),
      });
    case "transcribe":
      return transcribeForgeMedia({
        inputPath: request.inputPath ?? "",
        lang: request.lang,
        outputPath: request.outputPath ?? buildAudioOutputPath(rootDir, request.inputPath, "transcribe", ".srt"),
      });
    case "add-subs":
      return addSubtitlesToVideo({
        outputPath: request.outputPath ?? buildAudioOutputPath(
          rootDir,
          request.inputPath,
          "add-subs",
          path.extname(request.inputPath ?? "") || ".mp4",
        ),
        subtitlesPath: request.subsPath ?? "",
        videoPath: request.inputPath ?? "",
      });
    case "add-bgm":
      return addBackgroundMusicToVideo({
        musicPath: request.musicPath ?? "",
        outputPath: request.outputPath ?? buildAudioOutputPath(
          rootDir,
          request.inputPath,
          "add-bgm",
          path.extname(request.inputPath ?? "") || ".mp4",
        ),
        videoPath: request.inputPath ?? "",
        volume: request.volume,
      });
    case "separate":
      return separateMediaAudio({
        inputPath: request.inputPath ?? "",
        outputPath: request.outputPath ?? buildAudioOutputPath(rootDir, request.inputPath, "separate", ".m4a"),
      });
    case "voice-change":
      return changeVoicePitch({
        inputPath: request.inputPath ?? "",
        outputDir: path.resolve(rootDir, "outputs"),
        pitch: request.pitch,
        rootDir,
        simulate: false,
      });
    default:
      throw new Error(`Unsupported audio tool: ${String(tool)}`);
  }
}

function buildAudioOutputPath(
  rootDir: string,
  inputPath: string | null,
  operation: string,
  extension: string,
): string {
  const stem = inputPath
    ? path.basename(inputPath, path.extname(inputPath))
    : operation;
  const suffix = Date.now();
  return path.resolve(rootDir, "outputs", `${stem}-${operation}-${suffix}${extension}`);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }

  return Number(Math.min(max, Math.max(min, numeric)).toFixed(2));
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeSpeakerNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

async function resolveDramaVoicePresets(
  rootDir: string,
  voiceDir: string | null,
  speakerNames: string[],
) {
  if (speakerNames.length === 0) {
    return [];
  }

  const presets = await listVoicePresets(
    voiceDir
      ? { presetDir: voiceDir }
      : { rootDir },
  ).catch(() => []);

  return presets.filter((preset) => speakerNames.includes(preset.name));
}
