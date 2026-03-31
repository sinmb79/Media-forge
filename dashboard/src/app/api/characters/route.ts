import { NextResponse } from "next/server";

import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";

const BRIDGE_URL = "http://127.0.0.1:4318/invoke";

export async function GET() {
  try {
    const response = await fetch(BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "character.list" }),
    });

    if (!response.ok) {
      return NextResponse.json({ items: [] });
    }

    const data = await response.json() as { output?: unknown[] };
    const raw = Array.isArray(data.output) ? data.output : [];
    const characters = raw.map((entry) => {
      const char = entry as Record<string, unknown>;
      return {
        id: char.id ?? char.name,
        name: char.name ?? "Unknown",
        description: char.description ?? "",
        type: char.type ?? "realistic",
        refImageCount: Array.isArray(char.reference_images) ? char.reference_images.length : 0,
      };
    });

    return NextResponse.json({ items: characters });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request: Request) {
  const runtime = getMediaForgeRuntime();
  const payload = await request.json() as Record<string, unknown>;
  const name = String(payload.name ?? "").trim();

  if (!name) {
    return NextResponse.json(
      {
        action: "character-create",
        status: "blocked",
        reason: "Missing required inputs: name.",
        missing_backends: [],
        missing_inputs: ["name"],
        next_steps: ["Provide a character name and retry."],
      },
      { status: 422 },
    );
  }

  const jobId = `character-${Date.now()}`;

  runtime.jobQueue.createJob({
    id: jobId,
    kind: "character-create",
    label: "캐릭터 생성",
    input: payload,
  });
  runtime.jobQueue.updateMetadata(jobId, {
    details: `Creating character "${name}".`,
    expected_artifact: false,
    phase: "execution",
    result_kind: "data",
    summary: "Queued",
  });

  queueMicrotask(() => {
    void createCharacter(jobId, payload);
  });

  return NextResponse.json(
    {
      action: "character-create",
      job_id: jobId,
      label: "캐릭터 생성",
      status: "queued",
    },
    { status: 202 },
  );

  async function createCharacter(createdJobId: string, input: Record<string, unknown>) {
    try {
      runtime.jobQueue.markRunning(createdJobId);
      runtime.jobQueue.updateProgress(createdJobId, 0.5);

      const response = await fetch(BRIDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "character.create",
          params: {
            name: input.name,
            description: input.description,
            type: input.type,
            refImagePath: input.refImagePath,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Bridge returned status ${response.status}`);
      }

      const result = await response.json();

      runtime.jobQueue.updateMetadata(createdJobId, {
        details: `Character "${input.name}" created successfully.`,
        phase: "verification",
        result_kind: "data",
        summary: "Created",
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

export async function DELETE(request: Request) {
  const payload = await request.json() as Record<string, unknown>;
  const id = String(payload.id ?? "").trim();

  if (!id) {
    return NextResponse.json({ error: "Missing character id." }, { status: 422 });
  }

  try {
    await fetch(BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "character.delete", params: { id } }),
    });

    return NextResponse.json({ status: "deleted", id });
  } catch {
    return NextResponse.json({ error: "Failed to delete character." }, { status: 500 });
  }
}
