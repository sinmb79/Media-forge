import { access, readdir } from "node:fs/promises";
import * as path from "node:path";

import type { BackendStatus } from "../../backends/types.js";

export type ForgeMediaDependencyKind = "backend" | "custom_node" | "model";

export interface ForgeMediaDependencyStatus {
  detected_path: string | null;
  expected_paths: string[];
  id: string;
  install_guide_url: string | null;
  kind: ForgeMediaDependencyKind;
  label: string;
  ready: boolean;
}

export interface ForgeMediaCapabilityStatus {
  dependencies: ForgeMediaDependencyStatus[];
  id: string;
  label: string;
  missing_dependencies: string[];
  ready: boolean;
  summary: string;
}

export interface ForgeComfyUIMediaStackStatus {
  capabilities: ForgeMediaCapabilityStatus[];
  comfyui_root: string | null;
  custom_nodes_dir: string | null;
  models_dir: string | null;
  ready: boolean;
  warnings: string[];
}

export interface InspectComfyUIMediaStackDependencies {
  listDir(targetPath: string): Promise<string[]>;
  pathExists(targetPath: string): Promise<boolean>;
}

const DEFAULT_DEPENDENCIES: InspectComfyUIMediaStackDependencies = {
  listDir: defaultListDir,
  pathExists: defaultPathExists,
};

const SKYREELS_INSTALL_GUIDE_URL = "https://huggingface.co/Skywork";
const VIBEVOICE_INSTALL_GUIDE_URL = "https://huggingface.co/microsoft";

export async function inspectComfyUIMediaStack(
  backends: BackendStatus[],
  dependencies?: Partial<InspectComfyUIMediaStackDependencies>,
): Promise<ForgeComfyUIMediaStackStatus> {
  const resolvedDependencies: InspectComfyUIMediaStackDependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...dependencies,
  };
  const comfyuiStatus = backends.find((backend) => backend.name === "comfyui") ?? null;
  const comfyuiRoot = comfyuiStatus?.detectedPath ?? null;
  const customNodesDir = comfyuiRoot ? path.join(comfyuiRoot, "custom_nodes") : null;
  const modelsDir = comfyuiRoot ? path.join(comfyuiRoot, "models") : null;
  const customNodeEntries = customNodesDir
    ? await safeListDir(customNodesDir, resolvedDependencies)
    : [];

  const capabilities = await Promise.all(CAPABILITY_DEFINITIONS.map(async (definition) => {
    const dependenciesForCapability = await Promise.all(
      definition.dependencies.map((dependency) => resolveDependencyStatus(
        dependency,
        comfyuiStatus,
        customNodeEntries,
        customNodesDir,
        modelsDir,
        resolvedDependencies,
        backends,
      )),
    );
    const missingDependencies = dependenciesForCapability
      .filter((dependency) => !dependency.ready)
      .map((dependency) => dependency.label);

    return {
      dependencies: dependenciesForCapability,
      id: definition.id,
      label: definition.label,
      missing_dependencies: missingDependencies,
      ready: missingDependencies.length === 0,
      summary: missingDependencies.length === 0
        ? "Ready for local generation."
        : `Missing: ${missingDependencies.join(", ")}`,
    } satisfies ForgeMediaCapabilityStatus;
  }));

  const warnings: string[] = [];
  if (!comfyuiStatus?.available) {
    warnings.push(`ComfyUI backend is not ready. Install or start ComfyUI before using SkyReels or VibeVoice workflows.`);
  }

  for (const capability of capabilities) {
    if (!capability.ready) {
      warnings.push(`${capability.label} blocked: ${capability.missing_dependencies.join(", ")}`);
    }
  }

  return {
    capabilities,
    comfyui_root: comfyuiRoot,
    custom_nodes_dir: customNodesDir,
    models_dir: modelsDir,
    ready: capabilities.every((capability) => capability.ready),
    warnings,
  };
}

type DependencyDefinition =
  | {
    id: string;
    installGuideUrl: string | null;
    kind: "backend";
    label: string;
  }
  | {
    candidates: string[];
    id: string;
    installGuideUrl: string | null;
    kind: "custom_node";
    label: string;
  }
  | {
    directory: string[];
    fileMatcher: (entryName: string) => boolean;
    id: string;
    installGuideUrl: string | null;
    kind: "model";
    label: string;
  };

