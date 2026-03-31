import { stat } from "node:fs/promises";

import { NextResponse } from "next/server";

import { listVisualTemplates, runVisualRender } from "@/lib/mediaforge-visual";
import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";

export async function POST(request: Request) {
  const runtime = getMediaForgeRuntime();
  const payload = await request.json() as {
    concept?: string;
    duration?: number;
    fps?: number;
    palette?: string;
    preset?: string;
  };

  if (!payload.concept || payload.concept.trim().length === 0) {
    return NextResponse.json(
      {
        action: "visual-render",
        status: "blocked",
        reason: "Missing required inputs: concept.",
        missing_backends: [],
        missing_inputs: ["concept"],
        next_steps: ["Describe the visual concept and retry."],
      },
      { status: 422 },
    );
  }

  const availableTemplates = listVisualTemplates();
  const selectedTemplate = availableTemplates.find((template) => template.id === payload.preset)?.id
    ?? availableTemplates[0]?.id
    ?? "effects/snowfall";

  const jobId = `visual-${Date.now()}`;
  const label = `Visual Render: ${selectedTemplate}`;
  runtime.jobQueue.createJob({
    id: jobId,
    kind: "visual-render",
    label,
    input: payload,
  });
  runtime.jobQueue.updateMetadata(jobId, {
    details: "Queued visual render plan.",
    expected_artifact: true,
    phase: "execution",
    result_kind: "file",
    summary: "Queued",
  });

  queueMicrotask(() => {
    void generateVisualPlan(jobId, payload);
  });

  return NextResponse.json(
    {
      action: "visual-render",
      job_id: jobId,
      label,
      status: "queued",
    },
    { status: 202 },
  );

  async function generateVisualPlan(
    createdJobId: string,
    input: {
      concept?: string;
      duration?: number;
      fps?: number;
      palette?: string;
      preset?: string;
    },
  ) {
    try {
      runtime.jobQueue.markRunning(createdJobId);
      runtime.jobQueue.updateMetadata(createdJobId, {
        details: "Building local visual render plan artifact.",
        expected_artifact: true,
        phase: "execution",
        result_kind: "file",
        summary: "Execution running",
      });
      runtime.jobQueue.updateProgress(createdJobId, 0.35);
      const result = await runVisualRender({
        durationSec: Math.max(3, Math.min(30, input.duration ?? 15)),
        fps: Math.max(12, Math.min(60, input.fps ?? 30)),
        params: {
          concept: input.concept?.trim() ?? "",
          palette: input.palette ?? "emerald",
        },
        rootDir: runtime.rootDir,
        simulate: false,
        template: selectedTemplate,
      });
      const artifactStat = await stat(result.output_path);
      if (artifactStat.size <= 0) {
        throw new Error("Visual render completed without a usable output file.");
      }

      runtime.jobQueue.updateMetadata(createdJobId, {
        details: `Verified artifact at ${result.output_path}`,
        artifact_exists: true,
        artifact_path: result.output_path,
        expected_artifact: true,
        next_step: "Review the render plan in Preview Workspace.",
        phase: "verification",
        result_kind: "file",
        summary: "Generated and verified",
      });
      runtime.jobQueue.updateProgress(createdJobId, 1);
      runtime.jobQueue.succeed(createdJobId, {
        concept: input.concept?.trim(),
        output_path: result.output_path,
        preset: selectedTemplate,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtime.jobQueue.fail(createdJobId, message, {
        details: message,
        expected_artifact: true,
        next_step: "Inspect the visual render settings and retry.",
        phase: "execution",
        result_kind: "file",
        summary: "Execution failed",
      });
    }
  }
}
