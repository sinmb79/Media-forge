import { readFile } from "node:fs/promises";

export async function loadJsonConfigFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}
