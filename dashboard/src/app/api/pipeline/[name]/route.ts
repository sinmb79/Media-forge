import { executeDashboardAction } from "@/lib/mediaforge-api";

export async function POST(
  request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const payload = await request.json();
  const { name } = await context.params;
  return executeDashboardAction("pipeline-run", {
    ...payload,
    subcommand: name,
  });
}
