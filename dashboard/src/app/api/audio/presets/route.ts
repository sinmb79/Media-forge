import { NextResponse } from "next/server";

import {
  listDashboardVoicePresets,
  saveDashboardVoicePreset,
} from "@/lib/voice-preset-library";

export async function GET() {
  return NextResponse.json({
    items: await listDashboardVoicePresets(),
    schema_version: "0.1",
  });
}

export async function POST(request: Request) {
  const payload = await request.json() as Record<string, unknown>;
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const speed = typeof payload.speed === "number"
    ? payload.speed
    : typeof payload.speed === "string"
      ? Number(payload.speed)
      : undefined;

  if (name.length === 0) {
    return NextResponse.json(
      {
        error: "name is required",
      },
      { status: 422 },
    );
  }

  const preset = await saveDashboardVoicePreset({
    ...(typeof payload.emotion === "string" ? { emotion: payload.emotion.trim() } : {}),
    ...(typeof payload.loraPath === "string" ? { loraPath: payload.loraPath.trim() } : {}),
    name,
    ...(typeof payload.notes === "string" ? { notes: payload.notes.trim() } : {}),
    ...(typeof payload.refSample === "string" ? { refSample: payload.refSample.trim() } : {}),
    ...(typeof speed === "number" && !Number.isNaN(speed) ? { speed } : {}),
    ...(typeof payload.voice === "string" ? { voice: payload.voice.trim() } : {}),
  });

  return NextResponse.json(preset, { status: 201 });
}
