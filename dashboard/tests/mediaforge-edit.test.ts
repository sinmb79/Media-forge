import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeDashboardEditRequest,
} from "../src/lib/mediaforge-edit";

test("normalizeDashboardEditRequest trims concat inputs and keeps explicit extras", () => {
  const request = normalizeDashboardEditRequest("concat", {
    extraInputs: [" C:\\temp\\clip-2.mp4 ", "", "C:\\temp\\clip-3.mp4"],
    input: " C:\\temp\\clip-1.mp4 ",
  });

  assert.equal(request.tool, "concat");
  assert.equal(request.inputPath, "C:\\temp\\clip-1.mp4");
  assert.deepEqual(request.extraInputs, [
    "C:\\temp\\clip-2.mp4",
    "C:\\temp\\clip-3.mp4",
  ]);
});

test("normalizeDashboardEditRequest clamps pacing and interpolation controls", () => {
  const request = normalizeDashboardEditRequest("interpolate", {
    factor: "8.4",
    fps: "240",
    input: "C:\\temp\\shot.mp4",
    resolution: "4k",
    scale: "9",
  });

  assert.equal(request.tool, "interpolate");
  assert.equal(request.factor, 4);
  assert.equal(request.fps, 120);
  assert.equal(request.scale, 4);
  assert.equal(request.resolution, "1080p");
});

test("normalizeDashboardEditRequest defaults smart cut target duration", () => {
  const request = normalizeDashboardEditRequest("smart-cut", {
    input: "C:\\temp\\highlight.mp4",
    targetDuration: "2",
  });

  assert.equal(request.tool, "smart-cut");
  assert.equal(request.inputPath, "C:\\temp\\highlight.mp4");
  assert.equal(request.targetDurationSec, 5);
});
