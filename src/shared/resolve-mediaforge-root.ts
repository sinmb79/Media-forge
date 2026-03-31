import { existsSync } from "node:fs";
import * as path from "node:path";

const ROOT_MARKERS = [
  ["config", "backend-paths.yaml"],
  ["config", "defaults.yaml"],
  ["config", "hardware-profile.yaml"],
] as const;

export function resolveMediaForgeRoot(startDir: string = process.cwd()): string {
  const explicitRoot = process.env.MEDIAFORGE_ROOT?.trim();
  if (explicitRoot) {
    return path.resolve(explicitRoot);
  }

  const initialDir = path.resolve(startDir);
  let currentDir = initialDir;

  while (true) {
    if (ROOT_MARKERS.every((segments) => existsSync(path.resolve(currentDir, ...segments)))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return initialDir;
    }

    currentDir = parentDir;
  }
}

export function resolveMediaForgeConfigFile(
  fileName: string,
  startDir: string = process.cwd(),
): string {
  const rootDir = resolveMediaForgeRoot(startDir);
  const stagedPath = path.resolve(rootDir, "config-stage", fileName);

  if (existsSync(stagedPath)) {
    return stagedPath;
  }

  return path.resolve(rootDir, "config", fileName);
}
