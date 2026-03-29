import { createHash } from "node:crypto";

export function createRequestId(seed: unknown): string {
  const digest = createHash("sha256")
    .update(stableSerialize(seed))
    .digest("hex")
    .slice(0, 16);

  return `req_${digest}`;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}
