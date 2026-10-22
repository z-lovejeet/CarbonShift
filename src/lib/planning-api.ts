import { z } from "zod";
import { comparisonDocumentSchema, comparisonViewSchema, planPageSchema, planSchema, type ComparisonRequest } from "@/contracts/planning";

const messages: Record<string, string> = {
  REAUTH_REQUIRED: "Open Account settings and confirm your identity again before deleting private data.",
  INVALID_REPORT: "A run must begin after acceptance and finish before you report it. Report non-execution after the planned finish, or cancel before the planned start.",
  PLAN_CANCELLED: "This plan is cancelled. Create a new plan for another wash.",
  UNAUTHENTICATED: "Your session ended. Sign in again, then retry.",
  NO_FEASIBLE_CANDIDATE: "No complete wash fits these times and blocked periods. Adjust your window or duration.",
  INVALID_BASELINE: "Your usual start must be an available half-hour start inside this window.",
  OUTSIDE_PLANNING_HORIZON: "Choose a finish deadline within the next 48 elapsed hours.",
  COMPARISON_EXPIRED: "This comparison has expired. Compare again and review the new times before saving.",
  VERSION_CONFLICT: "This plan or comparison changed. Reload it before continuing.",
  IDEMPOTENCY_CONFLICT: "This save could not be matched to the reviewed comparison. Return to your plans before starting again.",
  RATE_LIMITED: "You’ve compared several times recently. Keep these fields and try again in a minute.",
  NOT_FOUND: "This private plan or comparison could not be found.",
  INCOMPLETE_GRID_COVERAGE: "We don’t have complete forecast data for this window. Change the deadline or try again.",
  STALE_GRID_SNAPSHOT: "This forecast is too old for a new plan. Compare again for a fresh view.",
};
export class PlanningFailure extends Error {
  constructor(readonly code: string, readonly requestId?: string) {
    super(messages[code] ?? "We couldn’t confirm this request. Your fields are preserved. Please try again.");
  }
}
const failureEnvelope = z.object({ error: z.object({ code: z.string().max(80) }), requestId: z.uuid().optional() });
export async function readPlanningApi<T>(path: string, schema: z.ZodType<T>, body?: unknown, key?: string, method?: "DELETE"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"), credentials: "same-origin", cache: "no-store",
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(key ? { "Idempotency-Key": key } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45_000),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const parsed = failureEnvelope.safeParse(payload);
      throw parsed.success ? new PlanningFailure(parsed.data.error.code, parsed.data.requestId) : new PlanningFailure("SERVICE_UNAVAILABLE");
    }
    const envelope = z.object({ data: schema, requestId: z.uuid() }).safeParse(payload);
    if (!envelope.success) throw new PlanningFailure("INVALID_RESPONSE");
    return envelope.data.data;
  } catch (error) {
    if (error instanceof PlanningFailure) throw error;
    throw new PlanningFailure("NETWORK_UNAVAILABLE");
  }
}
export const planningApi = {
  compare: (input: ComparisonRequest) => readPlanningApi("/comparisons", comparisonDocumentSchema, input),
  comparison: (id: string) => readPlanningApi(`/comparisons/${encodeURIComponent(id)}`, comparisonViewSchema),
  save: (id: string, version: number, key: string) => readPlanningApi("/plans", planSchema, { comparisonId: id, comparisonVersion: version }, key),
  page: (cursor: string) => readPlanningApi(`/plans?limit=20&cursor=${encodeURIComponent(cursor)}`, planPageSchema),
};
