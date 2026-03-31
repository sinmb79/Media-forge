import { NextResponse } from "next/server";

import { loadSetupSnapshotForDashboard } from "@/lib/mediaforge-setup";

export async function GET() {
  return NextResponse.json(await loadSetupSnapshotForDashboard());
}
