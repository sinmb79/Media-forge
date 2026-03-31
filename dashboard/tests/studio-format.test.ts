import assert from "node:assert/strict";
import test from "node:test";

import { formatShortTime, formatStatusLabel } from "../src/lib/studio-format";
import type { DashboardJobRecord } from "../src/lib/mediaforge-types";

function createJob(overrides: Partial<DashboardJobRecord> = {}): DashboardJobRecord {
  return {
    artifact_exists: false,
    artifact_path: null,
    createdAt: "2026-03-31T09:00:00.000Z",
    details: "detail",
    expected_artifact: false,
    id: "job-1",
    label: "job",
    logs: [],
    next_step: null,
    output_path: null,
    phase: "execution",
    progress: 0.5,
    result_kind: "non_file",
    status: "queued",
    summary: "summary",
    ...overrides,
  };
}

test("formatShortTime returns Korean waiting label when timestamp is missing", () => {
  assert.equal(formatShortTime(null), "대기 중");
});

test("formatStatusLabel returns Korean execution and verification labels", () => {
  assert.equal(formatStatusLabel("queued", createJob()), "대기열");
  assert.equal(formatStatusLabel("running", createJob({ status: "running" })), "실행 중");
  assert.equal(formatStatusLabel("running", createJob({ phase: "verification", status: "running" })), "검증 중");
  assert.equal(formatStatusLabel("failed", createJob({ status: "failed" })), "실행 실패");
  assert.equal(formatStatusLabel("failed", createJob({ phase: "verification", status: "failed" })), "검증 실패");
  assert.equal(formatStatusLabel("succeeded", createJob({ status: "succeeded", expected_artifact: false })), "파일 생성 없음");
  assert.equal(formatStatusLabel("succeeded", createJob({ status: "succeeded", expected_artifact: true })), "생성 및 검증 완료");
});
