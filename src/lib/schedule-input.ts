import { scheduleInputSchema, type ScheduleInputV2, type ReferenceProfileV2, type ActivityInputV2 } from "@/domain/activities/schemas";
import { compileActivity, emptyActivity, type ActivityDraft } from "./activity-input";
import { londonTime, resolveLondonTime } from "@/domain/time";
import type { LocalTimeInput } from "./task-input";
export type ScheduleTaskDraft = { activity: ActivityDraft; baseline: LocalTimeInput; windows: { start: LocalTimeInput; end: LocalTimeInput }[]; blocks: { start: LocalTimeInput; end: LocalTimeInput }[]; fixed: boolean; attention: boolean; resources: string; predecessorIds: string[] };
export function localInput(utc: string): LocalTimeInput { const local = londonTime(utc); return { date: local.date, time: local.time, offsetChoice: local.offset === "+01:00" ? "earlier" : "later" }; }
export function emptyScheduleTask(date: string, id: string): ScheduleTaskDraft { const blank = () => ({ date, time: "", offsetChoice: null }); return { activity: emptyActivity(id), baseline: blank(), windows: [{ start: blank(), end: blank() }], blocks: [], fixed: false, attention: false, resources: "", predecessorIds: [] }; }
export function activityToDraft(input: ActivityInputV2): ActivityDraft {
  const base = { ...emptyActivity(input.id), category: input.category, name: input.name, duration: String(input.durationMinutes), quantity: String(input.quantity), confirmed: true, energyKind: input.energy.kind };
  if (input.energy.kind === "average_power") return { ...base, energyValue: String(input.energy.powerMw / 1000), origin: input.energy.origin };
  if (input.energy.kind === "cycle_energy") return { ...base, energyValue: String(input.energy.energyMwh / 1e6), origin: input.energy.origin };
  if (input.energy.kind === "reference") return { ...base, profileId: input.energy.profileId };
  return base;
}
export function compileSchedule(tasks: ScheduleTaskDraft[], profiles: readonly ReferenceProfileV2[], kind: "tasks" | "day", dayDate: string): ScheduleInputV2 {
  const local = (value: LocalTimeInput, label: string) => { try { return resolveLondonTime(value); } catch { throw new Error(`${label}: enter a valid London date/time and choose an occurrence when the clocks go back.`); } };
  return scheduleInputSchema.parse({ schemaVersion: 2, kind, geography: "GB_NATIONAL", timezone: "Europe/London", dayDate: kind === "day" ? dayDate : null,
    tasks: tasks.map((task, i) => { const title = task.activity.name || `Task ${i + 1}`, baselineStartUtc = local(task.baseline, `${title} usual start`); return { activity: compileActivity(task.activity, profiles), baselineStartUtc,
      windows: task.windows.map((w) => ({ startUtc: local(w.start, `${title} available from`), endUtc: local(w.end, `${title} finish by`) })), blocks: task.blocks.map((b) => ({ startUtc: local(b.start, `${title} blocked from`), endUtc: local(b.end, `${title} blocked until`) })),
      fixedStartUtc: task.fixed ? baselineStartUtc : null, resourceIds: task.resources.split(",").map((s) => s.trim()).filter(Boolean), requiresAttention: task.attention, predecessorIds: task.predecessorIds }; }) });
}
export const HANDOFF_KEY = "carbonshift.activity-handoff.v2";
