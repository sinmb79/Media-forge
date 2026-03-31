import * as assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import type { BackendStatus } from "../../src/backends/types.js";
import { inspectComfyUIMediaStack } from "../../src/forge/doctor/inspect-comfyui-media-stack.js";

test("inspectComfyUIMediaStack reports blocked capabilities when ComfyUI is missing", async () => {
  const result = await inspectComfyUIMediaStack([
    {
      available: false,
      detectedPath: null,
      installGuideUrl: "https://github.com/comfyanonymous/ComfyUI",
      name: "comfyui",
      source: "missing",
      version: null,
    },
  ]);

  assert.equal(result.ready, false);
  assert.ok(result.warnings.some((warning) => warning.includes("ComfyUI backend")));
  assert.ok(result.capabilities.every((capability) => capability.ready === false));
});

test("inspectComfyUIMediaStack recognizes local SkyReels and VibeVoice assets", async () => {
  const comfyuiRoot = makeTempComfyUiRoot();
  await Promise.all([
    mkdir(path.join(comfyuiRoot, "custom_nodes", "ComfyUI-WanVideoWrapper"), { recursive: true }),
    mkdir(path.join(comfyuiRoot, "custom_nodes", "ComfyUI-VideoHelperSuite"), { recursive: true }),
    mkdir(path.join(comfyuiRoot, "custom_nodes", "ComfyUI-KJNodes"), { recursive: true }),
    mkdir(path.join(comfyuiRoot, "custom_nodes", "ComfyUI-VibeVoice"), { recursive: true }),
    writeFixture(path.join(comfyuiRoot, "models", "diffusion_models", "Wan21-SkyReelsV3-Ref2V_fp8_scaled_mixed.safetensors")),
    writeFixture(path.join(comfyuiRoot, "models", "diffusion_models", "Wan21-SkyReelsV3-A2V_fp8_scaled_mixed.safetensors")),
    writeFixture(path.join(comfyuiRoot, "models", "diffusion_models", "Wan21-SkyReelsV3-V2V_fp8_scaled_mixed.safetensors")),
    writeFixture(path.join(comfyuiRoot, "models", "vae", "Wan2_1_VAE_bf16.safetensors")),
    writeFixture(path.join(comfyuiRoot, "models", "text_encoders", "umt5-xxl-enc-fp8_e4m3fn.safetensors")),
    writeFixture(path.join(comfyuiRoot, "models", "audio_models", "MelBandRoformer_fp16.safetensors")),
    writeFixture(path.join(comfyuiRoot, "models", "vibevoice", "VibeVoice-1.5B", "config.json")),
    writeFixture(path.join(comfyuiRoot, "models", "vibevoice", "VibeVoice-Realtime-0.5B", "config.json")),
  ]);

  const result = await inspectComfyUIMediaStack([
    comfyuiBackend(comfyuiRoot),
  ]);

  assert.equal(result.ready, true);
  assert.equal(result.capabilities.length, 5);
  assert.ok(result.capabilities.every((capability) => capability.ready));
});

function comfyuiBackend(detectedPath: string): BackendStatus {
  return {
    available: true,
    detectedPath,
    installGuideUrl: "https://github.com/comfyanonymous/ComfyUI",
    name: "comfyui",
    source: "config",
    version: null,
  };
}

function makeTempComfyUiRoot(): string {
  return path.join(
    os.tmpdir(),
    `mediaforge-comfyui-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
}

async function writeFixture(targetPath: string): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, "fixture");
}
