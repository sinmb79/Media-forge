import { NextResponse } from "next/server";

import { runDashboardVideoSessionExtend } from "@/lib/mediaforge-generate";
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
  const desc = typeof payload.desc === "string" ? payload.desc.trim() : "";

  if (!sessionDir || !sourceId || !desc) {
    return NextResponse.json(
      {
        action: "video-session-extend",
        status: "blocked",
        reason: "Missing required inputs: sessionDir, sourceId, desc.",
        missing_backends: [],
        missing_inputs: [
          ...(sessionDir ? [] : ["sessionDir"]),
          ...(sourceId ? [] : ["sourceId"]),
          ...(desc ? [] : ["desc"]),
        ],
        next_steps: ["Choose a session, select a root clip, and describe the next motion beat."],
      },
      { status: 422 },
    );
  }

  const jobId = `video-session-extend-${Date.now()}`;
  runtime.jobQueue.createJob({
    id: jobId,
    input: payload,
    kind: "video-session-extend",
    label: "Video Session Extend",
  });
  runtime.jobQueue.updateMetadata(jobId, {
    details: "Queued iterative video extension job.",
    expected_artifact: true,
    phase: "execution",
    result_kind: "file",
    summary: "Queued",
  });

  queueMicrotask(() => {
    void executeExtendJob(jobId, payload);
  });

  return NextResponse.json(
    {
      action: "video-session-extend",
      job_id: jobId,
      label: "Video Session Extend",
      status: "queued",
    },
    { status: 202 },
  );

  async function executeExtendJob(createdJobId: string, input: Record<string, unknown>) {
    try {
      runtime.jobQueue.markRunning(createdJobId);
      runtime.jobQueue.updateMetadata(createdJobId, {
        details: "Extending the selected session chain through MediaForge.",
        expected_artifact: true,
        phase: "execution",
        result_kind: "file",
        summary: "Execution running",
      });
      runtime.jobQueue.updateProgress(createdJobId, 0.35);

      const result = await runDashboardVideoSessionExtend(input, runtime.rootDir);
      runtime.jobQueue.updateMetadata(createdJobId, {
        details: `Session chain extended and composed at ${result.composed_output_path}`,
        artifact_exists: true,
        artifact_path: result.composed_output_path,
        expected_artifact: true,
        next_step: "Review the latest composed chain in Preview Workspace.",
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
        next_step: "Check the selected session chain and retry the extension step.",
        phase: "execution",
        result_kind: "file",
        summary: "Execution failed",
      });
    }
  }
}
