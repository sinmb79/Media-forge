import { createRequestId } from "../../shared/request-id.js";
import type { ForgeExecutionJob, ForgeRenderPlan } from "../contracts.js";

export interface ForgeExecutionJobInput {
  job_id?: string;
  retryable?: boolean;
  optional?: boolean;
}

export function buildForgeExecutionJob(
  renderPlan: ForgeRenderPlan,
  input: ForgeExecutionJobInput = {},
): ForgeExecutionJob {
  const outputDir = renderPlan.assets.output_dir ?? "output";

  return {
    job_id: input.job_id ?? createRequestId({
      request_id: renderPlan.request_id,
      backend: renderPlan.backend,
      workflow_id: renderPlan.workflow_id,
      assets: renderPlan.assets,
    }).replace(/^req_/, "job_"),
    request_id: renderPlan.request_id,
    backend: renderPlan.backend,
    workflow_id: renderPlan.workflow_id,
    command_args: [
      "--workflow",
      renderPlan.workflow_id,
      "--request-id",
      renderPlan.request_id,
    ],
    inputs: { ...renderPlan.assets },
    outputs: {
      output_dir: outputDir,
    },
    retryable: input.retryable ?? false,
    optional: input.optional ?? false,
  };
}
