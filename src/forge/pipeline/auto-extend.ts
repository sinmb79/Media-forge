import { stat } from "node:fs/promises";
import * as path from "node:path";

import { createRequestId } from "../../shared/request-id.js";
import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { composeSeedSession } from "../video/compose.js";
import type { ForgeVideoModel, ForgeVideoQuality } from "../video/build-video-generation-plan.js";
import { runVideoSeedSession } from "../video/seed.js";
import { SeedSessionManager, type SeedCandidate } from "../video/seed-session.js";
import { runSessionVideoExtend } from "../video/extend.js";

export interface AutoExtendPipelineOptions {
  autoPick?: "best" | "first" | "manual" | "random";
  candidates: number;
  desc_ko: string;
  extend_duration_sec: number;
  extend_loops: number;
  fromImagePath?: string;
  model: ForgeVideoModel;
  outputDir?: string;
  outputPath?: string;
  quality: ForgeVideoQuality;
  referencePaths?: string[];
  rootDir?: string;
  seed_duration_sec: number;
  simulate?: boolean;
  withAudio?: boolean;
}

export async function runAutoExtendPipeline(
  input: AutoExtendPipelineOptions,
  dependencies: {
    scoreCandidate?: (candidate: SeedCandidate, manager: SeedSessionManager) => Promise<number>;
  } = {},
) {
  const rootDir = path.resolve(input.rootDir ?? process.cwd());
  const storageRoot = resolveMediaForgeRoot(rootDir);
  const sessionOutputDir = input.outputDir
    ?? path.join(
      "workspace",
      "seeds",
      createRequestId({
        desc_ko: input.desc_ko,
        fromImagePath: input.fromImagePath ?? null,
        type: "auto-extend",
      }),
    );
  const seed = await runVideoSeedSession({
    candidates: input.candidates,
    desc_ko: input.desc_ko,
    duration_sec: input.seed_duration_sec,
    ...(input.fromImagePath ? { fromImagePath: input.fromImagePath } : {}),
    model: input.model,
    outputDir: sessionOutputDir,
    quality: input.quality,
    ...(input.referencePaths && input.referencePaths.length > 0 ? { referencePaths: input.referencePaths } : {}),
    rootDir,
    ...(input.simulate !== undefined ? { simulate: input.simulate } : {}),
  });
  const manager = await SeedSessionManager.load(seed.session_dir);
  const pick = await resolveAutoPick(manager, input.autoPick ?? "first", dependencies.scoreCandidate);
  const selectedId = pick.selected[0];

  if (!selectedId) {
    throw new Error("No generated seed candidate is available for auto-extend.");
  }

  await manager.pick([selectedId]);

  if ((input.autoPick ?? "first") === "manual") {
    return {
      compose: null,
      extend: null,
      pick: { ...pick, status: "waiting_for_manual_pick" as const },
      seed,
      session_dir: manager.sessionDir,
      status: "waiting_for_manual_pick" as const,
    };
  }

  const extend = input.extend_loops > 0
    ? await runSessionVideoExtend({
      desc_ko: input.desc_ko,
      duration_sec: input.extend_duration_sec,
      loops: input.extend_loops,
      quality: input.quality,
      rootDir,
      sessionDir: manager.sessionDir,
      sourceId: selectedId,
      ...(input.simulate !== undefined ? { simulate: input.simulate } : {}),
    })
    : null;

  const compose = await composeSeedSession({
    ...(input.outputPath ? { outputPath: path.resolve(storageRoot, input.outputPath) } : {}),
    rootDir,
    sessionDir: manager.sessionDir,
    sourceId: extend?.extension_id ?? selectedId,
    ...(input.withAudio ? { withAudio: true } : {}),
    ...(input.simulate !== undefined ? { simulate: input.simulate } : {}),
  });

  return {
    compose,
    extend,
    pick: { ...pick, status: "updated" as const },
    seed,
    session_dir: manager.sessionDir,
    status: input.simulate ? "simulated" as const : "completed" as const,
  };
}

async function resolveAutoPick(
  manager: SeedSessionManager,
  mode: "best" | "first" | "manual" | "random",
  scoreCandidate?: (candidate: SeedCandidate, manager: SeedSessionManager) => Promise<number>,
): Promise<{
  mode: "best" | "first" | "manual" | "random";
  score?: number;
  selected: string[];
}> {
  const generated = manager.manifest.candidates.filter((candidate) => candidate.status === "generated");
  const pool = generated.length > 0 ? generated : manager.manifest.candidates;
  if (pool.length === 0) {
    return { mode, selected: [] };
  }

  if (mode === "random") {
    return {
      mode,
      selected: [pool[Math.floor(Math.random() * pool.length)]?.id ?? pool[0]!.id],
    };
  }

  if (mode === "best") {
    const scores = await Promise.all(pool.map(async (candidate) => ({
      candidate,
      score: scoreCandidate
        ? await scoreCandidate(candidate, manager)
        : await scoreSeedCandidate(candidate, manager),
    })));
    scores.sort((left, right) => right.score - left.score || left.candidate.id.localeCompare(right.candidate.id));
    const bestScore = scores[0]?.score;
    return {
      mode,
      selected: scores[0] ? [scores[0].candidate.id] : [],
      ...(bestScore !== undefined ? { score: bestScore } : {}),
    };
  }

  return {
    mode,
    selected: [pool[0]!.id],
  };
}

async function scoreSeedCandidate(
  candidate: SeedCandidate,
  manager: SeedSessionManager,
): Promise<number> {
  if (!candidate.file) {
    return 0;
  }

  const filePath = path.isAbsolute(candidate.file)
    ? candidate.file
    : path.resolve(manager.sessionDir, candidate.file);
  const thumbnailPath = candidate.thumbnail
    ? (path.isAbsolute(candidate.thumbnail)
      ? candidate.thumbnail
      : path.resolve(manager.sessionDir, candidate.thumbnail))
    : null;

  const fileScore = await stat(filePath)
    .then((result) => result.size / 1_000_000)
    .catch(() => 0);
  const thumbnailBonus = thumbnailPath
    ? await stat(thumbnailPath).then(() => 0.25).catch(() => 0)
    : 0;

  return fileScore + thumbnailBonus;
}
