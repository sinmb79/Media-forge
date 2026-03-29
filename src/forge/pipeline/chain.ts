import { createRequestId } from "../../shared/request-id.js";

export interface PipelineStep {
  name: string;
  backend: string;
  input?: Record<string, string>;
  output?: Record<string, string>;
  optional?: boolean;
  run(context: {
    inputs: Record<string, string>;
    outputs: Record<string, string>;
    stepResults: Record<string, Record<string, string>>;
  }): Promise<Record<string, string>>;
}

export interface PipelineDefinition {
  error_strategy?: "skip_optional_continue" | "fail_fast";
  id: string;
  steps: PipelineStep[];
}

export interface PipelineRunResult {
  id: string;
  outputs: Record<string, string>;
  request_id: string;
  status: "success" | "success_with_warnings" | "failed";
  steps: Array<{
    error?: string;
    name: string;
    outputs: Record<string, string>;
    status: "completed" | "failed" | "skipped";
  }>;
}

export async function runPipelineChain(definition: PipelineDefinition): Promise<PipelineRunResult> {
  const requestId = createRequestId({ definition: definition.id, steps: definition.steps.map((step) => step.name) });
  const stepResults: Record<string, Record<string, string>> = {};
  const outputs: Record<string, string> = {};
  const steps: PipelineRunResult["steps"] = [];
  let warnings = false;

  for (const step of definition.steps) {
    try {
      const resolvedInputs = resolveInputs(step.input ?? {}, stepResults);
      const stepOutput = await step.run({
        inputs: resolvedInputs,
        outputs,
        stepResults,
      });
      const mergedOutputs = { ...(step.output ?? {}), ...stepOutput };
      stepResults[step.name] = mergedOutputs;
      Object.assign(outputs, mergedOutputs);
      steps.push({
        name: step.name,
        outputs: mergedOutputs,
        status: "completed",
      });
    } catch (error) {
      if (step.optional && definition.error_strategy !== "fail_fast") {
        warnings = true;
        steps.push({
          error: error instanceof Error ? error.message : "Unknown error",
          name: step.name,
          outputs: {},
          status: "skipped",
        });
        continue;
      }

      steps.push({
        error: error instanceof Error ? error.message : "Unknown error",
        name: step.name,
        outputs: {},
        status: "failed",
      });
      return {
        id: definition.id,
        outputs,
        request_id: requestId,
        status: "failed",
        steps,
      };
    }
  }

  return {
    id: definition.id,
    outputs,
    request_id: requestId,
    status: warnings ? "success_with_warnings" : "success",
    steps,
  };
}

function resolveInputs(
  input: Record<string, string>,
  stepResults: Record<string, Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (!value.startsWith("$steps.")) {
        return [key, value];
      }

      const [, stepName, outputKey] = value.split(".");
      return [key, stepResults[stepName ?? ""]?.[outputKey ?? ""] ?? ""];
    }),
  );
}
