import { readdir } from "node:fs/promises";
import * as path from "node:path";

import { ComfyUIBackend } from "../../backends/comfyui.js";
import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { loadWorkflowTemplate } from "../workflows/load-workflow-template.js";

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".webm"]);

export interface JoinClipsResult {
  clip_paths: string[];
  output_path: string;
  request_id: string;
  status: "completed" | "simulated";
  transition: string;
  workflow_id: string;
}

export async function runJoinClips(
  input: {
    clipsDir: string;
    outputDir?: string;
    rootDir?: string;
    simulate?: boolean;
    transition?: string;
  },
  dependencies: {
    comfyClient?: ComfyUIBackend;
  } = {},
): Promise<JoinClipsResult> {
  const clipPaths = await resolveClipPaths(input.clipsDir);
  if (clipPaths.length === 0) {
    throw new Error(`No video clips found in ${input.clipsDir}`);
  }

  const transition = input.transition ?? "ai";
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const requestId = createRequestId({ clipPaths, transition });
  const outputPath = path.resolve(rootDir, input.outputDir ?? "outputs", `${requestId}-join.mp4`);
  const workflowId = "wan_vace_join";

  if (input.simulate) {
    return {
      clip_paths: clipPaths,
      output_path: outputPath,
      request_id: requestId,
      status: "simulated",
      transition,
      workflow_id: workflowId,
    };
  }

  const workflow = await loadWorkflowTemplate(
    workflowId,
    {
      clips_json: JSON.stringify(clipPaths),
      output_path: outputPath,
      transition,
    },
    rootDir,
  );
  const comfyClient = dependencies.comfyClient ?? new ComfyUIBackend({ autoStart: true, rootDir });
  const queued = await comfyClient.queueWorkflow(workflow);
  const status = await comfyClient.waitForCompletion(queued.prompt_id);
  const firstOutput = status.outputs[0];

  if (!firstOutput) {
    throw new Error("ComfyUI join workflow finished without video outputs.");
  }

  await comfyClient.saveDownloadedOutput(firstOutput, outputPath);

  return {
    clip_paths: clipPaths,
    output_path: outputPath,
    request_id: requestId,
    status: "completed",
    transition,
    workflow_id: workflowId,
  };
}

async function resolveClipPaths(clipsDir: string): Promise<string[]> {
  const entries = await readdir(clipsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.resolve(clipsDir, entry.name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
}
