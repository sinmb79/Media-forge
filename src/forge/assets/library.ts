import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import * as path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

const DEFAULT_ASSET_DB = path.join("data", "mediaforge.db");
const SEED_FILES = [
  "characters.json",
  "backgrounds.json",
  "effects.json",
  "motions.json",
  "props.json",
] as const;

export type ForgeAssetCategory =
  | "animals"
  | "backgrounds"
  | "characters"
  | "costumes"
  | "effects"
  | "motions"
  | "props"
  | "other";

export type ForgeAssetType =
  | "character_profile"
  | "lora"
  | "motion_preset"
  | "prompt_preset"
  | "reference_image"
  | "visual_template";

export interface ForgeAssetRecord {
  id: string;
  name: string;
  name_ko?: string;
  category: string;
  type: string;
  data: Record<string, unknown>;
  thumbnail?: string;
  is_official: boolean;
  usage_count: number;
  created_at: string;
}

export interface ForgeAssetMutationInput {
  id?: string;
  name: string;
  name_ko?: string;
  category: ForgeAssetCategory | string;
  type: ForgeAssetType | string;
  data: Record<string, unknown>;
  thumbnail?: string;
  is_official?: boolean;
  rootDir?: string;
  dbPath?: string;
}

export async function listForgeAssets(input: {
  category?: string;
  dbPath?: string;
  rootDir?: string;
  type?: string;
} = {}): Promise<ForgeAssetRecord[]> {
  return withAssetDatabase(input, (db) => {
    const filters: string[] = [];
    const values: Array<string> = [];

    if (input.category) {
      filters.push("category = ?");
      values.push(input.category);
    }

    if (input.type) {
      filters.push("type = ?");
      values.push(input.type);
    }

    const query = [
      "SELECT id, name, name_ko, category, type, data, thumbnail, is_official, usage_count, created_at",
      "FROM assets",
      filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "",
      "ORDER BY is_official DESC, usage_count DESC, name ASC",
    ]
      .filter(Boolean)
      .join(" ");
    const rows = db.prepare(query).all(...values) as unknown as AssetRow[];

    return rows.map(mapAssetRow);
  });
}

export async function getForgeAsset(input: {
  id: string;
  dbPath?: string;
  rootDir?: string;
}): Promise<ForgeAssetRecord | null> {
  return withAssetDatabase(input, (db) => {
    const row = db.prepare(
      "SELECT id, name, name_ko, category, type, data, thumbnail, is_official, usage_count, created_at FROM assets WHERE id = ?",
    ).get(input.id) as AssetRow | undefined;

    return row ? mapAssetRow(row) : null;
  });
}

export async function addForgeAsset(input: ForgeAssetMutationInput): Promise<ForgeAssetRecord> {
  return withAssetDatabase(input, (db) => {
    const id = input.id ?? buildAssetId(input.name);
    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO assets (
        id, name, name_ko, category, type, data, thumbnail, is_official, usage_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.name_ko ?? null,
      input.category,
      input.type,
      JSON.stringify(input.data),
      input.thumbnail ?? null,
      input.is_official ? 1 : 0,
      0,
      createdAt,
    );

    const created: ForgeAssetRecord = {
      category: input.category,
      created_at: createdAt,
      data: input.data,
      id,
      is_official: input.is_official ?? false,
      name: input.name,
      type: input.type,
      usage_count: 0,
      ...(input.name_ko ? { name_ko: input.name_ko } : {}),
      ...(input.thumbnail ? { thumbnail: input.thumbnail } : {}),
    };

    return created;
  });
}

export async function removeForgeAsset(input: {
  id: string;
  dbPath?: string;
  rootDir?: string;
}): Promise<{ id: string; removed: boolean }> {
  return withAssetDatabase(input, (db) => {
    const result = db.prepare("DELETE FROM assets WHERE id = ?").run(input.id);
    return {
      id: input.id,
      removed: (result.changes ?? 0) > 0,
    };
  });
}

export async function seedForgeAssetLibrary(input: {
  dbPath?: string;
  rootDir?: string;
} = {}): Promise<{
  db_path: string;
  seeded_count: number;
  status: "seeded";
}> {
  const rootDir = resolveMediaForgeRoot(input.rootDir ?? process.cwd());
  const seedDir = path.resolve(rootDir, "data", "seeds");
  const seedAssets = (await Promise.all(
    SEED_FILES.map(async (fileName) => {
      try {
        const raw = await readFile(path.resolve(seedDir, fileName), "utf8");
        const parsed = JSON.parse(raw) as Array<ForgeAssetMutationInput>;
        return parsed;
      } catch {
        return [];
      }
    }),
  )).flat();

  const dbPath = resolveAssetDatabasePath(input.rootDir, input.dbPath);
  const seededCount = await withAssetDatabase({ dbPath }, (db) => {
    let inserted = 0;

    for (const asset of seedAssets) {
      const result = db.prepare(`
        INSERT OR IGNORE INTO assets (
          id, name, name_ko, category, type, data, thumbnail, is_official, usage_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        asset.id ?? buildAssetId(asset.name),
        asset.name,
        asset.name_ko ?? null,
        asset.category,
        asset.type,
        JSON.stringify(asset.data),
        asset.thumbnail ?? null,
        asset.is_official === false ? 0 : 1,
        0,
        new Date().toISOString(),
      );
      inserted += Number(result.changes ?? 0);
    }

    return inserted;
  });

  return {
    db_path: dbPath,
    seeded_count: seededCount,
    status: "seeded",
  };
}

function mapAssetRow(row: AssetRow): ForgeAssetRecord {
  const parsedData = parseJsonRecord(row.data);

  return {
    category: row.category,
    created_at: row.created_at,
    data: parsedData,
    id: row.id,
    is_official: Boolean(row.is_official),
    name: row.name,
    type: row.type,
    usage_count: Number(row.usage_count ?? 0),
    ...(typeof row.name_ko === "string" && row.name_ko.length > 0 ? { name_ko: row.name_ko } : {}),
    ...(typeof row.thumbnail === "string" && row.thumbnail.length > 0 ? { thumbnail: row.thumbnail } : {}),
  };
}

async function withAssetDatabase<T>(
  input: {
    dbPath?: string;
    rootDir?: string;
  },
  run: (db: DatabaseSync) => T,
): Promise<T> {
  const dbPath = resolveAssetDatabasePath(input.rootDir, input.dbPath);
  await mkdir(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);

  try {
    initializeAssetSchema(db);
    return run(db);
  } finally {
    db.close();
  }
}

function initializeAssetSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_ko TEXT,
      category TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      thumbnail TEXT,
      is_official INTEGER DEFAULT 1,
      usage_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function resolveAssetDatabasePath(rootDir: string | undefined, dbPath: string | undefined): string {
  if (dbPath) {
    return path.resolve(dbPath);
  }

  const resolvedRoot = resolveMediaForgeRoot(rootDir ?? process.cwd());
  return path.resolve(resolvedRoot, DEFAULT_ASSET_DB);
}

function buildAssetId(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = randomUUID().slice(0, 8);
  return normalized ? `${normalized}-${suffix}` : `asset-${suffix}`;
}

function parseJsonRecord(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

interface AssetRow {
  id: string;
  name: string;
  name_ko: string | null;
  category: string;
  type: string;
  data: string;
  thumbnail: string | null;
  is_official: number;
  usage_count: number;
  created_at: string;
}
