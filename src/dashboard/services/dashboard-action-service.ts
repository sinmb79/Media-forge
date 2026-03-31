import { stat } from "node:fs/promises";
import * as path from "node:path";

import { inspectBackends } from "../../backends/registry.js";
import type { BackendName, BackendStatus } from "../../backends/types.js";
import { forgeAudioCommand } from "../../cli/forge-audio-command.js";
import { forgeEditCommand } from "../../cli/forge-edit-command.js";
import { forgeImageCommand } from "../../cli/forge-image-command.js";
import { forgePipelineCommand } from "../../cli/forge-pipeline-command.js";
import { forgePromptCommand } from "../../cli/forge-prompt-command.js";
import { forgeVideoCommand } from "../../cli/forge-video-command.js";
import { buildForgeDoctorReport } from "../../forge/doctor/build-forge-doctor-report.js";
import { validateForgePaths } from "../../forge/doctor/validate-forge-paths.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import {
  DashboardJobMetadataPatch,
  DashboardJobQueue,
  type DashboardResultKind,
} from "./dashboard-job-queue.js";

export type DashboardActionName =
  | "doctor"
  | "probe"
  | "paths-validate"
  | "prompt-build"
  | "image-sketch"
  | "video-from-image"
  | "video-from-text"
  | "edit-run"
  | "audio-run"
  | "pipeline-run";

export interface DashboardActionAccepted {
  action: DashboardActionName;
  job_id: string;
  label: string;
  status: "queued";
}

export interface DashboardActionBlocked {
  action: DashboardActionName;
  status: "blocked";
  reason: string;
  missing_backends: string[];
  missing_inputs: string[];
  next_steps: string[];
}

export interface DashboardActionServiceOptions {
  inspectBackends?: () => Promise<BackendStatus[]>;
  rootDir?: string;
  runners?: Partial<Record<DashboardActionName, DashboardActionRunner>>;
}

type DashboardActionRunner = (payload: Record<string, unknown>) => Promise<unknown>;

interface ActionPreflightResult {
  reason: string;
  missingBackends: BackendName[];
  missingInputs: string[];
  nextSteps: string[];
  resultKind: DashboardResultKind;
  expectedArtifact: boolean;
}

interface ActionVerificationResult {
  artifactExists: boolean | null;
  artifactPath: string | null;
  details: string;
  nextStep: string | null;
  ok: boolean;
  reason: string;
  resultKind: DashboardResultKind;
  summary: string;
}

export class DashboardActionService {
  private readonly inspectBackendsFn: () => Promise<BackendStatus[]>;
  private readonly rootDir: string;
  private readonly runners: Partial<Record<DashboardActionName, DashboardActionRunner>>;

  constructor(
    private readonly jobQueue: DashboardJobQueue,
    rootDirOrOptions: string | DashboardActionServiceOptions = resolveMediaForgeRoot(),
  ) {
    if (typeof rootDirOrOptions === "string") {
      this.rootDir = resolveMediaForgeRoot(rootDirOrOptions);
      this.inspectBackendsFn = () => inspectBackends(this.rootDir);
      this.runners = {};
      return;
    }

    this.rootDir = resolveMediaForgeRoot(rootDirOrOptions.rootDir ?? process.cwd());
    this.inspectBackendsFn = rootDirOrOptions.inspectBackends ?? (() => inspectBackends(this.rootDir));
    this.runners = rootDirOrOptions.runners ?? {};
  }

  async enqueueAction(
    action: DashboardActionName,
    payload: Record<string, unknown>,
  ): Promise<DashboardActionAccepted | DashboardActionBlocked> {
    const backends = await this.inspectBackendsFn();
    const preflight = buildActionPreflight(action, payload, backends);

    if (preflight.reason.length > 0) {
      return {
        action,
        status: "blocked",
        reason: preflight.reason,
        missing_backends: preflight.missingBackends,
        missing_inputs: preflight.missingInputs,
        next_steps: preflight.nextSteps,
      };
    }

    const jobId = createRequestId({
      action,
      payload,
      timestamp: Date.now(),
    });
    const label = buildLabel(action, payload);

    this.jobQueue.createJob({
      id: jobId,
      kind: action,
      label,
      input: payload,
    });
    this.jobQueue.updateMetadata(jobId, {
      details: "Queued and waiting for execution.",
      expected_artifact: preflight.expectedArtifact,
      phase: "execution",
      result_kind: preflight.resultKind,
      summary: "Queued",
    });
    this.jobQueue.appendLog(jobId, `Queued ${label}`);

    queueMicrotask(() => {
      void this.execute(jobId, action, payload, preflight);
    });

    return {
      action,
      job_id: jobId,
      label,
      status: "queued",
    };
  }

