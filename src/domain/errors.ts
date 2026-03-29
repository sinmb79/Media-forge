import type { EngineError, EngineErrorCode, PipelineStage } from "./contracts.js";

export function createEngineError(
  code: EngineErrorCode,
  message: string,
  stage: PipelineStage,
  options?: {
    node_id?: string | null;
    severity?: EngineError["severity"];
    retryable?: boolean;
    details?: Record<string, unknown>;
  },
): EngineError {
  return {
    code,
    message,
    stage,
    node_id: options?.node_id ?? null,
    severity: options?.severity ?? "error",
    retryable: options?.retryable ?? false,
    details: options?.details ?? {},
  };
}
