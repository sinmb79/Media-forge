import { NextResponse } from "next/server";

import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";

const BRIDGE_URL = "http://127.0.0.1:4318/invoke";

export async function POST(request: Request) {
  const runtime = getMediaForgeRuntime();
  const payload = await request.json() as Record<string, unknown>;
  const scenarioPath = String(payload.scenarioPath ?? "").trim();

  if (!scenarioPath) {
    return NextResponse.json(
      {
        action: "webtoon-generate",
        status: "blocked",
        reason: "Missing required inputs: scenarioPath.",
        missing_backends: [],
        missing_inputs: ["scenarioPath"],
        next_steps: ["Provide the scenario path and retry."],
      },
      { status: 422 },
    );
  }

  const jobId = `webtoon-${Date.now()}`;

  runtime.jobQueue.createJob({
    id: jobId,
    kind: "webtoon-generate",
    label: "웹툰 생성",
    input: payload,
  });
  runtime.jobQueue.updateMetadata(jobId, {
    details: `Generating webtoon from ${scenarioPath}.`,
    expected_artifact: true,
    phase: "execution",
    result_kind: "file",
    summary: "Queued",
  });

  queueMicrotask(() => {
    void generateWebtoon(jobId, payload);
  });

  return NextResponse.json(
    {
      action: "webtoon-generate",
      job_id: jobId,
      label: "웹툰 생성",
      status: "queued",
    },
    { status: 202 },
  );

  async function generateWebtoon(createdJobId: string, input: Record<string, unknown>) {
    try {
      runtime.jobQueue.markRunning(createdJobId);
      runtime.jobQueue.updateProgress(createdJobId, 0.2);

      const response = await fetch(BRIDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "scenario.ingest",
          params: {
            scenarioPath: input.scenarioPath,
            formats: ["webtoon"],
            mode: input.mode,
            panelsPerPage: input.panelsPerPage,
            style: input.style,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Bridge returned status ${response.status}`);
      }

      const result = await response.json();

      runtime.jobQueue.updateMetadata(createdJobId, {
        details: `Webtoon generated from ${input.scenarioPath}.`,
        expected_artifact: true,
        phase: "verification",
        result_kind: "file",
        summary: "Generated",
      });
      runtime.jobQueue.updateProgress(createdJobId, 1);
      runtime.jobQueue.succeed(createdJobId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtime.jobQueue.fail(createdJobId, message, {
        details: message,
        expected_artifact: true,
        phase: "execution",
        result_kind: "file",
        summary: "Failed",
      });
    }
  }
}
