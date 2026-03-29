import { buildPromptResult } from "../prompt/build-prompt-result.js";
import { createRequestId } from "../shared/request-id.js";
import {
  EXIT_CODE_INTERNAL_ERROR,
  EXIT_CODE_SUCCESS,
  EXIT_CODE_VALIDATION_FAILURE,
} from "./exit-codes.js";
import { loadEngineRequest } from "./load-engine-request.js";
import { renderOutput } from "./render-output.js";
import { renderPromptOutput } from "./render-prompt-output.js";
import { resolvePlanningContext } from "./resolve-planning-context.js";

export async function promptEngineCommand(
  requestPath: string,
  options: { json: boolean },
): Promise<{ exitCode: number; output: string }> {
  let requestId = createRequestId({ request_path: requestPath });

  try {
    const loaded = await loadEngineRequest(requestPath);
    requestId = loaded.request_id;

    if (!loaded.validation.valid || !loaded.request) {
      return {
        exitCode: EXIT_CODE_VALIDATION_FAILURE,
        output: renderOutput(
          {
            schema_version: "0.1",
            request_id: requestId,
            validation: loaded.validation,
            normalized_request: null,
            platform_output_spec: null,
            novel_shorts_plan: null,
            motion_plan: null,
            broll_plan: null,
            learning_state: null,
            scoring: null,
            routing: null,
            execution_plan: null,
            recovery_simulation: null,
          },
          options.json,
        ),
      };
    }

    const planningContext = resolvePlanningContext(loaded.request);
    const promptResult = buildPromptResult({
      brollPlan: planningContext.broll_plan,
      effectiveRequest: planningContext.effective_request,
      learningState: planningContext.learning_state,
      motionPlan: planningContext.motion_plan,
      novelShortsPlan: planningContext.novel_shorts_plan,
      platformOutputSpec: planningContext.platform_output_spec,
      routing: planningContext.routing,
      scoring: planningContext.scoring,
    });

    return {
      exitCode: EXIT_CODE_SUCCESS,
      output: renderPromptOutput(promptResult, options.json),
    };
  } catch (error) {
    return {
      exitCode: EXIT_CODE_INTERNAL_ERROR,
      output: options.json
        ? JSON.stringify(
            {
              fatal_error: error instanceof Error ? error.message : "Unknown error",
            },
            null,
            2,
          )
        : `Fatal error: ${error instanceof Error ? error.message : "Unknown error"}\n`,
    };
  }
}
