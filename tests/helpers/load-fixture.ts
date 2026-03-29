import { readFile } from "node:fs/promises";
import * as path from "node:path";

export async function loadFixture<T>(name: string): Promise<T> {
  const filePath = path.resolve(process.cwd(), "tests", "fixtures", name);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}