interface CapabilityDefinition {
  dependencies: DependencyDefinition[];
  id: string;
  label: string;
}

const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  {
    id: "tts",
    label: "Text-to-Speech (edge-tts)",
    dependencies: [
      {
        id: "edge_tts_binary",
        installGuideUrl: "https://github.com/rany2/edge-tts",
        kind: "backend" as const,
        label: "edge-tts CLI",
      },
    ],
  },
  {
    id: "image_sketch",
    label: "Sketch-to-Image (ControlNet)",
    dependencies: [
      backendDependency("comfyui_backend", "ComfyUI backend"),
      modelDependency(
        "sdxl_checkpoint",
        "SDXL base checkpoint",
        ["checkpoints"],
        (entryName) => matchesAll(entryName, ["sd_xl_base"]) && entryName.endsWith(".safetensors"),
        "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0",
      ),
      modelDependency(
        "controlnet_scribble_sdxl",
        "ControlNet Scribble SDXL model",
        ["controlnet"],
        (entryName) => matchesAll(entryName, ["controlnet", "scribble", "sdxl"]) && entryName.endsWith(".safetensors"),
        "https://huggingface.co/xinsir/controlnet-scribble-sdxl-1.0",
      ),
    ],
  },
  {
    id: "video_from_text",
    label: "Text-to-Video (Wan 2.2 / LTX-2)",
    dependencies: [
      backendDependency("comfyui_backend", "ComfyUI backend"),
      customNodeDependency("wanvideowrapper", "WanVideoWrapper node", [
        "ComfyUI-WanVideoWrapper",
      ], "https://github.com/kijai/ComfyUI-WanVideoWrapper"),
      customNodeDependency("vhs", "VideoHelperSuite node", [
        "ComfyUI-VideoHelperSuite",
      ], "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite"),
    ],
  },
  {
    id: "video_from_image",
    label: "Image-to-Video (Wan 2.2 I2V)",
    dependencies: [
      backendDependency("comfyui_backend", "ComfyUI backend"),
      customNodeDependency("wanvideowrapper", "WanVideoWrapper node", [
        "ComfyUI-WanVideoWrapper",
      ], "https://github.com/kijai/ComfyUI-WanVideoWrapper"),
      customNodeDependency("vhs", "VideoHelperSuite node", [
        "ComfyUI-VideoHelperSuite",
      ], "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite"),
    ],
  },
  {
    id: "skyreels_ref2v",
    label: "SkyReels Ref2V",
    dependencies: [
      backendDependency("comfyui_backend", "ComfyUI backend"),
      customNodeDependency("wanvideowrapper", "WanVideoWrapper node", [
        "ComfyUI-WanVideoWrapper",
      ], "https://github.com/kijai/ComfyUI-WanVideoWrapper"),
      customNodeDependency("vhs", "VideoHelperSuite node", [
        "ComfyUI-VideoHelperSuite",
      ], "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite"),
      customNodeDependency("kjnodes", "KJNodes utility node", [
        "ComfyUI-KJNodes",
      ], "https://github.com/kijai/ComfyUI-KJNodes"),
      modelDependency(
        "skyreels_ref2v_model",
        "SkyReels Ref2V model",
        ["diffusion_models", "diffusion_models/r2v"],
        (entryName) => matchesAll(entryName, ["skyreels", "r2v"]) && (entryName.endsWith(".safetensors") || entryName.endsWith(".gguf")),
        SKYREELS_INSTALL_GUIDE_URL,
      ),
      wanVaeDependency(),
      umt5Fp8Dependency(),
    ],
  },
  {
    id: "skyreels_talking",
    label: "SkyReels Talking Avatar",
    dependencies: [
      backendDependency("comfyui_backend", "ComfyUI backend"),
      customNodeDependency("wanvideowrapper", "WanVideoWrapper node", [
        "ComfyUI-WanVideoWrapper",
      ], "https://github.com/kijai/ComfyUI-WanVideoWrapper"),
      customNodeDependency("vhs", "VideoHelperSuite node", [
        "ComfyUI-VideoHelperSuite",
      ], "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite"),
      customNodeDependency("kjnodes", "KJNodes utility node", [
        "ComfyUI-KJNodes",
      ], "https://github.com/kijai/ComfyUI-KJNodes"),
      modelDependency(
        "skyreels_a2v_model",
        "SkyReels A2V model",
        ["diffusion_models", "diffusion_models/a2v"],
        (entryName) => matchesAll(entryName, ["skyreels", "a2v"]) && (entryName.endsWith(".safetensors") || entryName.endsWith(".gguf")),
        SKYREELS_INSTALL_GUIDE_URL,
      ),
      wanVaeDependency(),
      umt5Fp8Dependency(),
      modelDependency(
        "melbandroformer",
        "MelBandRoformer audio processor",
        ["audio_models", "audio_encoders"],
        (entryName) => matchesAll(entryName, ["melbandroformer"]) && (entryName.endsWith(".safetensors") || entryName.endsWith(".ckpt")),
        SKYREELS_INSTALL_GUIDE_URL,
      ),
    ],
  },
  {
    id: "skyreels_extend",
    label: "SkyReels V2V Extend",
    dependencies: [
      backendDependency("comfyui_backend", "ComfyUI backend"),
      customNodeDependency("wanvideowrapper", "WanVideoWrapper node", [
        "ComfyUI-WanVideoWrapper",
      ], "https://github.com/kijai/ComfyUI-WanVideoWrapper"),
      customNodeDependency("vhs", "VideoHelperSuite node", [
        "ComfyUI-VideoHelperSuite",
      ], "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite"),
      customNodeDependency("kjnodes", "KJNodes utility node", [
        "ComfyUI-KJNodes",
      ], "https://github.com/kijai/ComfyUI-KJNodes"),
      modelDependency(
        "skyreels_v2v_model",
        "SkyReels V2V model",
        ["diffusion_models", "diffusion_models/v2v"],
        (entryName) => matchesAll(entryName, ["skyreels", "v2v"]) && (entryName.endsWith(".safetensors") || entryName.endsWith(".gguf")),
        SKYREELS_INSTALL_GUIDE_URL,
      ),
      wanVaeDependency(),
      umt5Fp8Dependency(),
    ],
  },
  {
    id: "vibevoice_drama",
    label: "VibeVoice Drama",
    dependencies: [
      backendDependency("comfyui_backend", "ComfyUI backend"),
      customNodeDependency("vibevoice_node", "VibeVoice node", [
        "ComfyUI-VibeVoice",
        "VibeVoice-ComfyUI",
      ], "https://github.com/wildminder/ComfyUI-VibeVoice"),
      modelDependency(
        "vibevoice_tts_model",
        "VibeVoice 1.5B model",
        ["vibevoice", path.join("vibevoice", "VibeVoice-1.5B")],
        (entryName) => entryName === "config.json" || matchesAll(entryName, ["model-00001"]),
        VIBEVOICE_INSTALL_GUIDE_URL,
      ),
    ],
  },
  {
    id: "vibevoice_realtime",
    label: "VibeVoice Realtime",
    dependencies: [
      backendDependency("comfyui_backend", "ComfyUI backend"),
      customNodeDependency("vibevoice_node", "VibeVoice node", [
        "ComfyUI-VibeVoice",
        "VibeVoice-ComfyUI",
      ], "https://github.com/wildminder/ComfyUI-VibeVoice"),
      modelDependency(
        "vibevoice_realtime_model",
        "VibeVoice Realtime 0.5B model",
        ["vibevoice", path.join("vibevoice", "VibeVoice-Realtime-0.5B")],
        (entryName) => entryName === "config.json" || matchesAll(entryName, ["model-00001"]),
        VIBEVOICE_INSTALL_GUIDE_URL,
      ),
    ],
  },
];

