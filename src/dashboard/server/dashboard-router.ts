import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import * as path from "node:path";

import { attachDashboardSse } from "./dashboard-sse.js";
import type { DashboardActionName, DashboardActionService } from "../services/dashboard-action-service.js";
import type { DashboardHealthService } from "../services/dashboard-health-service.js";
import type { DashboardJobQueue } from "../services/dashboard-job-queue.js";
import type { DashboardOutputStore } from "../services/dashboard-output-store.js";

export interface DashboardRouterDependencies {
  rootDir: string;
  actionService: DashboardActionService;
  healthService: DashboardHealthService;
  jobQueue: DashboardJobQueue;
  outputStore: DashboardOutputStore;
}

export function createDashboardRouter(
  dependencies: DashboardRouterDependencies,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  const assetsRoot = path.resolve(dependencies.rootDir, "src", "dashboard", "web");
  const outputsRoot = dependencies.outputStore.getOutputsRoot();

  return async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = requestUrl.pathname;
    const method = request.method ?? "GET";

    try {
      if (method === "GET" && pathname === "/") {
        await serveFile(response, path.resolve(assetsRoot, "index.html"), "text/html; charset=utf-8");
        return;
      }

      if (method === "GET" && pathname === "/dashboard.css") {
        await serveFile(response, path.resolve(assetsRoot, "dashboard.css"), "text/css; charset=utf-8");
        return;
      }

      if (method === "GET" && pathname === "/dashboard.js") {
        await serveFile(response, path.resolve(assetsRoot, "dashboard.js"), "application/javascript; charset=utf-8");
        return;
      }

      if (method === "GET" && pathname === "/api/health") {
        sendJson(response, 200, await dependencies.healthService.getSnapshot());
        return;
      }

      if (method === "GET" && pathname === "/api/config") {
        sendJson(response, 200, {
          schema_version: "0.1",
          outputs_root: outputsRoot,
          workspace_root: dependencies.rootDir,
        });
        return;
      }

      if (method === "GET" && pathname === "/api/outputs") {
        sendJson(response, 200, {
          items: await dependencies.outputStore.listRecent(),
          schema_version: "0.1",
        });
        return;
      }

      if (method === "GET" && pathname === "/api/jobs") {
        sendJson(response, 200, {
          items: dependencies.jobQueue.listJobs(),
          schema_version: "0.1",
        });
        return;
      }

      if (method === "GET" && pathname === "/api/events") {
        attachDashboardSse(request, response, dependencies.jobQueue);
        return;
      }

      if (method === "POST" && pathname.startsWith("/api/actions/")) {
        const action = pathname.replace("/api/actions/", "") as DashboardActionName;
        const payload = await readJsonBody(request);
        const actionResult = await dependencies.actionService.enqueueAction(action, payload);

        if (actionResult.status === "blocked") {
          sendJson(response, 422, actionResult);
          return;
        }

        sendJson(response, 202, actionResult);
        return;
      }

      if (method === "GET" && pathname.startsWith("/outputs/")) {
        const relativePath = decodeURIComponent(pathname.replace("/outputs/", ""));
        const absolutePath = path.resolve(outputsRoot, relativePath);

        if (!absolutePath.startsWith(outputsRoot)) {
          sendJson(response, 403, { error: "Forbidden" });
          return;
        }

        await streamFile(response, absolutePath, getContentType(absolutePath));
        return;
      }

      sendJson(response, 404, { error: "Not Found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal error";
      sendJson(response, 500, { error: message });
    }
  };
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw.length === 0) {
    return {};
  }

  return JSON.parse(raw) as Record<string, unknown>;
}

async function serveFile(
  response: ServerResponse,
  filePath: string,
  contentType: string,
): Promise<void> {
  const file = await readFile(filePath);
  response.writeHead(200, { "Content-Type": contentType });
  response.end(file);
}

async function streamFile(
  response: ServerResponse,
  filePath: string,
  contentType: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);

    response.writeHead(200, { "Content-Type": contentType });
    stream.on("error", reject);
    response.on("close", resolve);
    stream.on("end", resolve);
    stream.pipe(response);
  });
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function getContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".json":
      return "application/json; charset=utf-8";
    case ".srt":
    case ".txt":
    case ".md":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
