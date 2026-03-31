import { stat } from "node:fs/promises";

import { NextResponse } from "next/server";

import { runDashboardVideoAutoExtend } from "@/lib/mediaforge-generate";
import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";

export async function POST(request: Request) {
  const runtime = getMediaForgeRuntime();
  const payload = await request.json() as Record<string, unknown>;
  const desc = String(payload.desc ?? "").trim();
  const fromImagePath = typeof payload.fromImagePath === "string" ? payload.fromImagePath.trim() : "";

  if (!desc && !fromImagePath) {
    return NextResponse.json(
      {
        action: "video-auto-extend",
        status: "blocked",
        reason: "Missing required inputs: desc or fromImagePath.",
        missing_backends: [],
        missing_inputs: ["desc"],
        next_steps: ["Add a scene description or starting image before running auto-extend."],
      },
      { status: 422 },
    );
  }

  const jobId = `video-auto-extend-${Date.now()}`;
  runtime.jobQueue.createJob({
    id: jobId,
    input: payload,
    kind: "video-auto-extend",
    label: "Video Auto Extend",
  });
  runtime.jobQueue.updateMetadata(jobId, {
    details: "Queued auto-extend pipeline.",
    expected_artifact: true,
    phase: "execution",
    result_kind: "file",
    summary: "Queued",
  });

  queueMicrotask(() => {
    void executeAutoExtendJob(jobId, payload);
  });

  return NextResponse.json(
    {
      action: "video-auto-extend",
      job_id: jobId,
      label: "Video Auto Extend",
      status: "queued",
    },
    { status: 202 },
  );

  async function executeAutoExtendJob(createdJobId: string, input: Record<string, unknown>) {
    try {
      runtime.jobQueue.markRunning(createdJobId);
      runtime.jobQueue.updateMetadata(createdJobId, {
        details: "Running seed generation, pick, extend, and compose in one local pipeline.",
        expected_artifact: true,
        phase: "execution",
        result_kind: "file",
        summary: "Execution running",
      });
      runtime.jobQueue.updateProgress(createdJobId, 0.35);

      const result = await runDashboardVideoAutoExtend(input, runtime.rootDir);
      const outputPath = result.compose?.output_path;
      if (!outputPath) {
        throw new Error("Auto-extend pipeline did not return a composed output path.");
      }
      const artifactStat = await stat(outputPath);
      if (artifactStat.size <= 0) {
        throw new Error("Auto-extend pipeline created an empty output file.");
      }

      runtime.jobQueue.updateMetadata(createdJobId, {
        details: `Verified artifact at ${outputPath}`,
        artifact_exists: true,
        artifact_path: outputPath,
        expected_artifact: true,
        next_step: "Review the composed clip in Preview Workspace or extend the session again.",
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
        next_step: "Check the seed inputs, model choice, and backend state before retrying.",
        phase: "execution",
        result_kind: "file",
        summary: "Execution failed",
      });
    }
  }
}
