import { DomainError } from "../errors";
import { assertForecastFreshness, requireForecastCoverage } from "../grid";
import type { GridSnapshotV1 } from "../schemas";
import { epochSeconds, halfHourCoverage } from "../time";
import { ACTIVITY_METHOD as M } from "./method";
import { compatible, type NormalizedSchedule } from "./constraints";
import { estimateActivity, type ActivityEstimateV2 } from "./carbon";
export type Assignment = Omit<ActivityEstimateV2, "intervals"> & { taskId: string };
export type ScheduleOption = { tasks: Assignment[]; energyMwh: number; estimatedMg: number };
export type ScheduleSolution = { baseline: ScheduleOption; selected: ScheduleOption; alternatives: ScheduleOption[]; differenceMg: number; search: { status: "optimal_within_candidates" | "best_found"; nodesExplored: number; candidateStepSeconds: number; nodeBudget: number; candidateCounts: number[] } };
const option = (tasks: Assignment[]): ScheduleOption => ({ tasks, energyMwh: tasks.reduce((s, t) => s + t.energyMwh, 0), estimatedMg: tasks.reduce((s, t) => s + t.estimatedMg!, 0) });
const key = (v: ScheduleOption) => v.tasks.map((t) => t.startUtc).join("|");
const compare = (a: ScheduleOption, b: ScheduleOption) => a.estimatedMg - b.estimatedMg || key(a).localeCompare(key(b));
export function solveSchedule(normalized: NormalizedSchedule, snapshot: GridSnapshotV1, nowUtc: string, nodeBudget: number = M.maximumSearchNodes): ScheduleSolution {
  if (!Number.isInteger(nodeBudget) || nodeBudget < 1 || nodeBudget > M.maximumSearchNodes) throw new DomainError("INVALID_INPUT", "Unsupported search budget.");
  assertForecastFreshness(snapshot, nowUtc);
  const coverage = halfHourCoverage(normalized.fromUtc, normalized.toUtc); requireForecastCoverage(snapshot, coverage.fromUtc, coverage.toUtc);
  const scored = normalized.tasks.map((task) => task.candidates.map((start) => { const { intervals, ...estimate } = estimateActivity(task.activity, start, snapshot); void intervals; return { ...estimate, taskId: task.input.activity.id }; }).sort((a, b) => a.estimatedMg! - b.estimatedMg! || a.startUtc.localeCompare(b.startUtc)));
  if (scored.some((list) => !list.length || list.some((a) => a.estimatedMg === null))) throw new DomainError("INCOMPLETE_GRID_COVERAGE", "Every candidate needs complete grid coverage.");
  const baseline = option(normalized.tasks.map((t, i) => scored[i]!.find((a) => a.startUtc === t.input.baselineStartUtc)!));
  const best: ScheduleOption[] = [baseline];
  function retain(candidate: ScheduleOption) { if (!best.some((v) => key(v) === key(candidate))) { best.push(candidate); best.sort(compare); best.splice(M.maximumAlternatives + 1); } }
  const independent = normalized.tasks.every((a, i) => normalized.tasks.every((b, j) => i === j || (!a.input.predecessorIds.includes(b.input.activity.id) && !b.input.predecessorIds.includes(a.input.activity.id) && !(a.input.requiresAttention && b.input.requiresAttention) && !a.input.resourceIds.some((r) => b.input.resourceIds.includes(r)))));
  let nodes = 0, limited = false;
  if (independent) {
    // Best-first Cartesian neighbours yield the first four distinct independent schedules.
    const frontier = [scored.map(() => 0)], seen = new Set<string>([frontier[0]!.join(",")]);
    for (let rank = 0; rank <= M.maximumAlternatives && frontier.length; rank++) {
      frontier.sort((a, b) => compare(option(a.map((n, i) => scored[i]![n]!)), option(b.map((n, i) => scored[i]![n]!))));
      const indices = frontier.shift()!; retain(option(indices.map((n, i) => scored[i]![n]!)));
      for (let i = 0; i < indices.length; i++) {
        if (nodes >= nodeBudget) { limited = true; break; } nodes++;
        if (indices[i]! + 1 >= scored[i]!.length) continue;
        const next = [...indices]; next[i] = next[i]! + 1; const id = next.join(","); if (!seen.has(id)) { seen.add(id); frontier.push(next); }
      }
      if (limited) break;
    }
  } else {
    const assigned: (Assignment | undefined)[] = new Array(scored.length), order = normalized.order;
    const suffix = new Array<number>(order.length + 1).fill(0);
    for (let depth = order.length - 1; depth >= 0; depth--) suffix[depth] = suffix[depth + 1]! + scored[order[depth]!]![0]!.estimatedMg!;
    function search(depth: number, total: number) {
      if (depth === order.length) { retain(option(assigned.map((a) => a!))); return; }
      const index = order[depth]!;
      for (const candidate of scored[index]!) {
        if (nodes >= nodeBudget) { limited = true; return; } nodes++;
        if (best.length === M.maximumAlternatives + 1 && total + candidate.estimatedMg! + suffix[depth + 1]! > best.at(-1)!.estimatedMg) break;
        if (assigned.some((other, j) => other && !compatible(normalized.tasks[index]!.input, epochSeconds(candidate.startUtc), normalized.tasks[j]!.input, epochSeconds(other.startUtc)))) continue;
        assigned[index] = candidate; search(depth + 1, total + candidate.estimatedMg!); assigned[index] = undefined;
        if (limited) return;
      }
    }
    search(0, 0);
  }
  best.sort(compare); const selected = best[0]!;
  return { baseline, selected, alternatives: best.slice(1), differenceMg: baseline.estimatedMg - selected.estimatedMg, search: { status: limited ? "best_found" : "optimal_within_candidates", nodesExplored: nodes, candidateStepSeconds: M.candidateStepSeconds, nodeBudget, candidateCounts: scored.map((x) => x.length) } };
}
