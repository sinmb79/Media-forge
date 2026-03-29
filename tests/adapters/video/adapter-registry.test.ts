import { test } from "node:test";
import * as assert from "node:assert/strict";
import {
  resolveAdapter,
  ADAPTER_REGISTRY,
} from "../../../src/adapters/video/adapter-registry.js";

test("resolveAdapter returns local adapter for 'local' backend", async () => {
  const adapter = await resolveAdapter("local");
  assert.equal(adapter.name, "local");
});

test("resolveAdapter returns local adapter for 'gpu' backend", async () => {
  const adapter = await resolveAdapter("gpu");
  assert.equal(adapter.name, "local");
});

test("resolveAdapter returns local adapter for 'cache' backend", async () => {
  const adapter = await resolveAdapter("cache");
  assert.equal(adapter.name, "local");
});

test("resolveAdapter falls back to local when sora API key is absent", async () => {
  const saved = process.env["SORA_API_KEY"];
  delete process.env["SORA_API_KEY"];
  const adapter = await resolveAdapter("sora");
  assert.equal(adapter.name, "local");
  if (saved !== undefined) process.env["SORA_API_KEY"] = saved;
});

test("resolveAdapter falls back to local when premium backends are all unavailable", async () => {
  const keys = ["KLING_API_KEY", "RUNWAY_API_KEY", "SORA_API_KEY"];
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  const adapter = await resolveAdapter("premium");
  assert.equal(adapter.name, "local");
  for (const k of keys) {
    if (saved[k] !== undefined) process.env[k] = saved[k] as string;
  }
});

test("ADAPTER_REGISTRY contains all four adapter names", () => {
  const names = Object.keys(ADAPTER_REGISTRY);
  assert.ok(names.includes("local"));
  assert.ok(names.includes("sora"));
  assert.ok(names.includes("runway"));
  assert.ok(names.includes("kling"));
});
