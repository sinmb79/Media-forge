import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import * as assert from "node:assert/strict";

import { runCli } from "../helpers/run-cli.js";

test("engine forge prompt build returns prompt bundle JSON", () => {
  const result = runCli([
    "forge",
    "prompt",
    "build",
    "--desc",
    "공주가 숲에서 나비를 쫓는다",
    "--theme",
    "fairy_tale",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    image_prompt?: string;
    video_prompt?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(typeof parsed.image_prompt, "string");
  assert.equal(typeof parsed.video_prompt, "string");
});

test("engine forge image sketch supports simulation mode", () => {
  const result = runCli([
    "forge",
    "image",
    "sketch",
    "tests/fixtures/sketch-placeholder.png",
    "--desc",
    "공주가 숲에서 나비를 쫓는다",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    status?: string;
    workflow_id?: string;
    output_path?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.workflow_id, "sdxl_controlnet_scribble");
  assert.match(parsed.output_path ?? "", /png$/);
});

test("engine forge image generate supports simulation mode", () => {
  const result = runCli([
    "forge",
    "image",
    "generate",
    "--prompt",
    "공주가 호수 앞에 서 있다",
    "--model",
    "sdxl",
    "--size",
    "2k",
    "--ratio",
    "16:9",
    "--count",
    "2",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    output_paths?: string[];
    status?: string;
    workflow_id?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.output_paths?.length, 2);
  assert.equal(parsed.workflow_id, "sdxl_text_to_image");
});

test("engine forge image style supports simulation mode", () => {
  const result = runCli([
    "forge",
    "image",
    "style",
    "tests/fixtures/sketch-placeholder.png",
    "--style",
    "anime",
    "--strength",
    "0.7",
    "--prompt",
    "anime fantasy illustration",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    status?: string;
    workflow_id?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.workflow_id, "sdxl_img2img");
});

test("engine forge image remove-bg supports simulation mode", () => {
  const result = runCli([
    "forge",
    "image",
    "remove-bg",
    "tests/fixtures/sketch-placeholder.png",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    backend?: string;
    status?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.backend, "python");
});

test("engine forge image inpaint supports simulation mode", () => {
  const result = runCli([
    "forge",
    "image",
    "inpaint",
    "tests/fixtures/sketch-placeholder.png",
    "--mask",
    "tests/fixtures/mask-placeholder.png",
    "--prompt",
    "replace with a glowing moon",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    status?: string;
    workflow_id?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.workflow_id, "sdxl_inpaint");
});

test("engine forge image upscale supports simulation mode", () => {
  const result = runCli([
    "forge",
    "image",
    "upscale",
    "tests/fixtures/sketch-placeholder.png",
    "--scale",
    "4",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    status?: string;
    workflow_id?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.workflow_id, "realesrgan_upscale");
});

test("engine forge image remove-watermark supports simulation mode", () => {
  const result = runCli([
    "forge",
    "image",
    "remove-watermark",
    "tests/fixtures/sketch-placeholder.png",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    status?: string;
    workflow_id?: string | null;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.workflow_id, "watermark_remove_image");
});

test("engine forge video from-image supports simulation mode", () => {
  const result = runCli([
    "forge",
    "video",
    "from-image",
    "tests/fixtures/sketch-placeholder.png",
    "--model",
    "wan22",
    "--quality",
    "production",
    "--desc",
    "카메라가 천천히 앞으로 이동한다",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    status?: string;
    workflow_id?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.ok(parsed.workflow_id === "wan22_i2v_gguf_q8" || parsed.workflow_id === "wan22_i2v_gguf_q4");
});

test("engine forge video ref2v supports simulation mode", () => {
  const result = runCli([
    "forge",
    "video",
    "ref2v",
    "characters/hero-front.png,characters/hero-side.png",
    "--desc",
    "영웅이 절벽 끝에서 석양을 바라본다",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    status?: string;
    workflow_id?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.workflow_id, "skyreels_v3_ref2v_fp8");
});

test("engine forge video talking supports simulation mode", () => {
  const result = runCli([
    "forge",
    "video",
    "talking",
    "characters/hero-portrait.png",
    "--audio",
    "audio/scene_03_dialogue.mp3",
    "--desc",
    "자신감 있는 표정, 정면 샷",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    status?: string;
    workflow_id?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.workflow_id, "skyreels_v3_a2v_fp8");
});

test("engine forge video extend supports simulation mode", () => {
  const result = runCli([
    "forge",
    "video",
    "extend",
    "clips/scene_03.mp4",
    "--desc",
    "카메라가 천천히 뒤로 빠진다",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    status?: string;
    workflow_id?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.workflow_id, "skyreels_v3_v2v_fp8");
});

test("engine forge video seed creates a session manifest in simulation mode", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mediaforge-cli-seed-"));
  const outputDir = path.join(tempRoot, "workspace", "seeds", "ep23-noggin");

  const result = runCli([
    "forge",
    "video",
    "seed",
    "--desc",
    "갈색 바위 괴물 너긴이 자기 머리를 두드린다",
    "--candidates",
    "2",
    "--duration",
    "10",
    "--model",
    "skyreels-ref2v",
    "--refs",
    "characters/noggin-front.png,characters/noggin-side.png",
    "--output",
    outputDir,
    "--simulate",
    "--json",
  ], {
    env: {
      MEDIAFORGE_ROOT: tempRoot,
    },
  });
  const parsed = JSON.parse(result.stdout) as {
    candidates?: Array<{ id: string }>;
    manifest_path?: string;
    session_dir?: string;
    status?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.session_dir, outputDir);
  assert.equal(parsed.candidates?.length, 2);
  assert.match(parsed.manifest_path ?? "", /manifest\.json$/);
});

test("engine forge video pick updates an existing session manifest", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mediaforge-cli-pick-"));
  const outputDir = path.join(tempRoot, "workspace", "seeds", "ep23-noggin");

  runCli([
    "forge",
    "video",
    "seed",
    "--desc",
    "갈색 바위 괴물 너긴이 자기 머리를 두드린다",
    "--candidates",
    "2",
    "--duration",
    "10",
    "--model",
    "skyreels-ref2v",
    "--output",
    outputDir,
    "--simulate",
    "--json",
  ], {
    env: {
      MEDIAFORGE_ROOT: tempRoot,
    },
  });

  const result = runCli([
    "forge",
    "video",
    "pick",
    "--session",
    outputDir,
    "--select",
    "seed-002",
    "--json",
  ], {
    env: {
      MEDIAFORGE_ROOT: tempRoot,
    },
  });
  const parsed = JSON.parse(result.stdout) as {
    selected?: string[];
    status?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "updated");
  assert.deepEqual(parsed.selected, ["seed-002"]);
});

test("engine forge video extend supports session mode in simulation mode", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mediaforge-cli-extend-session-"));
  const outputDir = path.join(tempRoot, "workspace", "seeds", "ep23-noggin");

  runCli([
    "forge",
    "video",
    "seed",
    "--desc",
    "갈색 바위 괴물 너긴이 자기 머리를 두드린다",
    "--candidates",
    "2",
    "--duration",
    "10",
    "--model",
    "skyreels-ref2v",
    "--output",
    outputDir,
    "--simulate",
    "--json",
  ], {
    env: {
      MEDIAFORGE_ROOT: tempRoot,
    },
  });

  const result = runCli([
    "forge",
    "video",
    "extend",
    "--session",
    outputDir,
    "--source",
    "seed-002",
    "--duration",
    "5",
    "--desc",
    "카메라가 천천히 뒤로 빠지며 전체 모습이 보인다",
    "--simulate",
    "--json",
  ], {
    env: {
      MEDIAFORGE_ROOT: tempRoot,
    },
  });
  const parsed = JSON.parse(result.stdout) as {
    composed_output_path?: string;
    extension_id?: string;
    source_id?: string;
    status?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.source_id, "seed-002");
  assert.equal(parsed.extension_id, "ext-002-001");
  assert.match(parsed.composed_output_path ?? "", /composed-002\.mp4$/);
});

test("engine forge video browse returns session details", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mediaforge-cli-browse-"));
  const outputDir = path.join(tempRoot, "workspace", "seeds", "ep23-noggin");

  runCli([
    "forge",
    "video",
    "seed",
    "--desc",
    "갈색 바위 괴물 너긴이 자기 머리를 두드린다",
    "--candidates",
    "2",
    "--duration",
    "10",
    "--model",
    "skyreels-ref2v",
    "--output",
    outputDir,
    "--simulate",
    "--json",
  ], {
    env: {
      MEDIAFORGE_ROOT: tempRoot,
    },
  });

  const result = runCli([
    "forge",
    "video",
    "browse",
    "--session",
    outputDir,
    "--json",
  ], {
    env: {
      MEDIAFORGE_ROOT: tempRoot,
    },
  });
  const parsed = JSON.parse(result.stdout) as {
    manifest?: { candidates?: unknown[]; prompt?: string };
    session_dir?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.session_dir, outputDir);
  assert.equal(parsed.manifest?.prompt, "갈색 바위 괴물 너긴이 자기 머리를 두드린다");
  assert.equal(parsed.manifest?.candidates?.length, 2);
});

test("engine forge pipeline auto-extend simulates seed, pick, extend, and compose", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mediaforge-cli-auto-extend-"));
  const outputPath = path.join(tempRoot, "final", "noggin-scene.mp4");

  const result = runCli(
    [
      "forge",
      "pipeline",
      "auto-extend",
      "--desc",
      "媛덉깋 諛붿쐞 愿대Ъ ?덇릿???먭린 癒몃━瑜??먮뱶由곕떎",
      "--model",
      "skyreels-ref2v",
      "--refs",
      "characters/noggin-front.png",
      "--seed-duration",
      "10",
      "--candidates",
      "2",
      "--extend-loops",
      "2",
      "--extend-duration",
      "5",
      "--auto-pick",
      "first",
      "--output",
      outputPath,
      "--simulate",
      "--json",
    ],
    { env: { MEDIAFORGE_ROOT: tempRoot } },
  );
  const parsed = JSON.parse(result.stdout) as {
    compose?: { output_path?: string };
    pick?: { selected?: string[] };
    seed?: { candidates?: Array<{ id: string }> };
    status?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.seed?.candidates?.length, 2);
  assert.deepEqual(parsed.pick?.selected, ["seed-001"]);
  assert.equal(parsed.compose?.output_path, outputPath);
});

test("engine forge video long reads storyboard JSON in simulation mode", () => {
  const result = runCli([
    "forge",
    "video",
    "long",
    "--storyboard",
    "tests/fixtures/storyboard-sample.json",
    "--simulate",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    status?: string;
    scene_count?: number;
    workflow_id?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.scene_count, 2);
  assert.equal(parsed.workflow_id, "wan22_svi_long");
});

test("engine forge assets seed and list work with a temporary workspace root", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mediaforge-cli-assets-"));
  await mkdir(path.join(tempRoot, "data", "seeds"), { recursive: true });
  await writeFile(path.join(tempRoot, "data", "seeds", "characters.json"), "[]\n", "utf8");
  await writeFile(
    path.join(tempRoot, "data", "seeds", "backgrounds.json"),
    `${JSON.stringify([
      {
        category: "backgrounds",
        data: { prompt: "quiet lakeside dawn" },
        id: "bg-lake",
        name: "Lake Dawn",
        type: "prompt_preset",
      },
    ], null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(tempRoot, "data", "seeds", "effects.json"), "[]\n", "utf8");
  await writeFile(path.join(tempRoot, "data", "seeds", "motions.json"), "[]\n", "utf8");
  await writeFile(path.join(tempRoot, "data", "seeds", "props.json"), "[]\n", "utf8");

  const seeded = runCli(
    ["forge", "assets", "seed", "--json"],
    { env: { MEDIAFORGE_ROOT: tempRoot } },
  );
  const listed = runCli(
    ["forge", "assets", "list", "--category", "backgrounds", "--json"],
    { env: { MEDIAFORGE_ROOT: tempRoot } },
  );
  const seededParsed = JSON.parse(seeded.stdout) as { seeded_count?: number };
  const listedParsed = JSON.parse(listed.stdout) as { assets?: Array<{ id: string }> };

  assert.equal(seeded.exitCode, 0);
  assert.equal(seededParsed.seeded_count, 1);
  assert.equal(listed.exitCode, 0);
  assert.equal(listedParsed.assets?.[0]?.id, "bg-lake");
});

test("engine forge character create, list, and dub support the new character workflow", () => {
  const tempRoot = path.join(os.tmpdir(), `mediaforge-cli-character-${Date.now()}`);
  const created = runCli(
    [
      "forge",
      "character",
      "create",
      "--name",
      "Princess",
      "--type",
      "anime",
      "--ref",
      "refs/princess.png",
      "--description",
      "Fairy tale lead",
      "--json",
    ],
    { env: { MEDIAFORGE_ROOT: tempRoot } },
  );
  const createdParsed = JSON.parse(created.stdout) as { id?: string };
  const listed = runCli(
    ["forge", "character", "list", "--json"],
    { env: { MEDIAFORGE_ROOT: tempRoot } },
  );
  const dubbed = runCli(
    [
      "forge",
      "character",
      "dub",
      "--character",
      createdParsed.id ?? "",
      "--text",
      "안녕하세요",
      "--lang",
      "ko",
      "--simulate",
      "--json",
    ],
    { env: { MEDIAFORGE_ROOT: tempRoot } },
  );
  const listedParsed = JSON.parse(listed.stdout) as { characters?: Array<{ name: string }> };
  const dubbedParsed = JSON.parse(dubbed.stdout) as { status?: string; output_path?: string };

  assert.equal(created.exitCode, 0);
  assert.equal(listed.exitCode, 0);
  assert.equal(listedParsed.characters?.[0]?.name, "Princess");
  assert.equal(dubbed.exitCode, 0);
  assert.equal(dubbedParsed.status, "simulated");
  assert.match(dubbedParsed.output_path ?? "", /mp4$/);
});

test("engine forge video storyboard supports feature-map storyboard simulation", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mediaforge-cli-storyboard-"));
  const storyboardPath = path.join(tempRoot, "storyboard.json");
  await writeFile(
    storyboardPath,
    `${JSON.stringify({
      aspect_ratio: "16:9",
      model: "wan22-q8",
      resolution: "1080p",
      shots: [
        { duration_sec: 3, id: 1, image: "scene1.png", prompt_ko: "공주가 숲을 걷는다" },
        { duration_sec: 4, id: 2, image: null, prompt_ko: "나비가 날아온다" },
      ],
      transition: "cut",
    }, null, 2)}\n`,
    "utf8",
  );

  const result = runCli(
    ["forge", "video", "storyboard", storyboardPath, "--simulate", "--json"],
    { env: { MEDIAFORGE_ROOT: tempRoot } },
  );
  const parsed = JSON.parse(result.stdout) as {
    clip_paths?: string[];
    shot_count?: number;
    status?: string;
  };

  assert.equal(result.exitCode, 0);
  assert.equal(parsed.status, "simulated");
  assert.equal(parsed.shot_count, 2);
  assert.equal(parsed.clip_paths?.length, 2);
});

test("engine forge agent openclaw inspect reports the local bridge contract", () => {
  const result = runCli([
    "forge",
    "agent",
    "openclaw",
    "inspect",
    "--json",
  ]);
  const parsed = JSON.parse(result.stdout) as {
    openclaw?: { actions?: Array<{ id: string }> };
    stage?: { ready?: boolean };
  };

  assert.equal(result.exitCode, 0);
  assert.ok(parsed.openclaw?.actions?.some((action) => action.id === "prompt.build"));
  assert.equal(typeof parsed.stage?.ready, "boolean");
});
