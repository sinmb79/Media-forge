import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeDashboardVideoSeedRequest,
  normalizeDashboardVideoAutoExtendRequest,
  normalizeDashboardImageRequest,
  normalizeDashboardVideoRequest,
} from "../src/lib/mediaforge-generate";

test("normalizeDashboardImageRequest chooses sketch mode when a sketch path exists", () => {
  const request = normalizeDashboardImageRequest({
    aspect: "21:9",
    desc: "Moonlit forest princess",
    drafts: 9,
    resolution: "4k",
    sketchPath: "C:\\temp\\sketch.png",
    theme: "fairy_tale",
  });

  assert.equal(request.mode, "sketch");
  assert.equal(request.batchCount, 4);
  assert.equal(request.aspectRatio, "16:9");
  assert.equal(request.resolution, "4k");
  assert.equal(request.sketchPath, "C:\\temp\\sketch.png");
});

test("normalizeDashboardImageRequest falls back to text-to-image defaults", () => {
  const request = normalizeDashboardImageRequest({
    aspect: "1:1",
    desc: "Editorial portrait",
    renderModel: "flux",
  });

  assert.equal(request.mode, "generate");
  assert.equal(request.aspectRatio, "1:1");
  assert.equal(request.batchCount, 1);
  assert.equal(request.renderModel, "flux");
  assert.equal(request.resolution, "2k");
});

test("normalizeDashboardVideoRequest keeps image mode with uploaded frame", () => {
  const request = normalizeDashboardVideoRequest({
    aspect: "16:9",
    desc: "Camera pushes toward the heroine",
    duration: 20,
    imagePath: "C:\\temp\\frame.png",
    mode: "image",
    model: "ltx2",
    quality: "draft",
  });

  assert.equal(request.mode, "image");
  assert.equal(request.aspectRatio, "16:9");
  assert.equal(request.durationSec, 15);
  assert.equal(request.model, "ltx2");
  assert.equal(request.quality, "draft");
});

test("normalizeDashboardVideoRequest narrows unsupported text-video model choices", () => {
  const request = normalizeDashboardVideoRequest({
    desc: "A butterfly crosses a magical lake",
    mode: "text",
    model: "ltx2",
  });

  assert.equal(request.mode, "text");
  assert.equal(request.model, "wan22");
  assert.equal(request.durationSec, 5);
  assert.equal(request.aspectRatio, "9:16");
});

test("normalizeDashboardVideoRequest keeps SkyReels Ref2V inputs and model", () => {
  const request = normalizeDashboardVideoRequest({
    desc: "The hero watches the sunset from the cliff edge",
    duration: 5,
    mode: "ref2v",
    model: "skyreels-ref2v",
    referencePaths: [
      "C:\\temp\\hero-front.png",
      "C:\\temp\\hero-side.png",
    ],
  });

  assert.equal(request.mode, "ref2v");
  assert.equal(request.model, "skyreels-ref2v");
  assert.deepEqual(request.referencePaths, [
    "C:\\temp\\hero-front.png",
    "C:\\temp\\hero-side.png",
  ]);
});

test("normalizeDashboardVideoRequest keeps SkyReels talking avatar inputs and model", () => {
  const request = normalizeDashboardVideoRequest({
    audioPath: "C:\\temp\\scene.mp3",
    desc: "Confident portrait, direct eye contact",
    mode: "talking",
    model: "skyreels-a2v",
    portraitPath: "C:\\temp\\portrait.png",
    text: "We leave now. Stay close.",
    voiceDir: "C:\\temp\\voices",
    voicePreset: "Hero",
  });

  assert.equal(request.mode, "talking");
  assert.equal(request.model, "skyreels-a2v");
  assert.equal(request.audioPath, "C:\\temp\\scene.mp3");
  assert.equal(request.portraitPath, "C:\\temp\\portrait.png");
  assert.equal(request.text, "We leave now. Stay close.");
  assert.equal(request.voiceDir, "C:\\temp\\voices");
  assert.equal(request.voicePreset, "Hero");
});

test("normalizeDashboardVideoRequest keeps SkyReels extension inputs and overlap", () => {
  const request = normalizeDashboardVideoRequest({
    desc: "The camera slowly eases backward",
    mode: "extend",
    model: "skyreels-v2v",
    overlapFrames: 12,
    sourceVideoPath: "C:\\temp\\scene.mp4",
  });

  assert.equal(request.mode, "extend");
  assert.equal(request.model, "skyreels-v2v");
  assert.equal(request.overlapFrames, 12);
  assert.equal(request.sourceVideoPath, "C:\\temp\\scene.mp4");
});

test("normalizeDashboardVideoSeedRequest keeps session inputs and reference images", () => {
  const request = normalizeDashboardVideoSeedRequest({
    candidates: 6,
    desc: "갈색 바위 괴물 너긴이 자기 머리를 두드린다",
    duration: 20,
    model: "skyreels-ref2v",
    outputDir: "C:\\temp\\workspace\\seeds\\ep23-noggin",
    referencePaths: [
      "C:\\temp\\noggin-front.png",
      "C:\\temp\\noggin-side.png",
    ],
  });

  assert.equal(request.candidates, 6);
  assert.equal(request.durationSec, 15);
  assert.equal(request.model, "skyreels-ref2v");
  assert.equal(request.outputDir, "C:\\temp\\workspace\\seeds\\ep23-noggin");
  assert.deepEqual(request.referencePaths, [
    "C:\\temp\\noggin-front.png",
    "C:\\temp\\noggin-side.png",
  ]);
});

test("normalizeDashboardVideoSeedRequest accepts image-seeded sessions", () => {
  const request = normalizeDashboardVideoSeedRequest({
    candidates: 2,
    desc: "",
    duration: 8,
    fromImagePath: "C:\\temp\\panel.png",
    model: "wan22",
    outputDir: "C:\\temp\\workspace\\seeds\\panel-shot",
  });

  assert.equal(request.candidates, 2);
  assert.equal(request.durationSec, 8);
  assert.equal(request.fromImagePath, "C:\\temp\\panel.png");
  assert.equal(request.model, "wan22");
});

test("normalizeDashboardVideoAutoExtendRequest keeps auto-pick, loop, and output options", () => {
  const request = normalizeDashboardVideoAutoExtendRequest({
    autoPick: "best",
    candidates: 4,
    desc: "Noggin drums on his head and spins.",
    extendDuration: 6,
    extendLoops: 3,
    model: "skyreels-ref2v",
    outputPath: "C:\\temp\\final\\noggin.mp4",
    referencePaths: ["C:\\temp\\noggin-front.png"],
    seedDuration: 12,
    withAudio: true,
  });

  assert.equal(request.autoPick, "best");
  assert.equal(request.candidates, 4);
  assert.equal(request.extendDurationSec, 6);
  assert.equal(request.extendLoops, 3);
  assert.equal(request.outputPath, "C:\\temp\\final\\noggin.mp4");
  assert.equal(request.seedDurationSec, 12);
  assert.equal(request.withAudio, true);
});
