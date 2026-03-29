import { access } from "node:fs/promises";
import * as path from "node:path";

import { loadJsonConfigFile } from "../config/load-json-config.js";
import type {
  ForgeConfigValidationFile,
  ForgePathsValidationResult,
  HardwareProfile,
} from "../contracts.js";
import type { BackendPathCatalog } from "../../backends/types.js";

interface ForgeDefaultsConfig {
  forge?: Record<string, unknown>;
}

export async function validateForgePaths(rootDir: string = process.cwd()): Promise<ForgePathsValidationResult> {
  const files = await Promise.all([
    validateConfigFile<BackendPathCatalog>({
      name: "backend-paths",
      filePath: path.resolve(rootDir, "config", "backend-paths.yaml"),
      validate: (value) => typeof value === "object" && value !== null && typeof value.backends === "object",
    }),
    validateConfigFile<HardwareProfile>({
      name: "hardware-profile",
      filePath: path.resolve(rootDir, "config", "hardware-profile.yaml"),
      validate: (value) => typeof value === "object" && value !== null,
    }),
    validateConfigFile<ForgeDefaultsConfig>({
      name: "defaults",
      filePath: path.resolve(rootDir, "config", "defaults.yaml"),
      validate: (value) => typeof value === "object" && value !== null && typeof value.forge === "object",
    }),
  ]);

  const status = files.some((file) => file.exists === false || file.valid === false)
    ? "error"
    : "ok";

  return {
    schema_version: "0.1",
    status,
    files,
    warnings: files
      .filter((file) => file.exists === false || file.valid === false)
      .map((file) => `${file.name}: ${file.message}`),
  };
}

async function validateConfigFile<T>(input: {
  name: string;
  filePath: string;
  validate(value: T): boolean;
}): Promise<ForgeConfigValidationFile> {
  const exists = await fileExists(input.filePath);

  if (!exists) {
    return {
      name: input.name,
      filePath: input.filePath,
      exists: false,
      valid: false,
      message: "file missing",
    };
  }

  try {
    const parsed = await loadJsonConfigFile<T>(input.filePath);
    const valid = input.validate(parsed);

    return {
      name: input.name,
      filePath: input.filePath,
      exists: true,
      valid,
      message: valid ? "ok" : "invalid structure",
    };
  } catch {
    return {
      name: input.name,
      filePath: input.filePath,
      exists: true,
      valid: false,
      message: "parse failed",
    };
  }
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
