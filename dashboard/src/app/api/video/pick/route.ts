import { NextResponse } from "next/server";

import { runDashboardVideoPick } from "@/lib/mediaforge-generate";
import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";

export async function POST(request: Request) {
  const runtime = getMediaForgeRuntime();
  const payload = await request.json() as Record<string, unknown>;
  const sessionDir = typeof payload.sessionDir === "string" ? payload.sessionDir.trim() : "";
  const selected = Array.isArray(payload.selected) ? payload.selected : [];

  if (!sessionDir || selected.length === 0) {
    return NextResponse.json(
      {
        action: "video-pick",
        status: "blocked",
        reason: "Missing required inputs: sessionDir and selected.",
        missing_backends: [],
        missing_inputs: [
          ...(sessionDir ? [] : ["sessionDir"]),
          ...(selected.length > 0 ? [] : ["selected"]),
        ],
        next_steps: ["Choose a seed session and at least one generated candidate."],
      },
      { status: 422 },
    );
  }

  const result = await runDashboardVideoPick(payload, runtime.rootDir);
  return NextResponse.json(result, { status: 200 });
}
