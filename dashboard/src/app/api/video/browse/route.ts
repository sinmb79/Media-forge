import { NextResponse } from "next/server";

import { runDashboardVideoBrowse } from "@/lib/mediaforge-generate";
import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";

export async function POST(request: Request) {
  const runtime = getMediaForgeRuntime();
  const payload = await request.json() as Record<string, unknown>;
  const result = await runDashboardVideoBrowse(payload, runtime.rootDir);
  return NextResponse.json(result, { status: 200 });
}
