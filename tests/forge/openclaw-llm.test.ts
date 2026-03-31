import { test } from "node:test";
import * as assert from "node:assert/strict";

import { OpenClawLLMClient } from "../../src/backends/openclaw-llm.js";

test("OpenClawLLMClient sends prompt to OpenClaw /invoke endpoint", async () => {
  const client = new OpenClawLLMClient({
    baseUrl: "http://127.0.0.1:4318",
    fetchFn: async (url, init) => {
      assert.equal(url, "http://127.0.0.1:4318/invoke");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal(body.action, "llm.generate");
      const input = body.input as Record<string, unknown>;
      assert.equal(input.prompt, "공주가 숲에서 나비를 쫓는다");
      assert.ok(typeof input.system_prompt === "string");
      assert.equal(input.model, "gpt-4o");

      return new Response(JSON.stringify({
        output: {
          text: JSON.stringify({
            image_prompt: "fairy tale princess chasing butterflies",
            image_negative: "blurry, low quality",
            video_prompt: "camera slowly pushes forward as butterflies flutter",
            video_negative: "flicker, warped",
          }),
        },
        status: "completed",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const result = await client.generate("공주가 숲에서 나비를 쫓는다", "gpt-4o");
  assert.match(result, /fairy tale princess/);
});

test("OpenClawLLMClient.isAvailable checks /health endpoint", async () => {
  const available = new OpenClawLLMClient({
    baseUrl: "http://127.0.0.1:4318",
    fetchFn: async () => new Response("ok", { status: 200 }),
  });
  assert.equal(await available.isAvailable(), true);

  const unavailable = new OpenClawLLMClient({
    baseUrl: "http://127.0.0.1:4318",
    fetchFn: async () => { throw new Error("ECONNREFUSED"); },
  });
  assert.equal(await unavailable.isAvailable(), false);
});

test("OpenClawLLMClient.generateWithSystemPrompt passes custom system prompt", async () => {
  const client = new OpenClawLLMClient({
    baseUrl: "http://127.0.0.1:4318",
    fetchFn: async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const input = body.input as Record<string, unknown>;
      assert.equal(input.system_prompt, "Custom system prompt");
      return new Response(JSON.stringify({
        output: { text: "generated text" },
        status: "completed",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const result = await client.generateWithSystemPrompt("test", "gpt-4o", "Custom system prompt");
  assert.equal(result, "generated text");
});

test("OpenClawLLMClient throws on non-ok response", async () => {
  const client = new OpenClawLLMClient({
    baseUrl: "http://127.0.0.1:4318",
    fetchFn: async () => new Response("error", { status: 500, statusText: "Internal Server Error" }),
  });

  await assert.rejects(
    () => client.generate("test"),
    { message: /OpenClaw LLM request failed: 500/ },
  );
});
