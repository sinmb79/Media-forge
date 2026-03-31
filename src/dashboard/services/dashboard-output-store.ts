import { readdir, stat } from "node:fs/promises";
import * as path from "node:path";

import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export type DashboardOutputKind = "image" | "video" | "audio" | "text" | "file";

export interface DashboardOutputRecord {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  extension: string;
  kind: DashboardOutputKind;
  modifiedAt: string;
  sizeBytes: number;
  url: string;
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".webm", ".avi"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".flac", ".ogg"]);
const TEXT_EXTENSIONS = new Set([".json", ".txt", ".srt", ".md", ".yaml", ".yml"]);

export class DashboardOutputStore {
  constructor(
    private readonly rootDir: string = resolveMediaForgeRoot(),
    private readonly outputsDirName: string = "outputs",
  ) {}

  async listRecent(limit: number = 24): Promise<DashboardOutputRecord[]> {
    const outputsDir = path.resolve(this.rootDir, this.outputsDirName);

    try {
      const entries = await readdir(outputsDir, { withFileTypes: true });
      const records: DashboardOutputRecord[] = [];

      for (const entry of entries) {
        if (!entry.isFile()) {
          continue;
        }

        const absolutePath = path.resolve(outputsDir, entry.name);
        const details = await stat(absolutePath);
        const extension = path.extname(entry.name).toLowerCase();
        const relativePath = entry.name;

        records.push({
          id: `${entry.name}:${details.mtimeMs}`,
          name: entry.name,
          path: absolutePath,
          relativePath,
          extension,
          kind: classifyOutput(extension),
          modifiedAt: details.mtime.toISOString(),
          sizeBytes: details.size,
          url: `/outputs/${encodeURIComponent(relativePath).replace(/%2F/gi, "/")}`,
        });
      }

      return records
        .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  getOutputsRoot(): string {
    return path.resolve(this.rootDir, this.outputsDirName);
  }
}

function classifyOutput(extension: string): DashboardOutputKind {
  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }

  if (AUDIO_EXTENSIONS.has(extension)) {
    return "audio";
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }

  return "file";
}
