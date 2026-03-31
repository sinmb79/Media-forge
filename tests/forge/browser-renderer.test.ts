import * as assert from "node:assert/strict";
import * as path from "node:path";
import { test } from "node:test";

import { HeadlessBrowserRenderer } from "../../src/forge/visual/browser-renderer.js";

test("HeadlessBrowserRenderer prefers an existing absolute browser path over bare command names", async () => {
  const invoked: string[] = [];
  const absoluteBrowserPath = path.join("C:\\", "Tools", "Edge", "msedge.exe");
  const renderer = new HeadlessBrowserRenderer({
    browserCandidates: ["msedge", absoluteBrowserPath],
    execFileFn: async (file) => {
      invoked.push(file);
      return {
        exitCode: 0,
        stderr: "",
        stdout: "",
      };
    },
    pathExists: async (candidate: string) => candidate === absoluteBrowserPath,
  });

  await renderer.renderFrame({
    framePath: "frame.png",
    frameUrl: "file:///C:/template.html?frame=0",
  });

  assert.equal(invoked[0], absoluteBrowserPath);
});
