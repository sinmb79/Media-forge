import type { ExecutionBackend } from "../../domain/contracts.js";
import type { VideoGenerationAdapter } from "./video-generation-adapter.js";
import { KlingAdapter } from "./kling-adapter.js";
import { LocalAdapter } from "./local-adapter.js";
import { RunwayAdapter } from "./runway-adapter.js";
import { SoraAdapter } from "./sora-adapter.js";

export const ADAPTER_REGISTRY: Record<string, VideoGenerationAdapter> = {
  local: new LocalAdapter(),
  sora: new SoraAdapter(),
  runway: new RunwayAdapter(),
  kling: new KlingAdapter(),
};

const local = ADAPTER_REGISTRY["local"]!;

export async function resolveAdapter(
  backend: ExecutionBackend,
): Promise<VideoGenerationAdapter> {
  switch (backend) {
    case "local":
    case "gpu":
    case "cache":
      return local;

    case "sora": {
      const sora = ADAPTER_REGISTRY["sora"]!;
      return (await sora.isAvailable()) ? sora : local;
    }

    case "premium": {
      const kling = ADAPTER_REGISTRY["kling"]!;
      if (await kling.isAvailable()) return kling;
      const runway = ADAPTER_REGISTRY["runway"]!;
      if (await runway.isAvailable()) return runway;
      const sora = ADAPTER_REGISTRY["sora"]!;
      if (await sora.isAvailable()) return sora;
      return local;
    }

    default:
      return local;
  }
}
