import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

export interface FeedbackEntry {
  id: string;
  timestamp: number;
  theme: string;
  desc_ko: string;
  image_prompt: string;
  video_prompt: string;
  score: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
}

export async function saveFeedback(input: {
  dataDir?: string;
  entry: FeedbackEntry;
}): Promise<FeedbackEntry> {
  const dataDir = input.dataDir ?? path.resolve(process.cwd(), "data", "feedback");
  await mkdir(dataDir, { recursive: true });
  const filePath = path.resolve(dataDir, `${input.entry.id}.json`);
  await writeFile(filePath, `${JSON.stringify(input.entry, null, 2)}\n`, "utf8");
  return input.entry;
}

export async function loadFeedback(dataDir: string = path.resolve(process.cwd(), "data", "feedback")): Promise<FeedbackEntry[]> {
  try {
    const entries = await readdir(dataDir);
    const loaded = await Promise.all(entries
      .filter((entry) => entry.endsWith(".json"))
      .map(async (entry) => {
        const raw = await readFile(path.resolve(dataDir, entry), "utf8");
        return JSON.parse(raw) as FeedbackEntry;
      }));

    return loaded.sort((left, right) => right.timestamp - left.timestamp);
  } catch {
    return [];
  }
}

export async function getSuccessPatterns(
  dataDir: string = path.resolve(process.cwd(), "data", "feedback"),
  theme?: string,
): Promise<FeedbackEntry[]> {
  const entries = await loadFeedback(dataDir);
  return entries.filter((entry) => entry.score >= 4 && (!theme || entry.theme === theme));
}

export async function getFailurePatterns(
  dataDir: string = path.resolve(process.cwd(), "data", "feedback"),
  theme?: string,
): Promise<FeedbackEntry[]> {
  const entries = await loadFeedback(dataDir);
  return entries.filter((entry) => entry.score <= 2 && (!theme || entry.theme === theme));
}
