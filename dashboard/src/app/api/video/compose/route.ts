import { stat } from "node:fs/promises";

import { NextResponse } from "next/server";

import { runDashboardVideoCompose } from "@/lib/mediaforge-generate";
import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";

export async function POST(request: Request) {
  const runtime = getMediaForgeRuntime();
  const payload = await request.json() as Record<string, unknown>;
  const sessionDir = typeof payload.sessionDir === "string" ? payload.sessionDir.trim() : "";
  const sourceId = typeof payload.sourceId === "string"
    ? payload.sourceId.trim()
    : typeof payload.source === "string"
      ? payload.source.trim()
      : "";

  if (!sessionDir || !sourceId) {
    return NextResponse.json(
      {
        action: "video-compose",
        status: "blocked",
        reason: "Missing required inputs: sessionDir and sourceId.",
        missing_backends: [],
        missing_inputs: [
          ...(sessionDir ? [] : ["sessionDir"]),
          ...(sourceId ? [] : ["sourceId"]),
        ],
        next_steps: ["Choose a seed session and the chain root you want to compose."],
      },
      { status: 422 },
    );
  }

  const jobId = `video-compose-${Date.now()}`;
  runtime.jobQueue.createJob({
    id: jobId,
    input: payload,
    kind: "video-compose",
    label: "Video Session Compose",
  });
  runtime.jobQueue.updateMetadata(jobId, {
    details: "Queued session compose job.",
    expected_artifact: true,
    phase: "execution",
    result_kind: "file",
    summary: "Queued",
  });

  queueMicrotask(() => {
    void executeComposeJob(jobId, payload);
  });

  return NextResponse.json(
    {
      action: "video-compose",
      job_id: jobId,
      label: "Video Session Compose",
      status: "queued",
    },
    { status: 202 },
  );

  async function executeComposeJob(createdJobId: string, input: Record<string, unknown>) {
    try {
      runtime.jobQueue.markRunning(createdJobId);
      runtime.jobQueue.updateMetadata(createdJobId, {
        details: "Composing the selected extension chain into a single video.",
        expected_artifact: true,
        phase: "execution",
        result_kind: "file",
        summary: "Execution running",
      });
      runtime.jobQueue.updateProgress(createdJobId, 0.35);

      const result = await runDashboardVideoCompose(input, runtime.rootDir);
      const artifactStat = await stat(result.output_path);
      if (artifactStat.size <= 0) {
        throw new Error("Session compose created an empty output file.");
      }

      runtime.jobQueue.updateMetadata(createdJobId, {
        details: `Verified artifact at ${result.output_path}`,
        artifact_exists: true,
        artifact_path: result.output_path,
        expected_artifact: true,
        next_step: "Review the composed clip in Preview Workspace.",
        phase: "verification",
        result_kind: "file",
        summary: "Generated and verified",
      });
      runtime.jobQueue.updateProgress(createdJobId, 1);
      runtime.jobQueue.succeed(createdJobId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtime.jobQueue.fail(createdJobId, message, {
        details: message,
        expected_artifact: true,
        next_step: "Check the extension chain and retry the compose step.",
        phase: "execution",
        result_kind: "file",
        summary: "Execution failed",
      });
    }
  }
}
