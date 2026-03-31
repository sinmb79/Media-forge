import { NextResponse } from "next/server";

import { listAssetCards } from "@/lib/asset-library";

export async function GET() {
  return NextResponse.json({
    items: await listAssetCards(),
    schema_version: "0.1",
  });
}
