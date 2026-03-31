import * as path from "node:path";

import { ComfyUIBackend } from "./comfyui.js";
import { defaultExecFile, type ExecFileLike } from "./process-runner.js";
import { inspectBackends } from "./registry.js";
import type { VoicePreset } from "../forge/audio/voice-presets.js";
import type {
  ComfyUIOutputFile,
  ComfyUIStatusResult,
} from "./comfyui.js";
import { resolveMediaForgeRoot } from "../shared/resolve-mediaforge-root.js";
import { loadWorkflowTemplate } from "../forge/workflows/load-workflow-template.js";
import type {
  BackendExecutionRequest,
  BackendExecutionResult,
  IBackend,
} from "./types.js";

export type VibeVoiceNarrationModel = "tts-1.5b" | "realtime-0.5b";
export type VibeVoiceAsrEngine = "vibevoice-asr" | "whisper";
export type VibeVoiceRuntimePreference = "auto" | "cli" | "comfyui";
export type VibeVoiceSpeakerPreset = Pick<
  VoicePreset,
  "emotion" | "lora_path" | "name" | "notes" | "ref_sample" | "speed" | "voice"
>;

type WorkflowVariables = Record<string, string | number | boolean>;

export interface VibeVoiceBackendOptions {
  comfyClient?: {
    queueWorkflow(workflow: unknown): Promise<{ prompt_id: string }>;
    saveDownloadedOutput(output: ComfyUIOutputFile, targetPath: string): Promise<string>;
    waitForCompletion(promptId: string): Promise<ComfyUIStatusResult>;
  };
  dramaScriptPath?: string;
  executablePath?: string;
  execFileFn?: ExecFileLike;
  loadWorkflowTemplateFn?: (
    workflowId: string,
    variables: WorkflowVariables,
    rootDir?: string,
  ) => Promise<unknown>;
  modelRoot?: string;
  narrationScriptPath?: string;
  runtimePreference?: VibeVoiceRuntimePreference;
  rootDir?: string;
  transcriptionScriptPath?: string;
  vibeVoiceRoot?: string;
}

export class VibeVoiceBackend implements IBackend {
  readonly name = "python" as const;
  private readonly options: VibeVoiceBackendOptions;

  constructor(options: VibeVoiceBackendOptions = {}) {
    this.options = options;
  }

  async isAvailable(): Promise<boolean> {
    const status = await lookupBackendStatus(this.name);
    return status?.available ?? false;
  }

  async getVersion(): Promise<string | null> {
    return null;
  }

  async execute(request: BackendExecutionRequest): Promise<BackendExecutionResult> {
    return (this.options.execFileFn ?? defaultExecFile)(
      this.options.executablePath ?? "python",
      request.args ?? [],
      request.cwd ? { cwd: request.cwd } : {},
    );
  }

  async generateDrama(
    scriptPath: string,
    speakerNames: string[],
    outputPath: string,
    options: {
      model?: VibeVoiceNarrationModel;
      voicePresets?: VibeVoiceSpeakerPreset[];
    } = {},
  ): Promise<string> {
    const model = options.model ?? "tts-1.5b";
    const runtime = await this.resolveRuntime();
    const speakerReferencePaths = (options.voicePresets ?? [])
      .map((preset) => preset.ref_sample?.trim())
      .filter((preset): preset is string => Boolean(preset));
    const speakerLoraPaths = (options.voicePresets ?? [])
      .map((preset) => preset.lora_path?.trim())
      .filter((preset): preset is string => Boolean(preset));

    if (runtime !== "cli") {
      try {
        return await this.generateWithComfyUI("vibevoice_dialogue_drama", outputPath, {
          attention_mode: "sage",
          cfg_scale: 1.3,
          inference_steps: 10,
          model_path: this.resolveModelPath(model),
          output_path: outputPath,
          quantize_llm_4bit: true,
          script_path: scriptPath,
          speaker_names: speakerNames.join(","),
          speaker_lora_paths: speakerLoraPaths.join("|"),
          speaker_preset_json: JSON.stringify(options.voicePresets ?? []),
          speaker_reference_paths: speakerReferencePaths.join("|"),
        });
      } catch (error) {
        if (this.options.runtimePreference === "comfyui") {
          throw error;
        }
      }
    }

    const cwd = this.resolveWorkingDirectory();
    await this.execute({
      args: [
        this.resolveDramaScriptPath(),
        "--model_path",
        this.resolveModelPath(model),
        "--txt_path",
        scriptPath,
        "--speaker_names",
        speakerNames.join(","),
        "--output",
        outputPath,
      ],
      ...(cwd ? { cwd } : {}),
    });
    return outputPath;
  }

