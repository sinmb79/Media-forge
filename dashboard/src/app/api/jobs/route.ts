import { NextResponse } from "next/server";

import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";

export async function GET() {
  const runtime = getMediaForgeRuntime();
  return NextResponse.json({
    items: runtime.jobQueue.listJobs(),
    schema_version: "0.1",
  });
}
