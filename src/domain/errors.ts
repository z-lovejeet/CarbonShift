import type { ZodType } from "zod";

export type DomainErrorCode =
  | "INVALID_INPUT" | "INVALID_LOCAL_TIME" | "AMBIGUOUS_LOCAL_TIME" | "NONEXISTENT_LOCAL_TIME"
  | "INVALID_TIME_WINDOW" | "OUTSIDE_PLANNING_HORIZON" | "NO_FEASIBLE_CANDIDATE"
  | "INVALID_BASELINE" | "INVALID_GRID_SNAPSHOT" | "INCOMPLETE_GRID_COVERAGE"
  | "STALE_GRID_SNAPSHOT" | "FUTURE_GRID_SNAPSHOT" | "COMPARISON_EXPIRED"
  | "NUMERIC_OVERFLOW" | "INVALID_REPORT" | "UNSUPPORTED_METHOD";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly fieldErrors: readonly { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function parseDomain<T>(schema: ZodType<T>, input: unknown, code: DomainErrorCode = "INVALID_INPUT"): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new DomainError(code, "Input does not satisfy the domain contract.", result.error.issues.map((issue) => ({
      path: issue.path.join("."), message: issue.message,
    })));
  }
  return result.data;
}
