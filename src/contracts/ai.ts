import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const local = z.strictObject({ date: date.nullable(), time: time.nullable(), offsetChoice: z.enum(["earlier", "later"]).nullable() });
const field = z.enum(["earliestLocal", "deadlineLocal", "baselineLocal", "blockedLocal", "durationMinutes"]);
export const suggestionShape = z.strictObject({
  schemaVersion: z.literal(1), earliestLocal: local, deadlineLocal: local, baselineLocal: local,
  blockedLocal: z.array(z.strictObject({ startDate: date.nullable(), startTime: time.nullable(), endDate: date.nullable(), endTime: time.nullable() })).max(4),
  durationMinutes: z.number().int().min(1).max(1440).nullable(),
  questions: z.array(z.strictObject({ field, code: z.enum(["missing", "ambiguous", "contradictory", "unsupported", "invalid_time"]), messageKey: z.enum(["complete_field", "clarify_time", "resolve_conflict", "use_manual", "check_london_time"]) })).max(10),
  sourceSpans: z.array(z.strictObject({ field, start: z.number().int().nonnegative().max(1000), end: z.number().int().positive().max(1000) })).max(24),
  unsupportedRequests: z.array(z.enum(["automatic_control", "tariff", "other_appliance", "other"])).max(4),
});
export type ConstraintSuggestion = z.infer<typeof suggestionShape>;
export const reasonCodes = ["LOWER_FORECAST_ESTIMATE", "BASELINE_ALREADY_BEST", "DEADLINE_MET", "BLOCKED_PERIODS_AVOIDED"] as const;
export const limitationCodes = ["ASSUMED_ENERGY", "NATIONAL_SIGNAL", "SELF_REPORTED", "ACTUAL_PENDING"] as const;
export const explanationSelectionSchema = z.strictObject({ schemaVersion: z.literal(1),
  reasonCodes: z.array(z.enum(reasonCodes)).max(3).refine((v) => new Set(v).size === v.length),
  limitationCodes: z.array(z.enum(limitationCodes)).min(1).max(3).refine((v) => new Set(v).size === v.length) });
export type ExplanationSelection = z.infer<typeof explanationSelectionSchema>;
export const constraintsRequestSchema = z.strictObject({ text: z.string().min(1).max(1000).refine((text) => text.trim().length > 0), localReferenceDate: date, timezone: z.literal("Europe/London"), aiConsent: z.literal(true) });
export const explanationRequestSchema = z.strictObject({ aiConsent: z.literal(true) });
export const explanationDocumentSchema = z.strictObject({ selection: explanationSelectionSchema, sentences: z.array(z.string().max(500)).max(6), source: z.enum(["ai", "cache", "template"]) });
export type ExplanationDocument = z.infer<typeof explanationDocumentSchema>;
