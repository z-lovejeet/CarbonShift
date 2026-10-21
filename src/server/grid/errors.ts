export type GridErrorCode = "INVALID_GRID_REQUEST" | "GRID_UNAVAILABLE" | "GRID_TIMEOUT" |
  "GRID_HTTP_ERROR" | "GRID_RATE_LIMITED" | "INVALID_GRID_RESPONSE" | "GRID_RESPONSE_TOO_LARGE";

/** Safe for application error mapping; never attach provider bodies or credentials. */
export class GridError extends Error {
  constructor(
    public readonly code: GridErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly httpStatus: number | null = null,
    public readonly retryAfterMs: number | null = null,
  ) { super(message); this.name = "GridError"; }
}
