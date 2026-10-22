import "server-only";
import { suggestionShape, explanationSelectionSchema, type ConstraintSuggestion, type ExplanationSelection } from "@/contracts/ai";
import { resolveLondonTime } from "@/domain/time";
import { DomainError } from "@/domain/errors";
import { METHOD } from "@/domain/method";
import type { ComparisonDocument } from "@/contracts/planning";
import { ApiError } from "@/server/http/errors";

export function validateSuggestion(raw: unknown, text: string): ConstraintSuggestion {
  const value = suggestionShape.parse(raw);
  for (const span of value.sourceSpans) {
    // Reject split surrogate pairs as well as out-of-range/empty support.
    const split = (i: number) => i > 0 && i < text.length && /[\uD800-\uDBFF]/.test(text[i - 1]!) && /[\uDC00-\uDFFF]/.test(text[i]!);
    if (span.start >= span.end || span.end > text.length || split(span.start) || split(span.end) || !/[\p{L}\p{N}]/u.test(text.slice(span.start, span.end))) throw new ApiError("AI_INVALID_OUTPUT", 503, "The suggestion could not be checked. Use the manual fields.");
  }
  const ask = (field: ConstraintSuggestion["questions"][number]["field"], code: ConstraintSuggestion["questions"][number]["code"], messageKey: ConstraintSuggestion["questions"][number]["messageKey"]) => {
    if (!value.questions.some((q) => q.field === field && q.code === code)) value.questions.push({ field, code, messageKey });
  };
  const supported = (field: ConstraintSuggestion["sourceSpans"][number]["field"]) => {
    if (!value.sourceSpans.some((s) => s.field === field)) throw new ApiError("AI_INVALID_OUTPUT", 503, "The suggestion has no supporting text. Use the manual fields.");
  };
  for (const field of ["earliestLocal", "deadlineLocal", "baselineLocal"] as const) {
    const local = value[field];
    if (local.date || local.time || local.offsetChoice) supported(field);
    if ((!local.date || !local.time) && field !== "baselineLocal") ask(field, "missing", "complete_field");
    if (local.date && local.time) {
      try { resolveLondonTime(local); }
      catch (error) {
        if (!(error instanceof DomainError)) throw error;
        ask(field, error.code === "AMBIGUOUS_LOCAL_TIME" ? "ambiguous" : "invalid_time", "check_london_time");
      }
    }
  }
  if (value.durationMinutes !== null) {
    supported("durationMinutes");
    if (!(METHOD.durationsMinutes as readonly number[]).includes(value.durationMinutes)) ask("durationMinutes", "unsupported", "use_manual");
  } else ask("durationMinutes", "missing", "complete_field");
  if (value.blockedLocal.length) supported("blockedLocal");
  for (const block of value.blockedLocal) {
    if (!block.startDate || !block.startTime || !block.endDate || !block.endTime) { ask("blockedLocal", "missing", "complete_field"); continue; }
    try {
      const start = resolveLondonTime({ date: block.startDate, time: block.startTime, offsetChoice: null });
      const end = resolveLondonTime({ date: block.endDate, time: block.endTime, offsetChoice: null });
      if (end <= start) ask("blockedLocal", "contradictory", "resolve_conflict");
    } catch { ask("blockedLocal", "ambiguous", "check_london_time"); }
  }
  const a = value.earliestLocal, b = value.deadlineLocal;
  if (a.date && a.time && b.date && b.time && `${a.date}T${a.time}` >= `${b.date}T${b.time}`) ask("deadlineLocal", "contradictory", "resolve_conflict");
  if (a.date && a.time && b.date && b.time && value.durationMinutes !== null) {
    try { if (Date.parse(resolveLondonTime(b)) - Date.parse(resolveLondonTime(a)) < value.durationMinutes * 60000) ask("deadlineLocal", "contradictory", "resolve_conflict"); }
    catch { /* The explicit clock-change question above remains authoritative. */ }
  }
  // Additional validation questions are code-owned, bounded, and never a reason to reroute ambiguity.
  return suggestionShape.parse(value);
}

export function explanationFacts(comparison: ComparisonDocument) {
  const reasons: ExplanationSelection["reasonCodes"] = [comparison.differenceMg > 0 ? "LOWER_FORECAST_ESTIMATE" : "BASELINE_ALREADY_BEST", "DEADLINE_MET"];
  if (comparison.constraints.blockedIntervals.length) reasons.push("BLOCKED_PERIODS_AVOIDED");
  return { classification: comparison.differenceMg > 0 ? "lower_forecast" : "baseline_best", deadlineMet: true, blocksAvoided: comparison.constraints.blockedIntervals.length > 0,
    energyBasis: comparison.constraints.energyBasis, geography: "GB_national", eligibleReasonCodes: reasons,
    eligibleLimitationCodes: ["ASSUMED_ENERGY", "NATIONAL_SIGNAL", "SELF_REPORTED"] as ExplanationSelection["limitationCodes"], requiredLimitationCodes: ["ASSUMED_ENERGY", "NATIONAL_SIGNAL"] as ExplanationSelection["limitationCodes"] };
}
export type ExplanationFacts = ReturnType<typeof explanationFacts>;
export function validateExplanation(raw: unknown, facts: ExplanationFacts): ExplanationSelection {
  const value = explanationSelectionSchema.parse(raw);
  if (value.reasonCodes.some((c) => !facts.eligibleReasonCodes.includes(c)) || value.limitationCodes.some((c) => !facts.eligibleLimitationCodes.includes(c)) || facts.requiredLimitationCodes.some((c) => !value.limitationCodes.includes(c))) throw new ApiError("AI_INVALID_OUTPUT", 503, "The explanation could not be checked.");
  return value;
}
export function templateSelection(facts: ExplanationFacts): ExplanationSelection {
  return { schemaVersion: 1, reasonCodes: facts.eligibleReasonCodes.slice(0, 3), limitationCodes: facts.requiredLimitationCodes };
}
export function explanationSentences(selection: ExplanationSelection, comparison: ComparisonDocument): string[] {
  const copy: Record<string, string> = {
    LOWER_FORECAST_ESTIMATE: `This time has a forecast estimate ${(comparison.differenceMg / 1000).toLocaleString("en-GB", { maximumFractionDigits: 3 })} g CO₂ lower than your reviewed baseline, under the same assumed energy profile.`,
    BASELINE_ALREADY_BEST: "Your baseline already has the lowest forecast estimate among the available times.",
    DEADLINE_MET: "The entire cycle fits before your finish deadline.", BLOCKED_PERIODS_AVOIDED: "The cycle avoids your blocked periods.",
    ASSUMED_ENERGY: "Cycle energy and its uniform profile are assumptions, not measurements.", NATIONAL_SIGNAL: "This uses the Great Britain national grid signal, not a household or local measurement.",
    SELF_REPORTED: "You operate the appliance yourself; execution is unverified.", ACTUAL_PENDING: "Updated grid factors are not yet available.",
  };
  return [...selection.reasonCodes, ...selection.limitationCodes].map((code) => copy[code]!);
}
