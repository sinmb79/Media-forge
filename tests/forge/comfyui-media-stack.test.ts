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
    writeFixture(path.join(comfyuiRoot, "models", "diffusion_models", "r2v", "SkyReels-v3-r2v-Q4_K_M.gguf")),
    writeFixture(path.join(comfyuiRoot, "models", "diffusion_models", "a2v", "SkyReels-v3-a2v-Q4_K_M.gguf")),
    writeFixture(path.join(comfyuiRoot, "models", "diffusion_models", "v2v", "SkyReels-v3-v2v-Q4_K_M.gguf")),
    writeFixture(path.join(comfyuiRoot, "models", "vae", "wan_2.1_vae.safetensors")),
    writeFixture(path.join(comfyuiRoot, "models", "text_encoders", "umt5_xxl_fp8_e4m3fn_scaled.safetensors")),
    writeFixture(path.join(comfyuiRoot, "models", "audio_models", "MelBandRoformer.ckpt")),
    writeFixture(path.join(comfyuiRoot, "models", "vibevoice", "VibeVoice-1.5B", "config.json")),
    writeFixture(path.join(comfyuiRoot, "models", "vibevoice", "VibeVoice-Realtime-0.5B", "config.json")),
  ]);

  const edgeTtsBackend: BackendStatus = {
    available: true,
    detectedPath: "C:/Python312/Scripts/edge-tts.exe",
    installGuideUrl: "https://github.com/rany2/edge-tts",
    name: "edge-tts",
    source: "path",
    version: "6.1.9",
  };

  const result = await inspectComfyUIMediaStack([
    comfyuiBackend(comfyuiRoot),
    edgeTtsBackend,
  ]);

  const advancedCapabilities = result.capabilities.filter(
    (c) => ["skyreels_ref2v", "skyreels_talking", "skyreels_extend", "vibevoice_drama", "vibevoice_realtime"].includes(c.id),
  );
  assert.equal(advancedCapabilities.length, 5);
  assert.ok(advancedCapabilities.every((capability) => capability.ready));

  const ttsCapability = result.capabilities.find((c) => c.id === "tts");
  assert.ok(ttsCapability?.ready);
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
