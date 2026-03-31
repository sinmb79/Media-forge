import { access } from "node:fs/promises";
import * as path from "node:path";

import {
  createDesktopRuntimeManifest,
  type DesktopModelPreset,
  type DesktopRuntimeManifest,
} from "../../src/desktop/runtime-manifest.js";

type DesktopModelCategory = "checkpoint" | "controlnet" | "lora" | "text_encoder" | "unet" | "vae";

interface DesktopModelCatalogEntry {
  category: DesktopModelCategory;
  destination: string;
  download_url: string | null;
  id: string;
}

export interface DesktopManagedModel extends DesktopModelPreset {
  absolute_path: string;
  category: DesktopModelCategory;
  destination: string;
  download_url: string | null;
  installed: boolean;
}

export interface DesktopRequiredModelStatus {
  completed: boolean;
  installed_ids: string[];
  missing_ids: string[];
  remaining_download_gb: number;
}

const MODEL_CATALOG: Record<string, DesktopModelCatalogEntry> = {
  "flux-q8": {
    category: "checkpoint",
    destination: path.join("checkpoints", "flux_q8.gguf"),
    download_url: null,
    id: "flux-q8",
  },
  "ltx2-q4": {
    category: "unet",
    destination: path.join("unet", "ltx2_i2v_q4.gguf"),
    download_url: null,
    id: "ltx2-q4",
  },
  "sdxl-base": {
    category: "checkpoint",
    destination: path.join("checkpoints", "sd_xl_base_1.0.safetensors"),
    download_url: null,
    id: "sdxl-base",
  },
  "wan22-q4": {
    category: "unet",
    destination: path.join("unet", "wan22_i2v_14b_q4.gguf"),
    download_url: null,
    id: "wan22-q4",
  },
  "wan22-q8": {
    category: "unet",
    destination: path.join("unet", "wan22_i2v_14b_q8.gguf"),
    download_url: null,
    id: "wan22-q8",
  },
};

export class DesktopModelManager {
  private readonly manifest: DesktopRuntimeManifest;

  constructor(input: {
    manifest?: DesktopRuntimeManifest;
  } = {}) {
    this.manifest = input.manifest ?? createDesktopRuntimeManifest();
  }

  listRequiredModels(): DesktopModelPreset[] {
    return [...this.manifest.models.required];
  }

  listOptionalModels(): DesktopModelPreset[] {
    return [...this.manifest.models.optional];
  }

  async getCatalog(): Promise<DesktopManagedModel[]> {
    const presets = [
      ...this.manifest.models.required,
      ...this.manifest.models.optional,
    ];

    return Promise.all(
      presets.map(async (preset) => {
        const catalogEntry = MODEL_CATALOG[preset.id] ?? buildFallbackCatalogEntry(preset.id);
        const absolutePath = path.join(this.manifest.paths.models_dir, catalogEntry.destination);

        return {
          ...preset,
          absolute_path: absolutePath,
          category: catalogEntry.category,
          destination: catalogEntry.destination,
          download_url: catalogEntry.download_url,
          installed: await pathExists(absolutePath),
        };
      }),
    );
  }

  async getRequiredModelStatus(): Promise<DesktopRequiredModelStatus> {
    const catalog = await this.getCatalog();
    const requiredCatalog = catalog.filter((model) => model.required);
    const installed = requiredCatalog.filter((model) => model.installed);
    const missing = requiredCatalog.filter((model) => !model.installed);

    return {
      completed: missing.length === 0,
      installed_ids: installed.map((model) => model.id),
      missing_ids: missing.map((model) => model.id),
      remaining_download_gb: missing.reduce((total, model) => total + model.size_gb, 0),
    };
  }
}

function buildFallbackCatalogEntry(id: string): DesktopModelCatalogEntry {
  return {
    category: "checkpoint",
    destination: path.join("misc", `${id}.bin`),
    download_url: null,
    id,
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
