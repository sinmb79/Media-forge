import * as assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import { DashboardOutputStore } from "../../src/dashboard/services/dashboard-output-store.js";

test("DashboardOutputStore classifies and sorts recent outputs", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-dashboard-"));
  const outputsDir = path.resolve(rootDir, "outputs");

  await mkdir(outputsDir, { recursive: true });
  await writeFile(path.resolve(outputsDir, "frame.png"), "png");
  await new Promise((resolve) => setTimeout(resolve, 15));
  await writeFile(path.resolve(outputsDir, "clip.mp4"), "mp4");

  const store = new DashboardOutputStore(rootDir);
  const items = await store.listRecent();

  assert.equal(items[0]?.kind, "video");
  assert.equal(items[1]?.kind, "image");
  assert.equal(items[0]?.name, "clip.mp4");

  await rm(rootDir, { force: true, recursive: true });
});

test("DashboardOutputStore returns empty list when outputs directory is missing", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "mediaforge-dashboard-empty-"));
  const store = new DashboardOutputStore(rootDir);

  assert.deepEqual(await store.listRecent(), []);

  await rm(rootDir, { force: true, recursive: true });
});
