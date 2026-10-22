import type { ConstraintSuggestion } from "@/contracts/ai";
import type { TaskDraft, LocalTimeInput } from "./task-input";

/** Only explicit, reviewed values replace fields; energy never enters this mapping. */
export function applyTimingSuggestion(draft: TaskDraft, suggestion: ConstraintSuggestion): TaskDraft {
  const local = (before: LocalTimeInput, next: ConstraintSuggestion["earliestLocal"]): LocalTimeInput => {
    const date = next.date ?? before.date, time = next.time ?? before.time;
    return { date, time, offsetChoice: next.offsetChoice ?? (date === before.date && time === before.time ? before.offsetChoice : null) };
  };
  const hasBaseline = suggestion.baselineLocal.date !== null || suggestion.baselineLocal.time !== null;
  return { ...draft, earliest: local(draft.earliest, suggestion.earliestLocal), deadline: local(draft.deadline, suggestion.deadlineLocal),
    durationMinutes: suggestion.durationMinutes === null ? draft.durationMinutes : String(suggestion.durationMinutes),
    baselineKind: hasBaseline ? "user_selected" : draft.baselineKind, baseline: hasBaseline ? local(draft.baseline, suggestion.baselineLocal) : draft.baseline,
    blocks: suggestion.blockedLocal.length ? suggestion.blockedLocal.map((b) => ({ start: { date: b.startDate ?? "", time: b.startTime ?? "", offsetChoice: null }, end: { date: b.endDate ?? "", time: b.endTime ?? "", offsetChoice: null } })) : draft.blocks };
}
export const clarificationCopy = { complete_field: "Complete this field in the form.", clarify_time: "The time is unclear. Choose the intended date and time.", resolve_conflict: "These restrictions conflict. Correct them in the form.", use_manual: "This request needs manual entry within the supported washing-cycle options.", check_london_time: "Check this London time and its clock-change occurrence in the form." } as const;
