import { test } from "node:test";
import * as assert from "node:assert/strict";

import { runCli } from "../helpers/run-cli.js";

test("prints structured JSON for run --json", () => {
  const result = runCli(["run", "tests/fixtures/valid-low-cost-request.json", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    request_id?: string;
    validation?: { valid?: boolean };
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.validation?.valid, true);
  assert.equal(typeof parsed.request_id, "string");
});

test("returns exit code 2 for validation failures", () => {
  const result = runCli(["run", "tests/fixtures/invalid-request.json", "--json"]);

  assert.equal(result.exitCode, 2);
});

test("returns the same request_id for the same input across runs", () => {
  const firstRun = runCli(["run", "tests/fixtures/valid-low-cost-request.json", "--json"]);
  const secondRun = runCli(["run", "tests/fixtures/valid-low-cost-request.json", "--json"]);
  const firstParsed = JSON.parse(firstRun.stdout) as { request_id?: string };
  const secondParsed = JSON.parse(secondRun.stdout) as { request_id?: string };

  assert.equal(firstRun.exitCode, 0);
  assert.equal(secondRun.exitCode, 0);
  assert.equal(firstParsed.request_id, secondParsed.request_id);
});

test("includes platform_output_spec in run --json output", () => {
  const result = runCli(["run", "tests/fixtures/valid-low-cost-request.json", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    validation?: { valid?: boolean };
    normalized_request?: { derived?: { resolved_aspect_ratio?: string } };
    platform_output_spec?: {
      platform?: string;
      effective_duration_sec?: number;
      warnings?: string[];
    };
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.validation?.valid, true);
  assert.equal(parsed.normalized_request?.derived?.resolved_aspect_ratio, "9:16");
  assert.equal(parsed.platform_output_spec?.platform, "youtube_shorts");
  assert.equal(parsed.platform_output_spec?.effective_duration_sec, 20);
  assert.equal(parsed.platform_output_spec?.warnings?.length, 0);
});

test("includes motion_plan in run --json output", () => {
  const result = runCli(["run", "tests/fixtures/valid-low-cost-request.json", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    motion_plan?: {
      schema_version?: string;
      motion_sequence?: Array<{ segment_id?: string }>;
      hook_motion?: { required?: boolean };
    };
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.motion_plan?.schema_version, "0.1");
  assert.equal(parsed.motion_plan?.motion_sequence?.[0]?.segment_id, "hook");
  assert.equal(parsed.motion_plan?.hook_motion?.required, true);
});

test("includes broll_plan in run --json output", () => {
  const result = runCli(["run", "tests/fixtures/valid-low-cost-request.json", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    broll_plan?: {
      dataset_version?: string;
      segments?: Array<{ segment_id?: string; concept?: string }>;
    };
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.broll_plan?.dataset_version, "0.1");
  assert.equal(parsed.broll_plan?.segments?.[0]?.segment_id, "hook");
  assert.equal(parsed.broll_plan?.segments?.[0]?.concept, "ai");
});

test("includes learning_state in run --json output", () => {
  const result = runCli(["run", "tests/fixtures/valid-low-cost-request.json", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    learning_state?: {
      confidence?: string;
      phase?: string;
      weights?: { dataset?: number; user?: number };
    };
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.learning_state?.phase, "bootstrapped");
  assert.equal(parsed.learning_state?.weights?.dataset, 0.8);
  assert.equal(parsed.learning_state?.weights?.user, 0.2);
  assert.equal(parsed.learning_state?.confidence, "low");
});

test("includes novel_shorts_plan in run --json output and applies novel intent overrides downstream", () => {
  const result = runCli(["run", "tests/fixtures/novel-cliffhanger-request.json", "--json"]);
  const parsed = JSON.parse(result.stdout) as {
    novel_shorts_plan?: {
      mode?: string;
      intent_overrides?: { duration_sec?: number; theme?: string };
    };
    platform_output_spec?: { effective_duration_sec?: number };
    motion_plan?: { theme?: string };
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.novel_shorts_plan?.mode, "cliffhanger_short");
  assert.equal(parsed.novel_shorts_plan?.intent_overrides?.theme, "cliffhanger");
  assert.equal(parsed.novel_shorts_plan?.intent_overrides?.duration_sec, 25);
  assert.equal(parsed.platform_output_spec?.effective_duration_sec, 25);
  assert.equal(parsed.motion_plan?.theme, "cliffhanger");
});

test("prints platform summary lines in human-readable output", () => {
  const result = runCli(["run", "tests/fixtures/valid-low-cost-request.json"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Platform: youtube_shorts/);
  assert.match(result.stdout, /Effective duration: 20s/);
  assert.match(result.stdout, /Warnings: 0/);
});
