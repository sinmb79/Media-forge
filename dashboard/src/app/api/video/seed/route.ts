import { NextResponse } from "next/server";

import { runDashboardVideoSeed } from "@/lib/mediaforge-generate";
import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";

export async function POST(request: Request) {
  const runtime = getMediaForgeRuntime();
  const payload = await request.json() as Record<string, unknown>;
  const desc = String(payload.desc ?? "").trim();
  const fromImagePath = typeof payload.fromImagePath === "string" ? payload.fromImagePath.trim() : "";
  const outputDir = typeof payload.outputDir === "string" ? payload.outputDir.trim() : "";

  if (!outputDir || (!desc && !fromImagePath)) {
    return NextResponse.json(
      {
        action: "video-seed",
        status: "blocked",
        reason: "Missing required inputs: outputDir and desc or fromImagePath.",
        missing_backends: [],
        missing_inputs: [
          ...(outputDir ? [] : ["outputDir"]),
          ...(!desc && !fromImagePath ? ["desc"] : []),
        ],
        next_steps: ["Set the session output folder and add either a scene description or an image."],
      },
      { status: 422 },
    );
  }

  const jobId = `video-seed-${Date.now()}`;
  runtime.jobQueue.createJob({
    id: jobId,
    input: payload,
    kind: "video-seed",
    label: "Video Seed Session",
  });
  runtime.jobQueue.updateMetadata(jobId, {
    details: "Queued seed generation session.",
    expected_artifact: false,
    phase: "execution",
    result_kind: "non_file",
    summary: "Queued",
  });

  queueMicrotask(() => {
    void executeSeedJob(jobId, payload);
  });

  return NextResponse.json(
    {
      action: "video-seed",
      job_id: jobId,
      label: "Video Seed Session",
      status: "queued",
    },
    { status: 202 },
  );

  async function executeSeedJob(createdJobId: string, input: Record<string, unknown>) {
    try {
      runtime.jobQueue.markRunning(createdJobId);
      runtime.jobQueue.updateMetadata(createdJobId, {
        details: "Generating local seed candidates through MediaForge.",
        expected_artifact: false,
        phase: "execution",
        result_kind: "non_file",
        summary: "Execution running",
      });
      runtime.jobQueue.updateProgress(createdJobId, 0.35);

      const result = await runDashboardVideoSeed(input, runtime.rootDir);
      runtime.jobQueue.updateMetadata(createdJobId, {
        details: `Seed session ready at ${result.session_dir}`,
        artifact_exists: true,
        artifact_path: result.manifest_path,
        expected_artifact: false,
        next_step: "Browse the session, pick a seed, then extend the chosen clip.",
        phase: "verification",
        result_kind: "non_file",
        summary: "Generated and verified",
      });
      runtime.jobQueue.updateProgress(createdJobId, 1);
      runtime.jobQueue.succeed(createdJobId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtime.jobQueue.fail(createdJobId, message, {
        details: message,
        expected_artifact: false,
        next_step: "Check the selected model, session folder, and backend setup before retrying.",
        phase: "execution",
        result_kind: "non_file",
        summary: "Execution failed",
      });
    }
  }
}