  private async execute(
    jobId: string,
    action: DashboardActionName,
    payload: Record<string, unknown>,
    preflight: ActionPreflightResult,
  ): Promise<void> {
    try {
      this.jobQueue.markRunning(jobId);
      this.jobQueue.updateMetadata(jobId, {
        details: "Executing dashboard action.",
        expected_artifact: preflight.expectedArtifact,
        phase: "execution",
        result_kind: preflight.resultKind,
        summary: "Execution running",
      });
      this.jobQueue.appendLog(jobId, "Starting action");
      this.jobQueue.updateProgress(jobId, 0.2);

      const output = await this.runAction(action, payload);

      this.jobQueue.updateProgress(jobId, 0.8);
      this.jobQueue.appendLog(jobId, "Execution finished, verifying result");
      this.jobQueue.updateMetadata(jobId, {
        details: "Execution finished. Checking the final result.",
        phase: "verification",
        summary: "Verifying result",
      });

      const verification = await verifyActionResult(action, output);

      if (!verification.ok) {
        this.jobQueue.appendLog(jobId, verification.reason, "error");
        this.jobQueue.fail(jobId, verification.reason, {
          artifact_exists: verification.artifactExists,
          artifact_path: verification.artifactPath,
          details: verification.details,
          expected_artifact: preflight.expectedArtifact,
          next_step: verification.nextStep,
          phase: "verification",
          result_kind: verification.resultKind,
          summary: verification.summary,
        });
        return;
      }

      this.jobQueue.appendLog(jobId, verification.summary);
      this.jobQueue.succeed(jobId, output, {
        artifact_exists: verification.artifactExists,
        artifact_path: verification.artifactPath,
        details: verification.details,
        expected_artifact: preflight.expectedArtifact,
        next_step: verification.nextStep,
        phase: "verification",
        result_kind: verification.resultKind,
        summary: verification.summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.jobQueue.appendLog(jobId, message, "error");
      this.jobQueue.fail(jobId, message, {
        details: message,
        expected_artifact: preflight.expectedArtifact,
        next_step: suggestRecoveryStep(action, preflight.resultKind),
        phase: "execution",
        result_kind: preflight.resultKind,
        summary: "Execution failed",
      });
    }
  }

  private async runAction(
    action: DashboardActionName,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    const customRunner = this.runners[action];
    if (customRunner) {
      return customRunner(payload);
    }

    switch (action) {
      case "doctor":
        return buildForgeDoctorReport({ rootDir: this.rootDir });
      case "probe":
        return {
          schema_version: "0.1",
          backends: await this.inspectBackendsFn(),
        };
      case "paths-validate":
        return validateForgePaths(this.rootDir);
      case "prompt-build":
        return this.runCliAction(() => forgePromptCommand(["build"], {
          json: true,
          optionValues: buildOptionValues({
            desc: payload.desc,
            model: payload.model,
            theme: payload.theme,
          }),
        }));
      case "image-sketch":
        return this.runCliAction(() => forgeImageCommand([
          "sketch",
          toStringValue(payload.sketchPath),
        ], {
          json: true,
          optionValues: buildOptionValues({
            desc: payload.desc,
            theme: payload.theme,
          }),
          simulate: toBooleanValue(payload.simulate),
        }));
      case "video-from-image":
        return this.runCliAction(() => forgeVideoCommand([
          "from-image",
          toStringValue(payload.imagePath),
        ], {
          json: true,
          optionValues: buildOptionValues({
            desc: payload.desc,
            model: payload.model,
            quality: payload.quality,
          }),
          simulate: toBooleanValue(payload.simulate),
        }));
      case "video-from-text":
        return this.runCliAction(() => forgeVideoCommand(["from-text"], {
          json: true,
          optionValues: buildOptionValues({
            desc: payload.desc,
            quality: payload.quality,
          }),
          simulate: toBooleanValue(payload.simulate),
        }));
      case "edit-run":
        return this.runCliAction(() => forgeEditCommand(buildPositionals(
          toStringValue(payload.subcommand),
          toStringValue(payload.input),
          toStringArray(payload.extraInputs),
        ), {
          json: true,
          optionValues: buildOptionValues({
            start: payload.start,
            end: payload.end,
            factor: payload.factor,
            ratio: payload.ratio,
            resolution: payload.resolution,
            scale: payload.scale,
            fps: payload.fps,
            transition: payload.transition,
            mask: payload.mask,
          }),
          simulate: toBooleanValue(payload.simulate),
        }));
      case "audio-run":
        return this.runCliAction(() => forgeAudioCommand(buildPositionals(
          toStringValue(payload.subcommand),
          toStringValue(payload.input),
        ), {
          json: true,
          optionValues: buildOptionValues({
            text: payload.text,
            lang: payload.lang,
            voice: payload.voice,
            subs: payload.subs,
            music: payload.music,
            volume: payload.volume,
          output: payload.output,
          pitch: payload.pitch,
        }),
        simulate: toBooleanValue(payload.simulate),
      }));
      case "pipeline-run":
        return this.runCliAction(() => forgePipelineCommand(buildPositionals(
          toStringValue(payload.subcommand),
          toStringValue(payload.primaryInput),
        ), {
          flags: new Set(toBooleanValue(payload.subs) ? ["subs"] : []),
          json: true,
          optionValues: buildOptionValues({
            desc: payload.desc,
            lang: payload.lang,
            model: payload.model,
            speakers: payload.speakers,
            storyboard: payload.storyboard,
            text: payload.text,
            "voice-dir": payload.voiceDir,
          }),
          simulate: toBooleanValue(payload.simulate),
        }));
      default:
        throw new Error(`Unsupported dashboard action: ${action}`);
    }
  }

  private async runCliAction(
    run: () => Promise<{ exitCode: number; output: string }>,
  ): Promise<unknown> {
    const result = await run();

    if (result.exitCode !== 0) {
      throw new Error(result.output.trim() || "Dashboard action failed.");
    }

    try {
      return JSON.parse(result.output);
    } catch {
      return {
        output: result.output.trim(),
      };
    }
  }
}

function buildActionPreflight(
  action: DashboardActionName,
  payload: Record<string, unknown>,
  backends: BackendStatus[],
): ActionPreflightResult {
  const availableBackends = new Set(
    backends.filter((backend) => backend.available).map((backend) => backend.name),
  );
  const missingInputs: string[] = [];
  const requiredBackends = new Set<BackendName>();
  const resultKind = isNonFileAction(action) ? "non_file" : "file";
  const expectedArtifact = resultKind === "file";

  switch (action) {
    case "prompt-build":
      requireStringValue(payload.desc, "desc", missingInputs);
      break;
    case "image-sketch":
      requireStringValue(payload.desc, "desc", missingInputs);
      requireStringValue(payload.sketchPath, "sketchPath", missingInputs);
      requiredBackends.add("comfyui");
      break;
    case "video-from-image":
      requireStringValue(payload.desc, "desc", missingInputs);
      requireStringValue(payload.imagePath, "imagePath", missingInputs);
      requiredBackends.add("comfyui");
      break;
    case "video-from-text":
      requireStringValue(payload.desc, "desc", missingInputs);
      requiredBackends.add("comfyui");
      break;
    case "edit-run":
      requireStringValue(payload.subcommand, "subcommand", missingInputs);
      requireStringValue(payload.input, "input", missingInputs);
      for (const backend of resolveEditBackends(payload)) {
        requiredBackends.add(backend);
      }
      if (toStringValue(payload.subcommand) === "remove-object") {
        requireStringValue(payload.mask, "mask", missingInputs);
      }
      break;
    case "audio-run":
      requireStringValue(payload.subcommand, "subcommand", missingInputs);
      for (const inputName of resolveAudioRequiredInputs(payload)) {
        requireStringValue(payload[inputName], inputName, missingInputs);
      }
      for (const backend of resolveAudioBackends(payload)) {
        requiredBackends.add(backend);
      }
      break;
    case "pipeline-run":
      requireStringValue(payload.subcommand, "subcommand", missingInputs);
      if (toStringValue(payload.subcommand) === "episode-audio") {
        requireStringValue(payload.speakers, "speakers", missingInputs);
        if (!hasStringValue(payload.primaryInput) && !hasStringValue(payload.text)) {
          missingInputs.push("primaryInput");
        }
      }
      for (const inputName of resolvePipelineRequiredInputs(payload)) {
        requireStringValue(payload[inputName], inputName, missingInputs);
      }
      for (const backend of resolvePipelineBackends(payload)) {
        requiredBackends.add(backend);
      }
      break;
    case "doctor":
    case "probe":
    case "paths-validate":
      break;
    default:
      break;
  }

  const missingBackends = [...requiredBackends].filter((backend) => !availableBackends.has(backend));
  const reason = buildBlockedReason(missingInputs, missingBackends);

  return {
    reason,
    missingBackends,
    missingInputs,
    nextSteps: buildBlockedNextSteps(missingInputs, missingBackends),
    resultKind,
    expectedArtifact,
  };
}

async function verifyActionResult(
  action: DashboardActionName,
  output: unknown,
): Promise<ActionVerificationResult> {
  if (isNonFileAction(action)) {
    return {
      artifactExists: null,
      artifactPath: null,
      details: "Result verified. No output file was expected for this action.",
      nextStep: "Review the JSON result in the inspector.",
      ok: output !== null && output !== undefined,
      reason: "Result verification failed.",
      resultKind: "non_file",
      summary: "Generated and verified",
    };
  }

  const artifactPath = extractArtifactPath(output);
  if (!artifactPath) {
    return {
      artifactExists: false,
      artifactPath: null,
      details: "The command finished, but the result did not include an output file path.",
      nextStep: "Review the action output and backend logs, then retry.",
      ok: false,
      reason: "Command finished but no output file was created.",
      resultKind: "file",
      summary: "Command finished but no output file was created.",
    };
  }

  const artifactExists = await doesArtifactExist(artifactPath);
  if (!artifactExists) {
    return {
      artifactExists: false,
      artifactPath,
      details: `Expected output file was not found or was empty: ${artifactPath}`,
      nextStep: "Check the backend output directory and rerun the action.",
      ok: false,
      reason: "Command finished but no output file was created.",
      resultKind: "file",
      summary: "Command finished but no output file was created.",
    };
  }

  return {
    artifactExists: true,
    artifactPath,
    details: `Verified artifact at ${artifactPath}`,
    nextStep: "Review the result in Preview Workspace.",
    ok: true,
    reason: "",
    resultKind: "file",
    summary: "Generated and verified",
  };
}

function resolveEditBackends(payload: Record<string, unknown>): BackendName[] {
  const subcommand = toStringValue(payload.subcommand);

  switch (subcommand) {
    case "join":
    case "upscale":
      return ["comfyui"];
    case "remove-object":
      return ["propainter"];
    case "remove-watermark":
      return isImageLikePath(toStringValue(payload.input)) ? ["comfyui"] : ["propainter"];
    case "cut":
    case "concat":
    case "smart-cut":
    case "speed":
    case "resize":
    case "stabilize":
    case "interpolate":
      return ["ffmpeg"];
    default:
      return [];
  }
}

function resolveAudioBackends(payload: Record<string, unknown>): BackendName[] {
  const subcommand = toStringValue(payload.subcommand);

  switch (subcommand) {
    case "tts":
    case "transcribe":
      return ["python"];
    case "add-subs":
    case "add-bgm":
    case "separate":
    case "voice-change":
      return ["ffmpeg"];
    default:
      return [];
  }
}

function resolveAudioRequiredInputs(payload: Record<string, unknown>): string[] {
  const subcommand = toStringValue(payload.subcommand);

  switch (subcommand) {
    case "tts":
      return ["text"];
    case "transcribe":
      return ["input"];
    case "add-subs":
      return ["input", "subs"];
    case "add-bgm":
      return ["input", "music"];
    case "separate":
    case "voice-change":
      return ["input"];
    default:
      return [];
  }
}

function resolvePipelineBackends(payload: Record<string, unknown>): BackendName[] {
  const subcommand = toStringValue(payload.subcommand);

  switch (subcommand) {
    case "episode-audio":
      return ["python"];
    case "sketch-to-video":
      return ["comfyui"];
    case "storyboard":
      return ["comfyui"];
    case "sketch-to-long-video":
      return ["comfyui", "ollama"];
    default:
      return [];
  }
}

function resolvePipelineRequiredInputs(payload: Record<string, unknown>): string[] {
  const subcommand = toStringValue(payload.subcommand);

  switch (subcommand) {
    case "episode-audio":
      return [];
    case "sketch-to-video":
    case "sketch-to-long-video":
      return ["primaryInput", "desc"];
    case "storyboard":
      return ["primaryInput"];
    default:
      return [];
  }
}

function buildBlockedReason(
  missingInputs: string[],
  missingBackends: BackendName[],
): string {
  if (missingInputs.length > 0 && missingBackends.length > 0) {
    return `Missing required inputs (${humanizeFieldNames(missingInputs).join(", ")}) and required backends (${missingBackends.join(", ")}).`;
  }

  if (missingInputs.length > 0) {
    return `Missing required inputs: ${humanizeFieldNames(missingInputs).join(", ")}.`;
  }

  if (missingBackends.length > 0) {
    return `Missing required backends: ${missingBackends.join(", ")}.`;
  }

  return "";
}

function buildBlockedNextSteps(
  missingInputs: string[],
  missingBackends: BackendName[],
): string[] {
  const nextSteps: string[] = [];

  if (missingInputs.length > 0) {
    nextSteps.push(`Fill in: ${humanizeFieldNames(missingInputs).join(", ")}`);
  }

  for (const backend of missingBackends) {
    nextSteps.push(`Install or start ${backend} and retry.`);
  }

  return nextSteps;
}

function buildLabel(action: DashboardActionName, payload: Record<string, unknown>): string {
  switch (action) {
    case "prompt-build":
      return "Prompt Build";
    case "image-sketch":
      return `Image Sketch: ${toStringValue(payload.sketchPath) || "input"}`;
    case "video-from-image":
      return `Video From Image: ${toStringValue(payload.imagePath) || "input"}`;
    case "video-from-text":
      return "Video From Text";
    case "edit-run":
      return `Edit: ${toStringValue(payload.subcommand) || "run"}`;
    case "audio-run":
      return `Audio: ${toStringValue(payload.subcommand) || "run"}`;
    case "pipeline-run":
      return `Pipeline: ${toStringValue(payload.subcommand) || "run"}`;
    case "doctor":
      return "Forge Doctor";
    case "probe":
      return "Backend Probe";
    case "paths-validate":
      return "Paths Validate";
    default:
      return String(action);
  }
}

function buildOptionValues(values: Record<string, unknown>): Record<string, string[]> {
  const optionValues: Record<string, string[]> = {};

  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      const strings = value.map((entry) => String(entry)).filter(Boolean);
      if (strings.length > 0) {
        optionValues[key] = strings;
      }
      continue;
    }

    optionValues[key] = [String(value)];
  }

