import { executeDashboardAction } from "@/lib/mediaforge-api";
import type { DashboardActionName } from "@/lib/mediaforge-types";

const dashboardActions = new Set<DashboardActionName>([
  "doctor",
  "probe",
  "paths-validate",
  "prompt-build",
  "image-sketch",
  "video-from-image",
  "video-from-text",
  "edit-run",
  "audio-run",
  "pipeline-run",
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  const payload = await request.json();
  const { action } = await context.params;

  if (!dashboardActions.has(action as DashboardActionName)) {
    return Response.json(
      {
        action,
        status: "blocked",
        reason: `Unsupported dashboard action: ${action}`,
        missing_backends: [],
        missing_inputs: [],
        next_steps: ["Choose a supported dashboard action and retry."],
      },
      { status: 422 },
    );
  }

  return executeDashboardAction(action as DashboardActionName, payload);
}
