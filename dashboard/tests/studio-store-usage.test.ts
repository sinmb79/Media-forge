import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const componentsRoot = join(process.cwd(), "src", "components");
const unsafeSelectorPattern = /useStudioStore\s*\(\s*\(\s*state\s*\)\s*=>\s*\(\s*\{/m;

test("dashboard components avoid object-literal Zustand selectors that can trigger render loops", () => {
  const offenders = collectFiles(componentsRoot)
    .filter((filePath) => filePath.endsWith(".ts") || filePath.endsWith(".tsx"))
    .filter((filePath) => unsafeSelectorPattern.test(readFileSync(filePath, "utf8")));

  assert.deepEqual(offenders, []);
});

function collectFiles(directoryPath: string): string[] {
  const entries = readdirSync(directoryPath);
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      files.push(...collectFiles(entryPath));
      continue;
    }

    files.push(entryPath);
  }

  return files;
}
