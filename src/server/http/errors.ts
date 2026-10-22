import { DomainError } from "@/domain/errors";
import { GridError } from "@/server/grid/errors";

export class ApiError extends Error {
  constructor(readonly code: string, readonly status: number, message: string, readonly retryable = false, readonly retryAfterSeconds?: number) { super(message); }
}
export function publicFailure(error: unknown, requestId: string): Response {
  let failure = new ApiError("SERVICE_UNAVAILABLE", 503, "This service is temporarily unavailable. Please try again.", true);
  let fieldErrors: readonly { path: string; message: string }[] = [];
  if (error instanceof ApiError) failure = error;
  else if (error instanceof DomainError) {
    failure = new ApiError(error.code, error.code === "COMPARISON_EXPIRED" ? 409 : 422, error.message);
    fieldErrors = error.fieldErrors;
  } else if (error instanceof GridError) failure = new ApiError(error.code, 503, "Forecast data are unavailable. Please try again.", error.retryable);
  return Response.json({ error: { code: failure.code, message: failure.message, retryable: failure.retryable, fieldErrors }, requestId }, {
    status: failure.status, headers: { "Cache-Control": "no-store", ...(failure.status === 429 ? { "Retry-After": String(Math.max(1, Math.min(172800, Math.ceil(failure.retryAfterSeconds ?? 60)))) } : {}) },
  });
}
