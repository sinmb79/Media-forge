import { NextResponse } from "next/server";

import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";

export async function GET() {
  const runtime = getMediaForgeRuntime();
  return NextResponse.json(await runtime.healthService.getSnapshot());
}
