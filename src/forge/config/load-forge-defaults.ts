import * as path from "node:path";

import {
  resolveMediaForgeConfigFile,
  resolveMediaForgeRoot,
} from "../../shared/resolve-mediaforge-root.js";
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
  llm?: {
    default_model?: string;
    openclaw_url?: string;
    provider?: "openclaw" | "ollama";
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

export async function loadForgeDefaults(rootDir: string = resolveMediaForgeRoot()): Promise<ForgeDefaultsConfig> {
  const workspaceRoot = resolveMediaForgeRoot(rootDir);
  return loadJsonConfigFile<ForgeDefaultsConfig>(
    resolveMediaForgeConfigFile("defaults.yaml", workspaceRoot),
  );
}
