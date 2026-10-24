import "server-only";
import { randomUUID } from "node:crypto";
import { selectedSchedule, type ScheduleDocument } from "@/contracts/schedules";
import type { ScheduleHistory } from "@/contracts/schedule-lifecycle";
import { aggregateSchedule } from "@/domain/activities/results";
import { planV2Schema, resultV2Schema, type PlanV2 } from "@/domain/proof/v2/schemas";
import { METHOD_V2_HASH, hashPlanV2, canonicalV2 } from "@/domain/proof/v2/canonical";
import { GRID_POLICY } from "@/server/grid/provider";
export function publicTaskMap(plan: ScheduleDocument) { return new Map(plan.comparison.input.tasks.map((t, i) => [t.activity.id, `task-${String(i + 1).padStart(2, "0")}`])); }
export function buildActivityPlan(plan: ScheduleDocument, identity: { receiptId: string; nonce: string; contractAddress: string }): PlanV2 {
  const c = plan.comparison, ids = publicTaskMap(plan), resources = new Map([...new Set(c.input.tasks.flatMap((t) => t.resourceIds))].sort().map((r, i) => [r, `resource-${String(i + 1).padStart(2, "0")}`]));
  const input = { ...c.input, tasks: c.input.tasks.map((t) => ({ ...t, activity: { ...t.activity, id: ids.get(t.activity.id)!, name: t.activity.category }, resourceIds: t.resourceIds.map((r) => resources.get(r)!), predecessorIds: t.predecessorIds.map((id) => ids.get(id)!) })) };
  const option = (o: typeof c.solution.selected) => ({ ...o, tasks: o.tasks.map((t) => ({ ...t, taskId: ids.get(t.taskId)! })) });
  const starts = [...c.solution.baseline.tasks, ...selectedSchedule(plan).tasks].map((t) => t.startUtc).sort();
  const projected = { schemaVersion: 2, type: "plan", ...identity, mode: "live", chainId: 11155111, methodVersion: c.methodVersion, methodHash: METHOD_V2_HASH, comparisonCreatedAtUtc: c.createdAtUtc, acceptedAtUtc: plan.acceptedAtUtc, commitBeforeUtc: starts[0],
    input, activities: c.activities.map((a) => ({ ...a, input: { ...a.input, id: ids.get(a.input.id)!, name: a.input.category } })), forecastSnapshot: c.grid.snapshot,
    solution: { ...c.solution, baseline: option(c.solution.baseline), selected: option(c.solution.selected), alternatives: c.solution.alternatives.map(option) }, optionIndex: plan.optionIndex, executionBasis: "not_observed", attribution: GRID_POLICY.attribution };
  canonicalV2(projected); return planV2Schema.parse(projected);
}
export function buildActivityResult(plan: ScheduleDocument, history: ScheduleHistory, manifest: PlanV2, context: { nonce: string; publicRevision: number; previousResultHash: string; correctionExplanation: string }) {
  const expected = buildActivityPlan(plan, manifest); if (hashPlanV2(expected) !== hashPlanV2(manifest)) throw new Error("Public plan differs from accepted schedule.");
  const ids = publicTaskMap(plan), tasks = plan.comparison.input.tasks.map((task) => {
    const report = history.reports.filter((r) => r.taskId === task.activity.id).at(-1), result = report ? history.results.filter((r) => r.taskId === task.activity.id && r.reportId === report.id).at(-1) : null;
    return { taskId: ids.get(task.activity.id)!, reportSequence: report?.sequence ?? 0, resultSequence: result?.sequence ?? 0,
      report: report ? { kind: report.kind, actualStartUtc: report.actualStartUtc, profileUnchanged: report.profileUnchanged, reportedAtUtc: report.reportedAtUtc } : null,
      result: result ? { state: result.state, baselineActualMg: result.baselineActualMg, reportedActualMg: result.reportedActualMg, differenceMg: result.differenceMg, deviationCodes: result.deviationCodes, calculatedAtUtc: result.calculatedAtUtc } : null, actualSnapshot: result?.grid?.snapshot ?? null };
  });
  if (!tasks.some((t) => t.report)) throw new Error("Report an activity before publishing a result.");
  return resultV2Schema.parse({ schemaVersion: 2, type: "result", receiptId: manifest.receiptId, ...context, mode: manifest.mode, chainId: manifest.chainId, contractAddress: manifest.contractAddress, methodVersion: manifest.methodVersion, methodHash: manifest.methodHash, planHash: hashPlanV2(manifest), resultCreatedAtUtc: tasks.flatMap((t) => t.result ? [t.result.calculatedAtUtc] : []).sort().at(-1)!, tasks, aggregate: aggregateSchedule(plan, history), executionBasis: "self_reported" });
}
export const newPublicNonce = () => `0x${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`;
