import { stat } from "node:fs/promises";

import { NextResponse } from "next/server";

import {
  type DashboardAudioTool,
  getDashboardAudioMissingInputs,
  getDashboardAudioRequiredBackends,
  isDashboardAudioTool,
  normalizeDashboardAudioRequest,
  runDashboardAudioTool,
} from "@/lib/mediaforge-audio";
import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";
import type { MediaForgeBackendStatus } from "@/lib/mediaforge-types";

export async function POST(request: Request, context: { params: Promise<{ tool: string }> }) {
  const runtime = getMediaForgeRuntime();
  const payload = await request.json() as Record<string, unknown>;
  const { tool } = await context.params;

  if (!isDashboardAudioTool(tool)) {
    return NextResponse.json(
      {
        action: "audio-run",
        status: "blocked",
        reason: `Unsupported audio tool: ${tool}.`,
        missing_backends: [],
        missing_inputs: [],
        next_steps: ["Choose a supported audio tool and retry."],
      },
      { status: 422 },
    );
  }

  const normalizedRequest = {
    ...normalizeDashboardAudioRequest(tool, payload),
    subcommand: tool,
  };
  const missingInputs = getDashboardAudioMissingInputs(normalizedRequest);

  const backendStatuses = await runtime.healthService.getSnapshot();
  const availableBackends = new Set(
    backendStatuses.doctor.backends
      .filter((backend: MediaForgeBackendStatus) => backend.available)
      .map((backend: MediaForgeBackendStatus) => backend.name),
  );
  const missingBackends = getDashboardAudioRequiredBackends(tool)
    .filter((backend) => !availableBackends.has(backend));

  if (missingInputs.length > 0 || missingBackends.length > 0) {
    return NextResponse.json(
      {
        action: "audio-run",
        status: "blocked",
        reason: buildBlockedReason(missingInputs, missingBackends),
        missing_backends: missingBackends,
        missing_inputs: missingInputs,
        next_steps: buildNextSteps(missingInputs, missingBackends),
      },
      { status: 422 },
    );
  }

  const jobId = `audio-${Date.now()}`;
  const label = `Audio: ${tool}`;

  runtime.jobQueue.createJob({
    id: jobId,
    kind: "audio-run",
    label,
    input: normalizedRequest,
  });
  runtime.jobQueue.updateMetadata(jobId, {
    details: "Queued audio action.",
    expected_artifact: true,
    phase: "execution",
    result_kind: "file",
    summary: "Queued",
  });

  queueMicrotask(() => {
    void executeAudio(jobId, tool, normalizedRequest);
  });

  return NextResponse.json(
    {
      action: "audio-run",
      job_id: jobId,
      label,
      status: "queued",
    },
    { status: 202 },
  );

  async function executeAudio(
    createdJobId: string,
    audioTool: DashboardAudioTool,
    input: Record<string, unknown>,
  ) {
    try {
      runtime.jobQueue.markRunning(createdJobId);
      runtime.jobQueue.updateMetadata(createdJobId, {
        details: "Running local audio action through the MediaForge engine.",
        expected_artifact: true,
        phase: "execution",
        result_kind: "file",
        summary: "Execution running",
      });
      runtime.jobQueue.updateProgress(createdJobId, 0.35);

      const result = await runDashboardAudioTool(audioTool, input, runtime.rootDir);
      const artifactStat = await stat(result.output_path);
      if (artifactStat.size <= 0) {
        throw new Error("Audio action created an empty output file.");
      }

      runtime.jobQueue.updateMetadata(createdJobId, {
        details: `Verified artifact at ${result.output_path}`,
        artifact_exists: true,
        artifact_path: result.output_path,
        expected_artifact: true,
        next_step: "Review the rendered file in Preview Workspace.",
        phase: "verification",
        result_kind: "file",
        summary: "Generated and verified",
      });
      runtime.jobQueue.updateProgress(createdJobId, 1);
      runtime.jobQueue.succeed(createdJobId, {
        output_path: result.output_path,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtime.jobQueue.fail(createdJobId, message, {
        details: message,
        expected_artifact: true,
        next_step: "Check the selected audio input or backend setup and retry.",
        phase: "execution",
        result_kind: "file",
        summary: "Execution failed",
      });
    }
  }
}

function buildBlockedReason(missingInputs: string[], missingBackends: string[]): string {
  if (missingInputs.length > 0 && missingBackends.length > 0) {
    return `Missing required inputs (${missingInputs.join(", ")}) and required backends (${missingBackends.join(", ")}).`;
  }

  if (missingInputs.length > 0) {
    return `Missing required inputs: ${missingInputs.join(", ")}.`;
  }

  return `Missing required backends: ${missingBackends.join(", ")}.`;
}

function buildNextSteps(missingInputs: string[], missingBackends: string[]): string[] {
  const nextSteps: string[] = [];

  if (missingInputs.length > 0) {
    nextSteps.push(`Fill in: ${missingInputs.join(", ")}`);
  }

  for (const backend of missingBackends) {
    nextSteps.push(`Install or start ${backend} and retry.`);
  }

  return nextSteps;
}
