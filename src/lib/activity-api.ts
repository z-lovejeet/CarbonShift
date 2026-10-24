import { z } from "zod";
export class ActivityApiError extends Error { constructor(readonly code: string, message: string, readonly retryAfter: number | null = null, readonly fieldErrors: readonly { path: string; message: string }[] = []) { super(message); } }
export async function activityRequest<T>(path: string, schema: z.ZodType<T>, body?: unknown, options: { signal?: AbortSignal; taskKey?: string; idempotencyKey?: string; method?: "DELETE" } = {}): Promise<T> {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000);
  const response = await fetch(`/api/v2${path}`, { method: options.method ?? (body === undefined ? "GET" : "POST"), credentials: "same-origin", cache: "no-store", signal,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(options.taskKey ? { "AI-Task-Key": options.taskKey } : {}), ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data: unknown = await response.json();
  if (!response.ok) {
    const failure = z.object({ error: z.object({ code: z.string().max(100), message: z.string().max(1000), fieldErrors: z.array(z.object({ path: z.string().max(200), message: z.string().max(1000) })).max(128).optional() }) }).safeParse(data);
    throw new ActivityApiError(failure.success ? failure.data.error.code : "UNAVAILABLE", failure.success ? failure.data.error.message : "This request could not be completed. Your inputs are preserved.", response.headers.has("Retry-After") ? Number(response.headers.get("Retry-After")) : null, failure.success ? failure.data.error.fieldErrors ?? [] : []);
  }
  return z.object({ data: schema, requestId: z.uuid() }).parse(data).data;
}
