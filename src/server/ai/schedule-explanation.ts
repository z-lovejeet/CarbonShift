import "server-only";
import { scheduleExplanationSchema } from "@/contracts/activity-ai";
import { selectedSchedule, type ScheduleDocument } from "@/contracts/schedules";
export type ScheduleCode = ReturnType<typeof scheduleExplanationSchema.parse>["codes"][number];
export function scheduleFacts(plan: ScheduleDocument) {
  const option = selectedSchedule(plan), input = plan.comparison.input;
  const eligible: ScheduleCode[] = [plan.comparison.solution.baseline.estimatedMg > option.estimatedMg ? "LOWER_ESTIMATE" : "NO_IMPROVEMENT_FOUND"];
  if (input.tasks.some((t) => t.fixedStartUtc)) eligible.push("FIXED_TIMES_RETAINED");
  if (input.tasks.some((t) => t.predecessorIds.length)) eligible.push("DEPENDENCIES_RESPECTED");
  if (plan.comparison.solution.search.status === "best_found") eligible.push("SEARCH_LIMITED");
  return { eligibleCodes: eligible, requiredCodes: eligible.includes("SEARCH_LIMITED") ? ["SEARCH_LIMITED"] as ScheduleCode[] : [] };
}
export function validateScheduleExplanation(raw: unknown, facts: { eligibleCodes: ScheduleCode[]; requiredCodes: ScheduleCode[] }) {
  const parsed = scheduleExplanationSchema.parse(raw);
  if (!parsed.codes.length || new Set(parsed.codes).size !== parsed.codes.length || parsed.codes.some((c) => !facts.eligibleCodes.includes(c)) || facts.requiredCodes.some((c) => !parsed.codes.includes(c))) throw new Error("Explanation does not match computed facts.");
  return parsed;
}
const copy: Record<ScheduleCode, string> = {
  LOWER_ESTIMATE: "The selected complete schedule has a lower grid CO₂ estimate than your reviewed usual times, with the same task energy and duration.",
  NO_IMPROVEMENT_FOUND: "This option does not reduce the estimate from your usual times. You can keep your baseline or review the available windows.",
  FIXED_TIMES_RETAINED: "Your fixed appointments remain at their confirmed times.", DEPENDENCIES_RESPECTED: "Each task starts after its declared predecessors finish.",
  WINDOW_TOO_SHORT: "The window is too short for the complete task. Extend it or choose another available period.", RESOURCE_CONFLICT: "Tasks sharing equipment or your attention must not overlap.",
  WIDER_WINDOW_AVAILABLE: "A separate wider-window proposal is available for review. It has not changed your current constraints.", DATA_MISSING: "Complete grid data is unavailable for this period, so a complete CO₂ comparison is unavailable.",
  SEARCH_LIMITED: "The search reached its limit. This schedule is feasible, and a better schedule may exist.",
};
export function scheduleSentences(codes: ScheduleCode[]) { return [...codes.map((c) => copy[c]), "Energy is based on your reviewed inputs and the Great Britain national grid forecast. These are estimates; equipment operation is not measured or controlled."]; }
