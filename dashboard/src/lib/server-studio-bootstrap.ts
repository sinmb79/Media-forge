import type { DashboardOutputRecord, StudioBootstrapPayload } from "./mediaforge-types";
import { listAssetCards } from "./asset-library";
import { getMediaForgeRuntime } from "./mediaforge-runtime";

export async function loadStudioBootstrap(): Promise<StudioBootstrapPayload> {
  const runtime = getMediaForgeRuntime();
  const [health, assets, outputs] = await Promise.all([
    runtime.healthService.getSnapshot(),
    listAssetCards(),
    runtime.outputStore.listRecent(),
  ]);

  return {
    assets,
    health,
    jobs: runtime.jobQueue.listJobs(),
    outputs: outputs as DashboardOutputRecord[],
  };
}
