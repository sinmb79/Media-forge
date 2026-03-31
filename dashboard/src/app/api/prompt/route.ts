import { executeDashboardAction } from "@/lib/mediaforge-api";

export async function POST(request: Request) {
  const payload = await request.json();
  return executeDashboardAction("prompt-build", payload);
}
