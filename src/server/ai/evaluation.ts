import "server-only";
import { z } from "zod";
import { parseAiPolicy, candidates } from "@/config/ai-policy";
import { AI_REGISTRY, type AiRole, type ModelId } from "@/config/ai-registry";
import { ConfigurationError, type EnvironmentSource } from "@/config/environment";
import type { ConstraintSuggestion } from "@/contracts/ai";
export const evaluationDatasetSchema = z.object({ schemaVersion: z.literal(1), datasetVersion: z.string(), authored: z.literal(true), humanReviewed: z.boolean(), cases: z.array(z.strictObject({
  id: z.string(), family: z.string(), text: z.string().max(1000), localReferenceDate: z.string(), timezone: z.literal("Europe/London"),
  expectedFields: z.record(z.string(), z.union([z.string(), z.number(), z.null()])), requiredQuestions: z.array(z.string()), unsupportedRequests: z.array(z.string()), criticalFields: z.array(z.string()),
})).min(1).max(60) });
export type EvaluationCase = z.infer<typeof evaluationDatasetSchema>["cases"][number];
export function evaluationConfiguration(source: EnvironmentSource, model: ModelId, role: AiRole) {
  try {
    const policy = parseAiPolicy(source.AI_POLICY_JSON ?? "");
    const selected = candidates(policy, role, true).find((m) => m.id === model);
    if (!selected || (AI_REGISTRY[model].provider === "gemini" && policy.profile !== "eligible_free_development")) throw new Error();
    if (!source.RATE_LIMIT_HMAC_SECRET || source.RATE_LIMIT_HMAC_SECRET.length < 32 || !source.NEXT_PUBLIC_SUPABASE_URL?.startsWith("https://") || !source.SUPABASE_SECRET_KEY || !source.GROQ_API_KEY || (AI_REGISTRY[model].provider === "gemini" && !source.GEMINI_API_KEY)) throw new Error();
    return { policy, hmac: source.RATE_LIMIT_HMAC_SECRET, databaseUrl: source.NEXT_PUBLIC_SUPABASE_URL, databaseSecret: source.SUPABASE_SECRET_KEY,
      geminiApiKey: source.GEMINI_API_KEY ?? null, groqApiKey: source.GROQ_API_KEY };
  } catch { throw new ConfigurationError(["AI evaluation access/verified free policy/credentials"]); }
}
function atPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((part, key) => part !== null && typeof part === "object" ? Reflect.get(part, key) : undefined, value);
}
export function scoreSuggestion(c: EvaluationCase, suggestion: ConstraintSuggestion | null) {
  const fields = Object.entries(c.expectedFields), wrong = fields.filter(([key, expected]) => atPath(suggestion, key) !== expected).map(([key]) => key);
  const questions = new Set(suggestion?.questions.map((q) => q.field) ?? []), missedQuestions = c.requiredQuestions.filter((field) => !questions.has(field as ConstraintSuggestion["questions"][number]["field"]));
  const missedUnsupported = c.unsupportedRequests.filter((code) => !(suggestion?.unsupportedRequests as string[] | undefined)?.includes(code));
  const extraUnsupported = suggestion?.unsupportedRequests.filter((code) => !c.unsupportedRequests.includes(code)) ?? [];
  const unsupportedCorrect = suggestion !== null && !missedUnsupported.length && !extraUnsupported.length;
  const extraBlockFields = (suggestion?.blockedLocal ?? []).flatMap((b, i) => Object.entries(b).filter(([key, value]) => value !== null && !(`${"blockedLocal"}.${i}.${key}` in c.expectedFields)).map(([key]) => `blockedLocal.${i}.${key}`));
  const negatives = ["earliestLocal", "deadlineLocal", "durationMinutes"].filter((field) => !c.requiredQuestions.includes(field) && (field === "durationMinutes" ? typeof c.expectedFields[field] === "number" : typeof c.expectedFields[`${field}.date`] === "string" && typeof c.expectedFields[`${field}.time`] === "string"));
  return { fields: fields.length + 1 + extraBlockFields.length, correctFields: fields.length - wrong.length + (unsupportedCorrect ? 1 : 0), wrongFields: [...wrong, ...extraBlockFields, ...(unsupportedCorrect ? [] : ["unsupportedRequests"])], criticalCorrect: suggestion !== null && !wrong.some((f) => c.criticalFields.includes(f)) && missedQuestions.length === 0 && unsupportedCorrect && extraBlockFields.length === 0,
    requiredQuestions: c.requiredQuestions.length, detectedQuestions: c.requiredQuestions.length - missedQuestions.length,
    negativeQuestions: negatives.length, falseQuestions: negatives.filter((f) => questions.has(f as ConstraintSuggestion["questions"][number]["field"])).length,
    missedQuestions, missedUnsupported, extraUnsupported, correctionsNeeded: wrong.length + extraBlockFields.length + missedQuestions.length + (unsupportedCorrect ? 0 : 1) };
}
export function percentile(samples: number[], quantile: number): number | null {
  const ordered = [...samples].sort((a, b) => a - b); return ordered.length ? ordered[Math.max(0, Math.ceil(ordered.length * quantile) - 1)]! : null;
}
