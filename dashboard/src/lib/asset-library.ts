import { readdir } from "node:fs/promises";
import path from "node:path";

import {
  listForgeAssets,
} from "../../../dist/src/forge/assets/library.js";
import { getMediaForgeRuntime } from "./mediaforge-runtime";

export interface AssetCardRecord {
  category: string;
  description: string;
  id: string;
  kind: "workflow" | "config" | "output" | "library";
  name: string;
  path: string;
}

interface DashboardForgeAssetRecord {
  category: string;
  created_at: string;
  data: Record<string, unknown>;
  id: string;
  is_official: boolean;
  name: string;
  name_ko?: string;
  thumbnail?: string;
  type: string;
  usage_count: number;
}

export async function listAssetCards(): Promise<AssetCardRecord[]> {
  const runtime = getMediaForgeRuntime();
  const workflowDir = path.resolve(runtime.rootDir, "src", "forge", "workflows");
  const configDir = path.resolve(runtime.rootDir, "config");
  const [workflowFiles, configFiles, outputFiles] = await Promise.all([
    safeReadDir(workflowDir),
    safeReadDir(configDir),
    runtime.outputStore.listRecent(8),
  ]);
  const forgeAssets = await listForgeAssets({ rootDir: runtime.rootDir }).catch(() => []);

  return [
    ...buildForgeAssetCards(forgeAssets),
    ...workflowFiles.map((entry) => ({
      category: "Workflow",
      description: "ComfyUI generation workflow",
      id: `workflow:${entry.name}`,
      kind: "workflow" as const,
      name: entry.name,
      path: path.join("src", "forge", "workflows", entry.name),
    })),
    ...configFiles.map((entry) => ({
      category: "Config",
      description: "Local runtime configuration",
      id: `config:${entry.name}`,
      kind: "config" as const,
      name: entry.name,
      path: path.join("config", entry.name),
    })),
    ...outputFiles.map((entry) => ({
      category: "Output",
      description: `${entry.kind} result from the local queue`,
      id: `output:${entry.id}`,
      kind: "output" as const,
      name: entry.name,
      path: entry.relativePath,
    })),
  ];
}

export function buildForgeAssetCards(
  assets: DashboardForgeAssetRecord[],
): AssetCardRecord[] {
  return assets.map((asset) => ({
    category: `Library · ${asset.category}`,
    description: buildForgeAssetDescription(asset),
    id: `library:${asset.id}`,
    kind: "library" as const,
    name: asset.name_ko && asset.name_ko.length > 0
      ? `${asset.name} · ${asset.name_ko}`
      : asset.name,
    path: asset.thumbnail ?? `library/${asset.category}/${asset.id}`,
  }));
}

async function safeReadDir(targetPath: string): Promise<Array<{ name: string }>> {
  try {
    const entries = await readdir(targetPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => ({ name: entry.name }));
  } catch {
    return [];
  }
}

function buildForgeAssetDescription(asset: DashboardForgeAssetRecord): string {
  const summary = typeof asset.data.summary === "string" ? asset.data.summary : null;
  const labels = [
    asset.is_official ? "Official library asset" : "Custom library asset",
    humanizeAssetType(asset.type),
    summary,
  ].filter((value): value is string => Boolean(value));

  return labels.join(" · ");
}

function humanizeAssetType(assetType: string): string {
  return assetType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
