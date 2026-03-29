import { spawnSync } from "node:child_process";

export interface MemoryOptimizationInput {
  freeVramGb: number | null;
  model: "wan22" | "sdxl" | "ltx2" | "propainter";
}

export interface MemoryOptimizationPlan {
  estimated_vram_gb: number;
  flags: string[];
  offload_mode: "cpu" | "none";
  selected_profile: "cpu_offload" | "q4" | "q8";
}

const MODEL_VRAM_TABLE = {
  ltx2: { q4: 10, q8: 14 },
  propainter: { q4: 6, q8: 8 },
  sdxl: { q4: 8, q8: 12 },
  wan22: { q4: 8, q8: 14 },
} as const;

export function optimizeMemoryPlan(input: MemoryOptimizationInput): MemoryOptimizationPlan {
  const freeVramGb = input.freeVramGb ?? 0;
  const profile = MODEL_VRAM_TABLE[input.model];

  if (freeVramGb >= profile.q8) {
    return {
      estimated_vram_gb: profile.q8,
      flags: [],
      offload_mode: "none",
      selected_profile: "q8",
    };
  }

  if (freeVramGb >= profile.q4) {
    return {
      estimated_vram_gb: profile.q4,
      flags: ["--lowvram"],
      offload_mode: "none",
      selected_profile: "q4",
    };
  }

  return {
    estimated_vram_gb: profile.q4,
    flags: ["--novram"],
    offload_mode: "cpu",
    selected_profile: "cpu_offload",
  };
}

export function detectAvailableVramGb(): number | null {
  try {
    const result = spawnSync(
      "nvidia-smi",
      [
        "--query-gpu=memory.free",
        "--format=csv,noheader,nounits",
      ],
      {
        encoding: "utf8",
      },
    );

    if (result.status !== 0) {
      return null;
    }

    const values = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => Number(line))
      .filter((value) => Number.isFinite(value));

    if (values.length === 0) {
      return null;
    }

    return Number((Math.max(...values) / 1024).toFixed(2));
  } catch {
    return null;
  }
}
