import { test } from "node:test";
import * as assert from "node:assert/strict";
import { LocalAdapter } from "../../../src/adapters/video/local-adapter.js";

test("local adapter is always available", async () => {
  const adapter = new LocalAdapter();
  assert.equal(await adapter.isAvailable(), true);
});

test("local adapter returns dry_run status", async () => {
  const adapter = new LocalAdapter();
  const result = await adapter.generate(
    {
      text_prompt: "A short clip of a cat",
      duration_sec: 15,
      aspect_ratio: "9:16",
      style_tags: ["cinematic"],
    },
    { dry_run: false },
  );
  assert.equal(result.status, "dry_run");
  assert.equal(result.output_path, undefined);
  assert.equal(typeof result.metadata, "object");
});

test("local adapter name is 'local'", () => {
  const adapter = new LocalAdapter();
  assert.equal(adapter.name, "local");
});
