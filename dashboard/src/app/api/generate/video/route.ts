import { stat } from "node:fs/promises";

import { NextResponse } from "next/server";

import { runDashboardVideoGeneration } from "@/lib/mediaforge-generate";
import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";

export async function POST(request: Request) {
  const runtime = getMediaForgeRuntime();
  const payload = await request.json() as Record<string, unknown>;
  const desc = String(payload.desc ?? "").trim();
  const mode = payload.mode === "text"
    || payload.mode === "ref2v"
    || payload.mode === "talking"
    || payload.mode === "extend"
    ? payload.mode
    : "image";
  const imagePath = typeof payload.imagePath === "string" ? payload.imagePath.trim() : "";
  const portraitPath = typeof payload.portraitPath === "string" ? payload.portraitPath.trim() : "";
  const audioPath = typeof payload.audioPath === "string" ? payload.audioPath.trim() : "";
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const sourceVideoPath = typeof payload.sourceVideoPath === "string" ? payload.sourceVideoPath.trim() : "";
  const referencePaths = Array.isArray(payload.referencePaths)
    ? payload.referencePaths.map((value) => String(value ?? "").trim()).filter((value) => value.length > 0)
    : [];

  if (!desc) {
    return NextResponse.json(
      {
        action: "video-generate",
        status: "blocked",
        reason: "Missing required inputs: desc.",
        missing_backends: [],
        missing_inputs: ["desc"],
        next_steps: ["Describe the video scene and retry."],
      },
      { status: 422 },
    );
  }

  if (mode === "image" && imagePath.length === 0) {
    return NextResponse.json(
      {
        action: "video-generate",
        status: "blocked",
        reason: "Missing required inputs: imagePath.",
        missing_backends: [],
        missing_inputs: ["imagePath"],
        next_steps: ["Upload or select an input image before starting image-to-video."],
      },
      { status: 422 },
    );
  }

  if (mode === "ref2v" && referencePaths.length === 0) {
    return NextResponse.json(
      {
        action: "video-generate",
        status: "blocked",
        reason: "Missing required inputs: referencePaths.",
        missing_backends: [],
        missing_inputs: ["referencePaths"],
        next_steps: ["Add one or more character reference images before starting SkyReels Ref2V."],
      },
      { status: 422 },
    );
  }

  if (mode === "talking" && (portraitPath.length === 0 || (audioPath.length === 0 && text.length === 0))) {
    return NextResponse.json(
      {
        action: "video-generate",
        status: "blocked",
        reason: "Missing required inputs: portraitPath, audioPath or text.",
        missing_backends: [],
        missing_inputs: [
          ...(portraitPath.length === 0 ? ["portraitPath"] : []),
          ...(audioPath.length === 0 && text.length === 0 ? ["audioPath"] : []),
        ],
        next_steps: ["Add a portrait image and either dialogue audio or narration text before starting SkyReels Talking Avatar."],
      },
      { status: 422 },
    );
  }

  if (mode === "extend" && sourceVideoPath.length === 0) {
    return NextResponse.json(
      {
        action: "video-generate",
        status: "blocked",
        reason: "Missing required inputs: sourceVideoPath.",
        missing_backends: [],
        missing_inputs: ["sourceVideoPath"],
        next_steps: ["Choose the source clip you want SkyReels V2V to extend."],
      },
      { status: 422 },
    );
  }

  const jobId = `video-${Date.now()}`;
  const label = mode === "text"
    ? "Text To Video"
    : mode === "ref2v"
      ? "SkyReels Ref2V"
      : mode === "talking"
        ? "SkyReels Talking Avatar"
        : mode === "extend"
          ? "SkyReels Extension"
          : "Image To Video";

  runtime.jobQueue.createJob({
    id: jobId,
    kind: "video-generate",
    label,
    input: payload,
  });
  runtime.jobQueue.updateMetadata(jobId, {
    details: "Queued video generation job.",
    expected_artifact: true,
    phase: "execution",
    result_kind: "file",
    summary: "Queued",
  });

  queueMicrotask(() => {
    void generateVideo(jobId, payload);
  });

  return NextResponse.json(
    {
      action: "video-generate",
      job_id: jobId,
      label,
      status: "queued",
    },
    { status: 202 },
  );

  async function generateVideo(createdJobId: string, input: Record<string, unknown>) {
    try {
      runtime.jobQueue.markRunning(createdJobId);
      runtime.jobQueue.updateMetadata(createdJobId, {
        details: "Running local video generation through the MediaForge engine.",
        expected_artifact: true,
        phase: "execution",
        result_kind: "file",
        summary: "Execution running",
      });
      runtime.jobQueue.updateProgress(createdJobId, 0.35);

      const result = await runDashboardVideoGeneration(input, runtime.rootDir);
      const artifactStat = await stat(result.output_path);
      if (artifactStat.size <= 0) {
        throw new Error("Video generation created an empty output file.");
      }

      runtime.jobQueue.updateMetadata(createdJobId, {
        details: `Verified artifact at ${result.output_path}`,
        artifact_exists: true,
        artifact_path: result.output_path,
        expected_artifact: true,
        next_step: "Review the generated video in Preview Workspace.",
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
        next_step: "Adjust the source mode or generation settings and retry.",
        phase: "execution",
        result_kind: "file",
        summary: "Execution failed",
      });
    }
  }
}