  return optionValues;
}

function buildPositionals(...values: Array<string | string[]>): string[] {
  const positionals: string[] = [];

  for (const value of values) {
    if (Array.isArray(value)) {
      positionals.push(...value.filter((entry) => entry.length > 0));
      continue;
    }

    if (value.length > 0) {
      positionals.push(value);
    }
  }

  return positionals;
}

async function doesArtifactExist(targetPath: string): Promise<boolean> {
  try {
    const details = await stat(targetPath);
    return details.isFile() && details.size > 0;
  } catch {
    return false;
  }
}

function extractArtifactPath(output: unknown): string | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const candidate = output as {
    output_path?: unknown;
    outputs?: Record<string, unknown>;
  };

  if (typeof candidate.output_path === "string" && candidate.output_path.length > 0) {
    return candidate.output_path;
  }

  if (candidate.outputs && typeof candidate.outputs === "object") {
    const preferredKeys = ["video", "image", "audio", "storyboard"];
    for (const key of preferredKeys) {
      const value = candidate.outputs[key];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }

    for (const value of Object.values(candidate.outputs)) {
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
  }

  return null;
}

function isImageLikePath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return extension === ".png" || extension === ".jpg" || extension === ".jpeg" || extension === ".webp";
}

function isNonFileAction(action: DashboardActionName): boolean {
  return action === "prompt-build"
    || action === "doctor"
    || action === "probe"
    || action === "paths-validate";
}

function humanizeFieldNames(fieldNames: string[]): string[] {
  return fieldNames.map((fieldName) => {
    switch (fieldName) {
      case "desc":
        return "description";
      case "primaryInput":
        return "primary input";
      case "sketchPath":
        return "sketch path";
      case "imagePath":
        return "image path";
      default:
        return fieldName;
    }
  });
}

function requireStringValue(
  value: unknown,
  fieldName: string,
  missingInputs: string[],
): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    missingInputs.push(fieldName);
  }
}

function hasStringValue(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function suggestRecoveryStep(
  action: DashboardActionName,
  resultKind: DashboardResultKind,
): string {
  if (resultKind === "file") {
    return "Check backend setup and rerun the action.";
  }

  if (action === "prompt-build") {
    return "Review the prompt request and try again.";
  }

  return "Review the dashboard result details and retry.";
}

function toBooleanValue(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => String(entry)).filter((entry) => entry.length > 0);
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
