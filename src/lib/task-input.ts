import { comparisonRequestSchema, type ComparisonRequest } from "@/contracts/planning";
import { resolveLondonTime, londonTime } from "@/domain/time";
import { energyWhFromKwh } from "@/domain/profile";
import { feasibleStarts, normalizeConstraints } from "@/domain/constraints";
import { DomainError } from "@/domain/errors";
import { METHOD } from "@/domain/method";

export type LocalTimeInput = { date: string; time: string; offsetChoice: "earlier" | "later" | null };
export type TaskDraft = {
  durationMinutes: string; energyKwh: string; energyBasis: "user_estimate" | "illustrative_default";
  earliest: LocalTimeInput; deadline: LocalTimeInput; baselineKind: "earliest_feasible" | "user_selected";
  baseline: LocalTimeInput; blocks: { start: LocalTimeInput; end: LocalTimeInput }[];
};
export type InputIssues = Record<string, string>;
export function initialTaskDraft(nowUtc: string): TaskDraft {
  const date = londonTime(nowUtc).date;
  const blank = () => ({ date, time: "", offsetChoice: null });
  return { durationMinutes: "60", energyKwh: "", energyBasis: "user_estimate", earliest: blank(), deadline: blank(), baselineKind: "earliest_feasible", baseline: blank(), blocks: [] };
}
export function ambiguousLocal(value: LocalTimeInput): boolean {
  try { resolveLondonTime({ ...value, offsetChoice: null }); return false; }
  catch (error) { return error instanceof DomainError && error.code === "AMBIGUOUS_LOCAL_TIME"; }
}
export function buildTaskInput(draft: TaskDraft, nowUtc: string): { data: ComparisonRequest; errors?: never } | { errors: InputIssues; data?: never } {
  const errors: InputIssues = {};
  const resolve = (value: LocalTimeInput, key: string) => {
    try { return resolveLondonTime(value); }
    catch (error) { errors[key] = error instanceof DomainError && error.code !== "INVALID_LOCAL_TIME" ? error.message : "Enter a valid date and time in Europe/London."; return ""; }
  };
  let energyWh = 0;
  try { energyWh = energyWhFromKwh(draft.energyKwh); }
  catch { errors.energy = "Enter 0.05–5 kWh, with at most three decimal places (for example 0.875)."; }
  if (!(METHOD.durationsMinutes as readonly number[]).includes(Number(draft.durationMinutes))) errors.duration = "Choose a duration from 30 to 180 minutes, in 30-minute steps.";
  const earliestStartUtc = resolve(draft.earliest, "earliest"), deadlineUtc = resolve(draft.deadline, "deadline");
  const baselineUtc = draft.baselineKind === "user_selected" ? resolve(draft.baseline, "baseline") : earliestStartUtc;
  if (draft.blocks.length > METHOD.maximumBlocks) errors.blocks = "Use at most four blocked periods.";
  const blockedIntervals = draft.blocks.map((block, i) => ({ startUtc: resolve(block.start, `block-${i}-start`), endUtc: resolve(block.end, `block-${i}-end`) }));
  if (Object.keys(errors).length) return { errors };
  const parsed = comparisonRequestSchema.safeParse({ geography: METHOD.geography, timezone: METHOD.timezone, earliestStartUtc, deadlineUtc, durationMinutes: Number(draft.durationMinutes), energyWh, energyBasis: draft.energyBasis,
    baseline: draft.baselineKind === "user_selected" ? { kind: "user_selected", startUtc: baselineUtc } : { kind: "earliest_feasible" }, blockedIntervals, constraintsConfirmed: true });
  if (!parsed.success) return { errors: { window: "Check the duration, energy basis and start/end of each blocked period. Every period needs a positive length." } };
  try {
    const { baseline: _baseline, constraintsConfirmed: _confirmed, ...fields } = parsed.data;
    void _baseline; void _confirmed;
    const constraints = normalizeConstraints({ ...fields, baselineStartUtc: baselineUtc,
      baselineOrigin: draft.baselineKind === "user_selected" ? "user_selected" : "earliest_feasible_confirmed", confirmedAtUtc: nowUtc });
    const starts = feasibleStarts(constraints, nowUtc);
    if (draft.baselineKind === "user_selected" && !starts.includes(baselineUtc)) return { errors: { baseline: "Choose an available half-hour start inside the window, at least ten minutes ahead, with time for the whole cycle." } };
  } catch (error) {
    if (error instanceof DomainError) return { errors: { window: error.fieldErrors.length ? error.fieldErrors.map((issue) => issue.message).join(" ") : error.message } };
    return { errors: { window: "Check the requested time window and blocked periods." } };
  }
  return { data: parsed.data };
}
