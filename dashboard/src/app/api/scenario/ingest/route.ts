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
        action: "scenario-ingest",
        status: "blocked",
        reason: "Missing required inputs: scenarioPath.",
        missing_backends: [],
        missing_inputs: ["scenarioPath"],
        next_steps: ["Provide the scenario JSON file path and retry."],
      },
      { status: 422 },
    );
  }

  const jobId = `scenario-${Date.now()}`;

  runtime.jobQueue.createJob({
    id: jobId,
    kind: "scenario-ingest",
    label: "시나리오 수집",
    input: payload,
  });
  runtime.jobQueue.updateMetadata(jobId, {
    details: `Ingesting scenario from ${scenarioPath}.`,
    expected_artifact: false,
    phase: "execution",
    result_kind: "data",
    summary: "Queued",
  });

  queueMicrotask(() => {
    void ingestScenario(jobId, payload);
  });

  return NextResponse.json(
    {
      action: "scenario-ingest",
      job_id: jobId,
      label: "시나리오 수집",
      status: "queued",
    },
    { status: 202 },
  );

  async function ingestScenario(createdJobId: string, input: Record<string, unknown>) {
    try {
      runtime.jobQueue.markRunning(createdJobId);
      runtime.jobQueue.updateProgress(createdJobId, 0.3);

      const response = await fetch(BRIDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "scenario.ingest",
          params: {
            scenarioPath: input.scenarioPath,
            formats: input.formats,
            simulate: input.simulate,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Bridge returned status ${response.status}`);
      }

      const result = await response.json();

      runtime.jobQueue.updateMetadata(createdJobId, {
        details: `Scenario ingested from ${input.scenarioPath}.`,
        phase: "verification",
        result_kind: "data",
        summary: "Ingested",
      });
      runtime.jobQueue.updateProgress(createdJobId, 1);
      runtime.jobQueue.succeed(createdJobId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtime.jobQueue.fail(createdJobId, message, {
        details: message,
        phase: "execution",
        result_kind: "data",
        summary: "Failed",
      });
    }
  }
}
