import type { ConfigResult } from "../domain/contracts.js";
import {
  CONFIG_VERSION,
  DEFAULT_PROFILE_ID,
  SUPPORTED_COMMANDS,
  getProfileSummaries,
} from "../config/profile-catalog.js";
import { EXIT_CODE_SUCCESS } from "./exit-codes.js";
import { renderConfigOutput } from "./render-config-output.js";

export async function configEngineCommand(
  options: { json: boolean },
): Promise<{ exitCode: number; output: string }> {
  const result: ConfigResult = {
    schema_version: "0.1",
    config_version: CONFIG_VERSION,
    default_profile: DEFAULT_PROFILE_ID,
    profiles: getProfileSummaries(),
    supported_commands: [...SUPPORTED_COMMANDS],
  };

  return {
    exitCode: EXIT_CODE_SUCCESS,
    output: renderConfigOutput(result, options.json),
  };
}
