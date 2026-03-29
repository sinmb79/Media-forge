import { test } from "node:test";
import * as assert from "node:assert/strict";

import { ComfyUIBackend } from "../../src/backends/comfyui.js";

test("ComfyUIBackend queues a workflow through the prompt API", async () => {
  const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
  const backend = new ComfyUIBackend({
    baseUrl: "http://127.0.0.1:8188",
    fetchFn: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({ prompt_id: "prompt_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const result = await backend.queueWorkflow({ workflow: "demo" });

  assert.equal(result.prompt_id, "prompt_123");
  assert.equal(requests[0]?.url, "http://127.0.0.1:8188/prompt");
  assert.match(String(requests[0]?.init?.body), /demo/);
});

test("ComfyUIBackend reads workflow history status", async () => {
  const backend = new ComfyUIBackend({
    baseUrl: "http://127.0.0.1:8188",
    fetchFn: async () => {
      return new Response(JSON.stringify({
        prompt_123: {
          status: { status_str: "success", completed: true },
          outputs: {
            "9": {
              images: [
                { filename: "frame.png", subfolder: "", type: "output" },
              ],
            },
          },
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const result = await backend.getStatus("prompt_123");

  assert.equal(result.prompt_id, "prompt_123");
  assert.equal(result.status, "success");
  assert.equal(result.completed, true);
  assert.equal(result.outputs[0]?.filename, "frame.png");
});

test("ComfyUIBackend downloads an output asset", async () => {
  const backend = new ComfyUIBackend({
    baseUrl: "http://127.0.0.1:8188",
    fetchFn: async () => {
      return new Response("image-binary", { status: 200 });
    },
  });

  const content = await backend.downloadOutput({
    filename: "frame.png",
    subfolder: "",
    type: "output",
  });

  assert.equal(content.toString("utf8"), "image-binary");
});
