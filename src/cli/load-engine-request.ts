import { readFile } from "node:fs/promises";

import type { EngineRequest, ValidationResult } from "../domain/contracts.js";
import { validateEngineRequest } from "../domain/request-schema.js";
import { createRequestId } from "../shared/request-id.js";

export interface LoadedEngineRequest {
  request_id: string;
  raw_request: unknown;
  request: EngineRequest | null;
  validation: ValidationResult;
}

export async function loadEngineRequest(requestPath: string): Promise<LoadedEngineRequest> {
  const rawFile = await readFile(requestPath, "utf8");
  const rawRequest = JSON.parse(rawFile) as unknown;
  const validation = validateEngineRequest(rawRequest);

  return {
    request_id: createRequestId(rawRequest),
    raw_request: rawRequest,
    request: validation.valid ? (rawRequest as EngineRequest) : null,
    validation,
  };
}
