import { readFile } from "node:fs/promises";
import * as path from "node:path";

import { resolveMediaForgeRoot } from "../../shared/resolve-mediaforge-root.js";

export async function loadWorkflowTemplate(
  workflowId: string,
  variables: Record<string, string | number | boolean>,
  rootDir: string = resolveMediaForgeRoot(),
): Promise<unknown> {
  const filePath = path.resolve(resolveMediaForgeRoot(rootDir), "src", "forge", "workflows", `${workflowId}.json`);
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const sanitized = sanitizeOutputPath(variables);
  return substituteTemplateValues(parsed, sanitized);
}

function sanitizeOutputPath(
  variables: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const outputPath = variables.output_path;
  if (typeof outputPath !== "string") return variables;

  const baseName = path.basename(outputPath).replace(/\.[^.]+$/, "");
  return { ...variables, output_path: baseName };
}

function substituteTemplateValues(
  value: unknown,
  variables: Record<string, string | number | boolean>,
): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
      const resolved = variables[key.trim()];
      return resolved === undefined ? "" : String(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => substituteTemplateValues(item, variables));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => {
        return [key, substituteTemplateValues(entryValue, variables)];
      }),
    );
  }

  return value;
}
