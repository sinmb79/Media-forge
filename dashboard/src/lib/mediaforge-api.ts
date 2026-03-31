import { NextResponse } from "next/server";

import type { DashboardActionName } from "./mediaforge-types";
import { getMediaForgeRuntime } from "./mediaforge-runtime";

export async function executeDashboardAction(
  action: DashboardActionName,
  payload: Record<string, unknown>,
) {
  const runtime = getMediaForgeRuntime();
  const result = await runtime.actionService.enqueueAction(action, payload);

  return NextResponse.json(
    result,
    {
      status: result.status === "blocked" ? 422 : 202,
    },
  );
}
