import * as path from "node:path";

import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";
import { browseSeedSessions, SeedSessionManager } from "./seed-session.js";

export async function runBrowseVideoSessions(input: {
  rootDir?: string;
  sessionDir?: string;
  sessionsRootDir?: string;
}) {
  const runtimeRoot = path.resolve(input.rootDir ?? process.cwd());
  const storageRoot = resolveMediaForgeRoot(runtimeRoot);

  if (input.sessionDir) {
    const manager = await SeedSessionManager.load(path.resolve(storageRoot, input.sessionDir));
    return {
      manifest: manager.manifest,
      manifest_path: manager.manifestPath,
      session_dir: manager.sessionDir,
      status: "ok" as const,
    };
  }

  const sessionsRootDir = path.resolve(storageRoot, input.sessionsRootDir ?? path.join("workspace", "seeds"));
  const sessions = await browseSeedSessions(sessionsRootDir);

  return {
    root_dir: sessionsRootDir,
    sessions,
    status: "ok" as const,
  };
}
