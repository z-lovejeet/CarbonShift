import { parseDomain, DomainError } from "../errors";
import { epochSeconds, utcFromSeconds, londonDayBounds, londonTime } from "../time";
import { ACTIVITY_METHOD as M } from "./method";
import { scheduleInputSchema, type ScheduleInputV2, type TaskInputV2, type ReferenceProfileV2, type ResolvedActivityV2 } from "./schemas";
import { resolveActivity } from "./energy";
export type NormalizedTask = { input: TaskInputV2; activity: ResolvedActivityV2; candidates: string[] };
export type NormalizedSchedule = { input: ScheduleInputV2; tasks: NormalizedTask[]; order: number[]; fromUtc: string; toUtc: string };
const overlaps = (a: number, b: number, c: number, d: number) => a < d && b > c;
export function planningBounds(nowUtc: string) {
  const now = epochSeconds(nowUtc);
  return {
    earliestWindowUtc: utcFromSeconds(Math.floor(now / M.sourceIntervalSeconds) * M.sourceIntervalSeconds),
    earliestStartUtc: utcFromSeconds(Math.ceil((now + M.operationalBufferSeconds) / 60) * 60),
    latestEndUtc: utcFromSeconds(now + M.forecastHorizonSeconds),
  };
}
function localLabel(utc: string) {
  const t = londonTime(utc);
  return `${t.date} at ${t.time} (London, UTC${t.offset})`;
}
export function legalStart(task: TaskInputV2, seconds: number): boolean {
  const end = seconds + task.activity.durationMinutes * 60;
  return (task.fixedStartUtc === null || seconds === epochSeconds(task.fixedStartUtc)) &&
    task.windows.some((w) => seconds >= epochSeconds(w.startUtc) && end <= epochSeconds(w.endUtc)) &&
    !task.blocks.some((b) => overlaps(seconds, end, epochSeconds(b.startUtc), epochSeconds(b.endUtc)));
}
export function compatible(a: TaskInputV2, startA: number, b: TaskInputV2, startB: number): boolean {
  const endA = startA + a.activity.durationMinutes * 60, endB = startB + b.activity.durationMinutes * 60;
  if (a.predecessorIds.includes(b.activity.id) && startA < endB) return false;
  if (b.predecessorIds.includes(a.activity.id) && startB < endA) return false;
  const shared = (a.requiresAttention && b.requiresAttention) || a.resourceIds.some((r) => b.resourceIds.includes(r));
  return !shared || !overlaps(startA, endA, startB, endB);
}
function mergeWindows(windows: TaskInputV2["windows"]) {
  const result: TaskInputV2["windows"] = [];
  for (const availableWindow of [...windows].sort((a, b) => a.startUtc.localeCompare(b.startUtc))) {
    const last = result.at(-1);
    if (last && availableWindow.startUtc <= last.endUtc) last.endUtc = last.endUtc > availableWindow.endUtc ? last.endUtc : availableWindow.endUtc;
    else result.push({ ...availableWindow });
  }
  return result;
}
export function normalizeSchedule(value: unknown, references: readonly ReferenceProfileV2[], nowUtc: string): NormalizedSchedule {
  const input = parseDomain(scheduleInputSchema, value), bounds = planningBounds(nowUtc), minimum = epochSeconds(bounds.earliestStartUtc), maximum = epochSeconds(bounds.latestEndUtc);
  const day = input.dayDate === null ? null : londonDayBounds(input.dayDate);
  input.tasks.sort((a, b) => a.activity.id.localeCompare(b.activity.id));
  const index = new Map(input.tasks.map((task, i) => [task.activity.id, i]));
  const order: number[] = [], visiting = new Set<number>(), visited = new Set<number>();
  function visit(i: number) {
    if (visiting.has(i)) throw new DomainError("CONSTRAINT_CONFLICT", "Task dependencies form a cycle. Remove one of the before/after requirements.");
    if (visited.has(i)) return;
    visiting.add(i); for (const id of input.tasks[i]!.predecessorIds) visit(index.get(id)!);
    visiting.delete(i); visited.add(i); order.push(i);
  }
  input.tasks.forEach((_, i) => visit(i));
  const tasks = input.tasks.map((task) => {
    const activity = resolveActivity(task.activity, references), duration = activity.durationSeconds;
    if (activity.energyMwh === 0) throw new DomainError("INVALID_ACTIVITY", `${task.activity.name}: no-direct-electricity activities can be simulated, but cannot create a carbon-shifting plan.`);
    for (const [i, w] of task.windows.entries()) {
      const path = `tasks.${task.activity.id}.windows.${i}`;
      if (day && (w.startUtc < day.startUtc || w.endUtc > day.endUtc)) {
        const message = `${task.activity.name}: window ${i + 1} must stay inside ${input.dayDate} in London, ending no later than ${localLabel(day.endUtc)}. For an overnight window, use Plan tasks.`;
        throw new DomainError("INVALID_TIME_WINDOW", message, [{ path: `${path}.${w.startUtc < day.startUtc ? "startUtc" : "endUtc"}`, message }]);
      }
      if (w.startUtc < bounds.earliestWindowUtc) {
        const message = `${task.activity.name}: window ${i + 1} starts in an earlier half-hour. Set Available from to ${localLabel(bounds.earliestWindowUtc)} or later.`;
        throw new DomainError("OUTSIDE_PLANNING_HORIZON", message, [{ path: `${path}.startUtc`, message }]);
      }
      if (epochSeconds(w.endUtc) > maximum) {
        const message = `${task.activity.name}: window ${i + 1} ends beyond the forecast. Set Must finish by to ${localLabel(bounds.latestEndUtc)} or earlier.`;
        throw new DomainError("OUTSIDE_PLANNING_HORIZON", message, [{ path: `${path}.endUtc`, message }]);
      }
    }
    task.windows = mergeWindows(task.windows); task.blocks = mergeWindows(task.blocks);
    if (!task.windows.some((w) => epochSeconds(w.endUtc) - Math.max(minimum, epochSeconds(w.startUtc)) >= duration)) throw new DomainError("WINDOW_TOO_SHORT", `${task.activity.name} needs ${task.activity.durationMinutes} uninterrupted minutes, plus time to review. Extend an available window or choose another time.`);
    const baseline = epochSeconds(task.baselineStartUtc);
    if (baseline < minimum || !legalStart(task, baseline)) {
      const message = `${task.activity.name}: your usual start must be ${localLabel(bounds.earliestStartUtc)} or later and fit the complete task inside an available window, respecting blocked and fixed times.`;
      throw new DomainError("BASELINE_INFEASIBLE", message, [{ path: `tasks.${task.activity.id}.baselineStartUtc`, message }]);
    }
    const starts = new Set<number>([baseline]);
    if (task.fixedStartUtc !== null) starts.add(epochSeconds(task.fixedStartUtc));
    else for (const availableWindow of task.windows) {
      const lo = Math.max(minimum, epochSeconds(availableWindow.startUtc)), hi = epochSeconds(availableWindow.endUtc) - duration;
      starts.add(Math.ceil(lo / 60) * 60); starts.add(Math.floor(hi / 60) * 60);
      for (let s = Math.ceil(lo / M.candidateStepSeconds) * M.candidateStepSeconds; s <= hi; s += M.candidateStepSeconds) starts.add(s);
      for (const b of task.blocks) { starts.add(epochSeconds(b.endUtc)); starts.add(epochSeconds(b.startUtc) - duration); }
    }
    return { input: task, activity, candidates: [...starts].filter((s) => s >= minimum && s % 60 === 0 && legalStart(task, s)).sort((a, b) => a - b).map(utcFromSeconds) };
  });
  for (let i = 0; i < tasks.length; i++) for (let j = i + 1; j < tasks.length; j++) if (!compatible(tasks[i]!.input, epochSeconds(tasks[i]!.input.baselineStartUtc), tasks[j]!.input, epochSeconds(tasks[j]!.input.baselineStartUtc))) throw new DomainError("BASELINE_INFEASIBLE", `Your usual times for ${tasks[i]!.input.activity.name} and ${tasks[j]!.input.activity.name} conflict. Review their order, shared equipment and attention requirements.`);
  return { input, tasks, order, fromUtc: tasks.flatMap((t) => t.input.windows.map((w) => w.startUtc)).sort()[0]!, toUtc: tasks.flatMap((t) => t.input.windows.map((w) => w.endUtc)).sort().at(-1)! };
}
