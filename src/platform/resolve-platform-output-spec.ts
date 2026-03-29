import type {
  NormalizedRequest,
  PlatformAdjustment,
  PlatformOutputSpec,
  PlatformWarningCode,
} from "../domain/contracts.js";
import { PLATFORM_PROFILES } from "./platform-profiles.js";

export function resolvePlatformOutputSpec(
  request: NormalizedRequest,
): PlatformOutputSpec {
  const profile = PLATFORM_PROFILES[request.derived.resolved_platform_profile];
  const requestedDuration = request.derived.resolved_duration_sec;
  const warnings: PlatformWarningCode[] = [];
  const adjustments: PlatformAdjustment[] = [];
  let effectiveDuration = requestedDuration;

  if (requestedDuration < profile.min_duration_sec) {
    effectiveDuration = profile.min_duration_sec;
    warnings.push("duration_raised_to_platform_min");
    adjustments.push({
      field: "duration_sec",
      from: requestedDuration,
      to: effectiveDuration,
      reason_code: "duration_raised_to_platform_min",
    });
  } else if (requestedDuration > profile.max_duration_sec) {
    effectiveDuration = profile.max_duration_sec;
    warnings.push("duration_clamped_to_platform_max");
    adjustments.push({
      field: "duration_sec",
      from: requestedDuration,
      to: effectiveDuration,
      reason_code: "duration_clamped_to_platform_max",
    });
  }

  return {
    ...profile,
    effective_duration_sec: effectiveDuration,
    warnings,
    adjustments,
  };
}