  async generateNarration(
    text: string,
    outputPath: string,
    options: {
      lang?: string;
      model: VibeVoiceNarrationModel;
      voice?: string;
    },
  ): Promise<string> {
    const runtime = await this.resolveRuntime();
    if (runtime !== "cli") {
      try {
        return await this.generateWithComfyUI("vibevoice_narration", outputPath, {
          attention_mode: options.model === "realtime-0.5b" ? "sdpa" : "sage",
          cfg_scale: 1.2,
          inference_steps: 8,
          lang: options.lang ?? "ko",
          model_path: this.resolveModelPath(options.model),
          output_path: outputPath,
          quantize_llm_4bit: options.model !== "realtime-0.5b",
          text: text,
          voice: options.voice ?? "Narrator",
        });
      } catch (error) {
        if (this.options.runtimePreference === "comfyui") {
          throw error;
        }
      }
    }

    const isRealtime = options.model === "realtime-0.5b";
    const args = isRealtime
      ? [
        this.resolveNarrationScriptPath(),
        "--text",
        text,
        "--voice",
        options.voice ?? "default",
        "--output",
        outputPath,
      ]
      : [
        this.resolveDramaScriptPath(),
        "--model_path",
        this.resolveModelPath(options.model),
        "--text",
        text,
        "--speaker_names",
        options.voice ?? "Narrator",
        "--output",
        outputPath,
      ];

    const cwd = this.resolveWorkingDirectory();
    await this.execute({
      args,
      ...(cwd ? { cwd } : {}),
    });
    return outputPath;
  }

  async transcribe(
    inputPath: string,
    outputPath: string,
    options: {
      lang?: string;
    } = {},
  ): Promise<string> {
    const cwd = this.resolveWorkingDirectory();
    await this.execute({
      args: [
        this.resolveTranscriptionScriptPath(),
        "--audio_path",
        inputPath,
        "--language",
        options.lang ?? "auto",
        "--output",
        outputPath,
      ],
      ...(cwd ? { cwd } : {}),
    });
    return outputPath;
  }

  private resolveDramaScriptPath(): string {
    return this.options.dramaScriptPath ?? path.join("demo", "inference_from_file.py");
  }

  private resolveNarrationScriptPath(): string {
    return this.options.narrationScriptPath ?? path.join("demo", "vibevoice_realtime_demo.py");
  }

  private resolveTranscriptionScriptPath(): string {
    return this.options.transcriptionScriptPath ?? path.join("demo", "asr_from_file.py");
  }

  private resolveModelPath(model: VibeVoiceNarrationModel): string {
    const modelRoot = this.options.modelRoot ?? "microsoft";
    return model === "realtime-0.5b"
      ? path.join(modelRoot, "VibeVoice-Realtime-0.5B")
      : path.join(modelRoot, "VibeVoice-1.5B");
  }

  private resolveWorkingDirectory(): string | undefined {
    return this.options.vibeVoiceRoot ?? this.options.rootDir;
  }

  private async generateWithComfyUI(
    workflowId: string,
    outputPath: string,
    variables: WorkflowVariables,
  ): Promise<string> {
    const rootDir = resolveMediaForgeRoot(this.options.rootDir ?? process.cwd());
    const workflow = await (this.options.loadWorkflowTemplateFn ?? loadWorkflowTemplate)(
      workflowId,
      variables,
      rootDir,
    );
    const comfyClient = this.options.comfyClient ?? new ComfyUIBackend({ autoStart: true, rootDir });
    const queued = await comfyClient.queueWorkflow(workflow);
    const status = await comfyClient.waitForCompletion(queued.prompt_id);
    const firstOutput = status.outputs[0];

    if (!firstOutput) {
      throw new Error(`ComfyUI ${workflowId} workflow finished without audio outputs.`);
    }

    await comfyClient.saveDownloadedOutput(firstOutput, outputPath);
    return outputPath;
  }

  private async resolveRuntime(): Promise<VibeVoiceRuntimePreference> {
    if (this.options.runtimePreference === "cli" || this.options.runtimePreference === "comfyui") {
      return this.options.runtimePreference;
    }

    const rootDir = resolveMediaForgeRoot(this.options.rootDir ?? process.cwd());
    const statuses = await inspectBackends(rootDir);
    return statuses.some((status) => status.name === "comfyui" && status.available)
      ? "comfyui"
      : "cli";
  }
}

async function lookupBackendStatus(name: IBackend["name"]) {
  const statuses = await inspectBackends();
  return statuses.find((status) => status.name === name) ?? null;
}
