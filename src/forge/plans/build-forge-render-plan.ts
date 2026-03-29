import type { BackendName } from "../../backends/types.js";
import type { ForgePromptPlan, ForgeRenderPlan } from "../contracts.js";

export interface ForgeRenderPlanInput {
  backend: BackendName;
  workflow_id: string;
  assets: Record<string, string>;
}

export function buildForgeRenderPlan(
  promptPlan: ForgePromptPlan,
  input: ForgeRenderPlanInput,
): ForgeRenderPlan {
  return {
    request_id: promptPlan.request_id,
    mode: promptPlan.mode,
    backend: input.backend,
    workflow_id: input.workflow_id,
    prompt_plan: promptPlan,
    assets: { ...input.assets },
  };
}
