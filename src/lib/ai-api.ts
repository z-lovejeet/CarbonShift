import { suggestionShape, explanationDocumentSchema, type ConstraintSuggestion, type ExplanationDocument } from "@/contracts/ai";
import type { z } from "zod";
export class AiFailure extends Error {
  constructor(readonly code: string, readonly retryAfterSeconds: number | null = null) {
    super(code === "AI_RATE_LIMITED" || code === "RATE_LIMITED" ? "AI is busy or its allowance is used. Your manual fields are ready to use." : code.startsWith("AI_TASK_") ? "This request has already started or finished. Review your manual fields, or deliberately start a new AI request." : code === "AI_REFERENCE_DATE_CHANGED" ? "The London date changed. Review your text and start a new request." : "AI could not provide a checked answer. Your text and manual fields are kept here.");
  }
}
async function send<T>(path: string, body: unknown, key: string, schema: z.ZodType<T>): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/v1${path}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "AI-Task-Key": key }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) }); }
  catch { throw new AiFailure("AI_UNAVAILABLE"); }
  let result: { data?: unknown; error?: { code?: string } };
  try { result = await response.json(); } catch { throw new AiFailure("AI_UNAVAILABLE"); }
  if (!response.ok) {
    const retry = response.headers.get("retry-after");
    throw new AiFailure(result.error?.code ?? "AI_UNAVAILABLE", response.status === 429 && retry && /^\d+$/.test(retry) ? Math.max(1, Math.min(172800, Number(retry))) : null);
  }
  const parsed = schema.safeParse(result.data); if (!parsed.success) throw new AiFailure("AI_INVALID_OUTPUT"); return parsed.data;
}
export const aiApi = {
  constraints: (text: string, localReferenceDate: string, key: string): Promise<ConstraintSuggestion> => send("/ai/constraints", { text, localReferenceDate, timezone: "Europe/London", aiConsent: true }, key, suggestionShape),
  explanation: (id: string, key: string): Promise<ExplanationDocument> => send(`/comparisons/${encodeURIComponent(id)}/explanation`, { aiConsent: true }, key, explanationDocumentSchema),
};
