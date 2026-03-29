import { inspectBackends } from "../../backends/registry.js";
import { forgeAudioCommand } from "../../cli/forge-audio-command.js";
import { forgeEditCommand } from "../../cli/forge-edit-command.js";
import { forgeImageCommand } from "../../cli/forge-image-command.js";
import { forgePipelineCommand } from "../../cli/forge-pipeline-command.js";
import { forgePromptCommand } from "../../cli/forge-prompt-command.js";
import { forgeVideoCommand } from "../../cli/forge-video-command.js";
import { buildForgeDoctorReport } from "../../forge/doctor/build-forge-doctor-report.js";
import { validateForgePaths } from "../../forge/doctor/validate-forge-paths.js";
import { createRequestId } from "../../shared/request-id.js";
import { DashboardJobQueue } from "./dashboard-job-queue.js";

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

export class DashboardActionService {
  constructor(
    private readonly jobQueue: DashboardJobQueue,
    private readonly rootDir: string = process.cwd(),
  ) {}

  enqueueAction(
    action: DashboardActionName,
    payload: Record<string, unknown>,
  ): DashboardActionAccepted {
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
    this.jobQueue.appendLog(jobId, `Queued ${label}`);

    queueMicrotask(() => {
      void this.execute(jobId, action, payload);
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
  ): Promise<void> {
    try {
      this.jobQueue.markRunning(jobId);
      this.jobQueue.appendLog(jobId, "Starting action");
      this.jobQueue.updateProgress(jobId, 0.2);

      const output = await this.runAction(action, payload);

      this.jobQueue.updateProgress(jobId, 0.95);
      this.jobQueue.appendLog(jobId, "Action completed");
      this.jobQueue.succeed(jobId, output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.jobQueue.appendLog(jobId, message, "error");
      this.jobQueue.fail(jobId, message);
    }
  }

  private async runAction(
    action: DashboardActionName,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    switch (action) {
      case "doctor":
        return buildForgeDoctorReport({ rootDir: this.rootDir });
      case "probe":
        return {
          schema_version: "0.1",
          backends: await inspectBackends(this.rootDir),
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
          }),
          simulate: toBooleanValue(payload.simulate),
        }));
      case "pipeline-run":
        return this.runCliAction(() => forgePipelineCommand(buildPositionals(
          toStringValue(payload.subcommand),
          toStringValue(payload.primaryInput),
        ), {
          json: true,
          optionValues: buildOptionValues({
            desc: payload.desc,
            storyboard: payload.storyboard,
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

function buildOptionValues(
  values: Record<string, unknown>,
): Record<string, string[]> {
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

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
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