function wanVaeDependency(): DependencyDefinition {
  return modelDependency(
    "wan_vae",
    "Wan 2.1 VAE",
    ["vae", "vae/split_files/vae"],
    (entryName) => (matchesAll(entryName, ["wan", "vae"]) || matchesAll(entryName, ["wan2_1_vae"])) && entryName.endsWith(".safetensors"),
    SKYREELS_INSTALL_GUIDE_URL,
  );
}

function umt5Fp8Dependency(): DependencyDefinition {
  return modelDependency(
    "umt5_fp8",
    "UMT5 FP8 encoder",
    ["text_encoders", "text_encoders/split_files/text_encoders", "clip"],
    (entryName) => matchesAll(entryName, ["umt5", "fp8"]) && entryName.endsWith(".safetensors"),
    SKYREELS_INSTALL_GUIDE_URL,
  );
}

function backendDependency(
  id: string,
  label: string,
): DependencyDefinition {
  return {
    id,
    installGuideUrl: "https://github.com/comfyanonymous/ComfyUI",
    kind: "backend",
    label,
  };
}

function customNodeDependency(
  id: string,
  label: string,
  candidates: string[],
  installGuideUrl: string,
): DependencyDefinition {
  return {
    candidates,
    id,
    installGuideUrl,
    kind: "custom_node",
    label,
  };
}

