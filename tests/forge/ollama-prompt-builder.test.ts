import { test } from "node:test";
import * as assert from "node:assert/strict";

import { OllamaBackend } from "../../src/backends/ollama.js";
import { buildForgePromptBundle } from "../../src/prompt/forge-prompt-builder.js";

test("OllamaBackend generates text via the Ollama HTTP API", async () => {
  const backend = new OllamaBackend({
    baseUrl: "http://127.0.0.1:11434",
    fetchFn: async (_url, init) => {
      assert.match(String(init?.body), /qwen3:14b/);
      return new Response(JSON.stringify({
        response: "{\"image_prompt\":\"fairy tale princess\",\"image_negative\":\"blurry\",\"video_prompt\":\"camera slowly pushes in\",\"video_negative\":\"flicker\"}",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const result = await backend.generate("공주가 숲에서 나비를 쫓는다", "qwen3:14b");

  assert.match(result, /fairy tale princess/);
});

test("OllamaBackend falls back to the thinking field when response is empty", async () => {
  const backend = new OllamaBackend({
    baseUrl: "http://127.0.0.1:11434",
    fetchFn: async () => {
      return new Response(JSON.stringify({
        response: "",
        thinking: "{\"image_prompt\":\"lake discovery\",\"image_negative\":\"blurry\",\"video_prompt\":\"camera glides over the lake\",\"video_negative\":\"flicker\"}",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const result = await backend.generate("공주가 호수를 발견한다", "qwen3.5:9b");

  assert.match(result, /lake discovery/);
});

test("buildForgePromptBundle uses Ollama JSON output when available", async () => {
  const bundle = await buildForgePromptBundle({
    desc_ko: "공주가 숲에서 나비를 쫓는다",
    theme: "fairy_tale",
    ollamaClient: {
      async isAvailable() { return true; },
      async generate() {
        return JSON.stringify({
          image_prompt: "fairy tale princess chasing butterflies, storybook forest",
          image_negative: "blurry, low quality",
          video_prompt: "camera slowly pushes forward as butterflies flutter around the princess",
          video_negative: "flicker, warped limbs",
        });
      },
      async getVersion() { return "ollama version 0.6.0"; },
      async execute() { throw new Error("not used"); },
      name: "ollama",
    },
  });

  assert.equal(bundle.source, "ollama");
  assert.match(bundle.image_prompt, /storybook forest/);
  assert.match(bundle.video_prompt, /camera slowly pushes forward/);
});

test("buildForgePromptBundle falls back to local prompt planning when Ollama is unavailable", async () => {
  const bundle = await buildForgePromptBundle({
    desc_ko: "공주가 숲에서 나비를 쫓는다",
    theme: "fairy_tale",
    ollamaClient: {
      async isAvailable() { return false; },
      async generate() { throw new Error("offline"); },
      async getVersion() { return null; },
      async execute() { throw new Error("not used"); },
      name: "ollama",
    },
  });

  assert.equal(bundle.source, "fallback");
  assert.match(bundle.image_prompt, /fairy_tale/i);
  assert.match(bundle.video_prompt, /cinematic/);
});
