import * as path from "node:path";

import { loadJsonConfigFile } from "./load-json-config.js";

export interface ForgeDefaultsConfig {
  forge?: {
    output_dir?: string;
    workspace_cache_dir?: string;
  };
  comfyui?: {
    auto_start?: boolean;
    default_port?: number;
  };
  ollama?: {
    default_model?: string;
    default_port?: number;
  };
  video?: {
    default_duration_sec?: number;
    default_quality?: string;
  };
}

export async function loadForgeDefaults(rootDir: string = process.cwd()): Promise<ForgeDefaultsConfig> {
  return loadJsonConfigFile<ForgeDefaultsConfig>(
    path.resolve(rootDir, "config", "defaults.yaml"),
  );
}
