import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export async function prepareDialogueScript(input: {
  outputPath?: string;
  rootDir?: string;
  scriptPath?: string;
  speakerNames: string[];
  stem?: string;
  text?: string;
}): Promise<{
  line_count: number;
  script_path: string;
  speaker_names: string[];
}> {
  const rootDir = input.rootDir ?? resolveMediaForgeRoot();
  const outputPath = input.outputPath ?? path.resolve(rootDir, "outputs", `${input.stem ?? "dialogue"}-script.txt`);
  const raw = input.scriptPath
    ? await readFile(input.scriptPath, "utf8")
    : input.text ?? "";
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const normalizedLines = lines.map((line, index) => {
    if (/^[^:]+:\s+.+$/.test(line)) {
      return line;
    }

    const speaker = input.speakerNames[index % Math.max(1, input.speakerNames.length)] ?? `Speaker ${index + 1}`;
    return `${speaker}: ${line}`;
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${normalizedLines.join("\n")}\n`, "utf8");

  return {
    line_count: normalizedLines.length,
    script_path: outputPath,
    speaker_names: input.speakerNames,
  };
}
