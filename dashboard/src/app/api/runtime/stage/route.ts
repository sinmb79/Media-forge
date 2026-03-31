import { NextResponse } from "next/server";

import {
  loadRuntimeStageSnapshotForDashboard,
  stageLocalRuntimeForDashboard,
} from "@/lib/mediaforge-stage";

export async function GET() {
  return NextResponse.json(await loadRuntimeStageSnapshotForDashboard());
}

export async function POST() {
  return NextResponse.json(await stageLocalRuntimeForDashboard());
}
