import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import * as path from "node:path";
import { test } from "node:test";
import * as assert from "node:assert/strict";

import { runCli } from "../helpers/run-cli.js";

test("creates a scaffold request file from a built-in profile", () => {
  const tempDir = mkdtempSync(path.join(process.cwd(), "tmp-create-"));
  const outputPath = path.join(tempDir, "request.json");

  try {
    const result = runCli(["create", "youtube_explainer", outputPath, "--json"]);
    const parsed = JSON.parse(result.stdout) as {
      schema_version?: string;
      profile?: string;
      output_path?: string;
      request?: { intent?: { platform?: string } };
    };
    const writtenFile = JSON.parse(readFileSync(outputPath, "utf8")) as {
      intent?: { theme?: string };
    };

    assert.equal(result.exitCode, 0);
    assert.equal(parsed.schema_version, "0.1");
    assert.equal(parsed.profile, "youtube_explainer");
    assert.equal(parsed.output_path, outputPath);
    assert.equal(parsed.request?.intent?.platform, "youtube_shorts");
    assert.equal(writtenFile.intent?.theme, "explainer");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("prints a short human-readable create summary", () => {
  const tempDir = mkdtempSync(path.join(process.cwd(), "tmp-create-"));
  const outputPath = path.join(tempDir, "request.json");

  try {
    const result = runCli(["create", "novel_cliffhanger", outputPath]);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Profile: novel_cliffhanger/);
    assert.match(result.stdout, /Output path:/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
