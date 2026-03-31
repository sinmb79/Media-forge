import { NextResponse } from "next/server";

import {
  ensureBackendReady,
} from "../../../../../../../dist/src/backends/supervisor.js";
import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";

type SupportedBackendName =
  | "comfyui"
  | "ffmpeg"
  | "ollama"
  | "propainter"
  | "python";

const SUPPORTED_BACKENDS = new Set<SupportedBackendName>([
  "comfyui",
  "ffmpeg",
  "ollama",
  "propainter",
  "python",
]);

export async function POST(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const runtime = getMediaForgeRuntime();
  const { name } = await context.params;

  if (!SUPPORTED_BACKENDS.has(name as SupportedBackendName)) {
    return NextResponse.json(
      {
        reason: `Unsupported backend: ${name}.`,
        status: "missing",
      },
      { status: 422 },
    );
  }

  const result = await ensureBackendReady(name as SupportedBackendName, {
    rootDir: runtime.rootDir,
  });

  return NextResponse.json(result, {
    status: result.ready ? 200 : 424,
  });
}
