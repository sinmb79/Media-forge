import { NextResponse } from "next/server";

import { loadOpenClawSnapshotForDashboard } from "@/lib/mediaforge-openclaw";

export async function GET() {
  return NextResponse.json(await loadOpenClawSnapshotForDashboard());
}
