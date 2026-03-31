import * as assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import {
  SeedSessionManager,
  browseSeedSessions,
} from "../../src/forge/video/seed-session.js";

test("SeedSessionManager.create writes a manifest with pending candidates", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mediaforge-seed-session-"));
  const sessionDir = path.join(tempRoot, "workspace", "seeds", "ep23-noggin");

  const manager = await SeedSessionManager.create({
    candidateCount: 3,
    duration: 10,
    model: "skyreels-ref2v",
    outputDir: sessionDir,
    prompt: "갈색 바위 괴물 너긴이 자기 머리를 두드린다",
    refs: ["characters/noggin-front.png", "characters/noggin-side.png"],
  });

  const raw = await readFile(path.join(sessionDir, "manifest.json"), "utf8");
  const manifest = JSON.parse(raw) as {
    candidates: Array<{ id: string; selected: boolean; status: string }>;
    model: string;
    refs?: string[];
  };

  assert.equal(manager.sessionDir, sessionDir);
  assert.equal(manifest.model, "skyreels-ref2v");
  assert.deepEqual(manifest.refs, ["characters/noggin-front.png", "characters/noggin-side.png"]);
  assert.deepEqual(
    manifest.candidates.map((candidate) => candidate.id),
    ["seed-001", "seed-002", "seed-003"],
  );
  assert.deepEqual(
    manifest.candidates.map((candidate) => candidate.status),
    ["pending", "pending", "pending"],
  );
  assert.deepEqual(
    manifest.candidates.map((candidate) => candidate.selected),
    [false, false, false],
  );
});

test("SeedSessionManager.pick updates selected candidates", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mediaforge-seed-pick-"));
  const sessionDir = path.join(tempRoot, "workspace", "seeds", "ep23-noggin");
  const manager = await SeedSessionManager.create({
    candidateCount: 4,
    duration: 10,
    model: "skyreels-ref2v",
    outputDir: sessionDir,
    prompt: "갈색 바위 괴물 너긴이 자기 머리를 두드린다",
  });

  await manager.pick(["seed-002", "seed-004"]);

  const reloaded = await SeedSessionManager.load(sessionDir);
  assert.deepEqual(
    reloaded.manifest.candidates.filter((candidate) => candidate.selected).map((candidate) => candidate.id),
    ["seed-002", "seed-004"],
  );
});

test("SeedSessionManager builds extension chains from the chosen seed", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mediaforge-seed-chain-"));
  const sessionDir = path.join(tempRoot, "workspace", "seeds", "ep23-noggin");
  const manager = await SeedSessionManager.create({
    candidateCount: 2,
    duration: 10,
    model: "skyreels-ref2v",
    outputDir: sessionDir,
    prompt: "갈색 바위 괴물 너긴이 자기 머리를 두드린다",
  });

  await manager.registerCandidateResult("seed-002", {
    file: "seed-002.mp4",
    seed: 1337,
    status: "generated",
    thumbnail: "thumbnails/seed-002.jpg",
  });
  await manager.addExtension({
    addedDuration: 5,
    file: "ext-002-001.mp4",
    overlapFrames: 8,
    parent: "seed-002",
    prompt: "카메라가 천천히 뒤로 빠진다",
    seed: 7890,
  });
  await manager.addExtension({
    addedDuration: 5,
    file: "ext-002-002.mp4",
    overlapFrames: 8,
    parent: "ext-002-001",
    prompt: "너긴의 눈이 더 빠르게 돈다",
    seed: 9999,
  });

  const chain = manager.getExtensionChain("seed-002");

  assert.deepEqual(
    chain.map((entry) => entry.id),
    ["seed-002", "ext-002-001", "ext-002-002"],
  );
  assert.equal(chain[1]?.totalDuration, 15);
  assert.equal(chain[2]?.totalDuration, 20);
  assert.equal(manager.resolveLatestClip("seed-002")?.id, "ext-002-002");
});

test("browseSeedSessions returns saved session summaries", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mediaforge-seed-browse-"));
  const sessionA = await SeedSessionManager.create({
    candidateCount: 2,
    duration: 10,
    model: "skyreels-ref2v",
    outputDir: path.join(tempRoot, "workspace", "seeds", "ep23-a"),
    prompt: "scene a",
  });
  const sessionB = await SeedSessionManager.create({
    candidateCount: 1,
    duration: 5,
    model: "wan22",
    outputDir: path.join(tempRoot, "workspace", "seeds", "ep23-b"),
    prompt: "scene b",
  });

  await sessionA.pick(["seed-001"]);
  await sessionB.registerCandidateResult("seed-001", {
    file: "seed-001.mp4",
    seed: 42,
    status: "generated",
  });

  const sessions = await browseSeedSessions(path.join(tempRoot, "workspace", "seeds"));

  assert.equal(sessions.length, 2);
  assert.deepEqual(
    sessions.map((session) => session.sessionId),
    [sessionA.manifest.sessionId, sessionB.manifest.sessionId].sort(),
  );
  assert.equal(
    sessions.find((session) => session.sessionDir.endsWith("ep23-a"))?.selectedCandidateIds[0],
    "seed-001",
  );
});
