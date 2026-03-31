import { stat } from "node:fs/promises";

import { NextResponse } from "next/server";

import { runDashboardImageGeneration } from "@/lib/mediaforge-generate";
import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";

export async function POST(request: Request) {
  const runtime = getMediaForgeRuntime();
  const payload = await request.json() as Record<string, unknown>;
  const desc = String(payload.desc ?? "").trim();

  if (!desc) {
    return NextResponse.json(
      {
        action: "image-generate",
        status: "blocked",
        reason: "Missing required inputs: desc.",
        missing_backends: [],
        missing_inputs: ["desc"],
        next_steps: ["Describe the image scene and retry."],
      },
      { status: 422 },
    );
  }

  const jobId = `image-${Date.now()}`;
  const label = typeof payload.sketchPath === "string" && payload.sketchPath.trim().length > 0
    ? "Sketch To Image"
    : "Text To Image";

  runtime.jobQueue.createJob({
    id: jobId,
    kind: "image-generate",
    label,
    input: payload,
  });
  runtime.jobQueue.updateMetadata(jobId, {
    details: "Queued image generation job.",
    expected_artifact: true,
    phase: "execution",
    result_kind: "file",
    summary: "Queued",
  });

  queueMicrotask(() => {
    void generateImage(jobId, payload);
  });

  return NextResponse.json(
    {
      action: "image-generate",
      job_id: jobId,
      label,
      status: "queued",
    },
    { status: 202 },
  );

  async function generateImage(createdJobId: string, input: Record<string, unknown>) {
    try {
      runtime.jobQueue.markRunning(createdJobId);
      runtime.jobQueue.updateMetadata(createdJobId, {
        details: "Running local image generation through the MediaForge engine.",
        expected_artifact: true,
        phase: "execution",
        result_kind: "file",
        summary: "Execution running",
      });
      runtime.jobQueue.updateProgress(createdJobId, 0.35);

      const result = await runDashboardImageGeneration(input, runtime.rootDir);
      const artifactPath = "output_path" in result
        ? result.output_path
        : result.output_paths[0];

      if (!artifactPath) {
        throw new Error("Image generation completed without an output file.");
      }

      const artifactStat = await stat(artifactPath);
      if (artifactStat.size <= 0) {
        throw new Error("Image generation created an empty output file.");
      }

      runtime.jobQueue.updateMetadata(createdJobId, {
        details: `Verified artifact at ${artifactPath}`,
        artifact_exists: true,
        artifact_path: artifactPath,
        expected_artifact: true,
        next_step: "Review the generated image in Preview Workspace.",
        phase: "verification",
        result_kind: "file",
        summary: "Generated and verified",
      });
      runtime.jobQueue.updateProgress(createdJobId, 1);
      runtime.jobQueue.succeed(createdJobId, {
        output_path: artifactPath,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtime.jobQueue.fail(createdJobId, message, {
        details: message,
        expected_artifact: true,
        next_step: "Check your prompt or sketch path and retry.",
        phase: "execution",
        result_kind: "file",
        summary: "Execution failed",
      });
    }
  }
}
