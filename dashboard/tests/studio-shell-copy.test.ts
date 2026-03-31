import assert from "node:assert/strict";
import test from "node:test";

import { formatStudioSectionLabel, studioPageCopy } from "../src/components/studio-shell";

test("studioPageCopy exposes readable Korean copy for key pages", () => {
  assert.equal(studioPageCopy["/"]?.title, "MediaForge Studio");
  assert.equal(studioPageCopy["/video"]?.title, "비디오 스튜디오");
  assert.equal(studioPageCopy["/audio"]?.title, "오디오 스튜디오");
  assert.equal(studioPageCopy["/settings"]?.title, "설정");
});

test("formatStudioSectionLabel returns clean Korean labels", () => {
  assert.equal(formatStudioSectionLabel("workspace"), "작업");
  assert.equal(formatStudioSectionLabel("library"), "라이브러리");
  assert.equal(formatStudioSectionLabel("system"), "시스템");
});
