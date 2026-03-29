import type { IncomingMessage, ServerResponse } from "node:http";

import type { DashboardJobQueue } from "../services/dashboard-job-queue.js";

export function attachDashboardSse(
  request: IncomingMessage,
  response: ServerResponse,
  jobQueue: DashboardJobQueue,
): void {
  response.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
  });

  response.write("event: ready\n");
  response.write(`data: ${JSON.stringify({ ok: true })}\n\n`);
  response.write("event: snapshot\n");
  response.write(`data: ${JSON.stringify({ jobs: jobQueue.listJobs() })}\n\n`);

  const unsubscribe = jobQueue.subscribe((event) => {
    response.write("event: job\n");
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  request.on("close", () => {
    unsubscribe();
    response.end();
  });
}