function modelDependency(
  id: string,
  label: string,
  directory: string[],
  fileMatcher: (entryName: string) => boolean,
  installGuideUrl: string,
): DependencyDefinition {
  return {
    directory,
    fileMatcher,
    id,
    installGuideUrl,
    kind: "model",
    label,
  };
}

async function resolveDependencyStatus(
  definition: DependencyDefinition,
  comfyuiStatus: BackendStatus | null,
  customNodeEntries: string[],
  customNodesDir: string | null,
  modelsDir: string | null,
  dependencies: InspectComfyUIMediaStackDependencies,
  backends: BackendStatus[] = [],
): Promise<ForgeMediaDependencyStatus> {
  switch (definition.kind) {
    case "backend": {
      const backendTarget = definition.id === "edge_tts_binary"
        ? backends.find((b) => b.name === "edge-tts") ?? null
        : comfyuiStatus;
      return {
        detected_path: backendTarget?.detectedPath ?? null,
        expected_paths: [definition.label],
        id: definition.id,
        install_guide_url: definition.installGuideUrl,
        kind: definition.kind,
        label: definition.label,
        ready: backendTarget?.available ?? false,
      };
    }
    case "custom_node": {
      const matchedEntry = findMatchingEntry(customNodeEntries, definition.candidates);
      return {
        detected_path: matchedEntry && customNodesDir ? path.join(customNodesDir, matchedEntry) : null,
        expected_paths: definition.candidates.map((candidate) => path.join("custom_nodes", candidate)),
        id: definition.id,
        install_guide_url: definition.installGuideUrl,
        kind: definition.kind,
        label: definition.label,
        ready: Boolean(matchedEntry),
      };
    }
    case "model": {
      const detectedPath = await findModelPath(modelsDir, definition.directory, definition.fileMatcher, dependencies);
      return {
        detected_path: detectedPath,
        expected_paths: definition.directory.map((directory) => path.join("models", directory)),
        id: definition.id,
        install_guide_url: definition.installGuideUrl,
        kind: definition.kind,
        label: definition.label,
        ready: detectedPath !== null,
      };
    }
    default:
      return assertNever(definition);
  }
}

async function findModelPath(
  modelsDir: string | null,
  directories: string[],
  fileMatcher: (entryName: string) => boolean,
  dependencies: InspectComfyUIMediaStackDependencies,
): Promise<string | null> {
  if (!modelsDir) {
    return null;
  }

  for (const relativeDirectory of directories) {
    const absoluteDirectory = path.join(modelsDir, relativeDirectory);
    const entries = await safeListDir(absoluteDirectory, dependencies);
    const matchedEntry = entries.find((entry) => fileMatcher(entry));
    if (matchedEntry) {
      return path.join(absoluteDirectory, matchedEntry);
    }

    if (await dependencies.pathExists(absoluteDirectory)) {
      const basename = path.basename(absoluteDirectory);
      if (fileMatcher(basename)) {
        return absoluteDirectory;
      }
    }
  }

  return null;
}

function findMatchingEntry(entries: string[], candidates: string[]): string | null {
  for (const candidate of candidates) {
    const matchedEntry = entries.find((entry) => normalize(entry) === normalize(candidate));
    if (matchedEntry) {
      return matchedEntry;
    }
  }

  return null;
}

function matchesAll(value: string, fragments: string[]): boolean {
  const normalizedValue = normalize(value);
  return fragments.every((fragment) => normalizedValue.includes(normalize(fragment)));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function safeListDir(
  targetPath: string,
  dependencies: InspectComfyUIMediaStackDependencies,
): Promise<string[]> {
  try {
    return await dependencies.listDir(targetPath);
  } catch {
    return [];
  }
}

async function defaultListDir(targetPath: string): Promise<string[]> {
  return readdir(targetPath);
}

async function defaultPathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled media stack dependency: ${JSON.stringify(value)}`);
}
