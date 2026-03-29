import { test } from "node:test";
import * as assert from "node:assert/strict";

import { runCli } from "../helpers/run-cli.js";

test("engine forge edit cut supports simulation mode", () => {
  const result = runCli([
    "forge",
    "edit",
    "cut",
    "tests/fixtures/video-placeholder.mp4",
    "--start",
    "00:05",
    "--end",
    "00:15",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; operation?: string };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.operation, "cut");
});

test("engine forge audio tts supports simulation mode", () => {
  const result = runCli([
    "forge",
    "audio",
    "tts",
    "--text",
    "안녕하세요",
    "--lang",
    "ko",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; operation?: string };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.operation, "tts");
});

test("engine forge pipeline sketch-to-video supports simulation mode", () => {
  const result = runCli([
    "forge",
    "pipeline",
    "sketch-to-video",
    "tests/fixtures/sketch-placeholder.png",
    "--desc",
    "공주가 숲에서 나비를 쫓는다",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; step_count?: number };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.step_count, 2);
});

test("engine forge pipeline sketch-to-long-video supports simulation mode", () => {
  const result = runCli([
    "forge",
    "pipeline",
    "sketch-to-long-video",
    "tests/fixtures/sketch-placeholder.png",
    "--desc",
    "공주가 숲에서 나비를 쫓다가 마법의 호수를 발견한다",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { status?: string; step_count?: number };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.step_count, 3);
});

test("engine forge prompt feedback stores a scored entry", () => {
  const result = runCli([
    "forge",
    "prompt",
    "feedback",
    "result_1",
    "--score",
    "5",
    "--theme",
    "fairy_tale",
    "--desc",
    "공주가 숲에서 나비를 쫓는다",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { id?: string; score?: number };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.id, "result_1");
  assert.equal(parsed.score, 5);
});

test("engine forge prompt suggest returns success patterns", () => {
  const result = runCli([
    "forge",
    "prompt",
    "suggest",
    "--theme",
    "fairy_tale",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as { theme?: string; suggestions?: unknown[] };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.theme, "fairy_tale");
  assert.ok(Array.isArray(parsed.suggestions));
});

test("engine forge install returns backend setup guidance", () => {
  const result = runCli([
    "forge",
    "install",
    "comfyui",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    backend?: string;
    install_guide_url?: string;
    status?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.backend, "comfyui");
  assert.equal(parsed.status, "guide");
  assert.match(String(parsed.install_guide_url), /^https:\/\//);
});
