import assert from "node:assert/strict";
import test from "node:test";

import {
  creationSurfaceIds,
  dashboardNavItems,
  quickActionIds,
} from "../src/lib/studio-config";

test("dashboard navigation covers the ten primary MediaForge pages", () => {
  assert.equal(dashboardNavItems.length, 10);
  assert.deepEqual(
    dashboardNavItems.map((item) => item.href),
    [
      "/",
      "/image",
      "/video",
      "/video/storyboard",
      "/edit",
      "/visual",
      "/audio",
      "/assets",
      "/queue",
      "/settings",
    ],
  );
});

test("creation surfaces cover Kling-style generation and CapCut-style tool entry points", () => {
  assert.deepEqual(
    creationSurfaceIds,
    [
      "image",
      "video",
      "storyboard",
      "edit",
      "visual",
      "audio",
      "assets",
    ],
  );
});

test("quick actions expose core local-first studio launches", () => {
  assert.deepEqual(
    quickActionIds,
    [
      "doctor",
      "prompt",
      "image",
      "video",
      "visual",
      "queue",
    ],
  );
});
