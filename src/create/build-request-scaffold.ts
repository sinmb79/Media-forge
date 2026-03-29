import type { CreateResult } from "../domain/contracts.js";
import { getRequestProfile } from "../config/profile-catalog.js";

export function buildRequestScaffold(profileId: string, outputPath: string): CreateResult {
  const profile = getRequestProfile(profileId);

  if (!profile) {
    throw new Error(`Unknown profile: ${profileId}`);
  }

  return {
    schema_version: "0.1",
    profile: profile.profile_id,
    output_path: outputPath,
    request: profile.request,
  };
}
