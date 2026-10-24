import { describe, expect, it } from "vitest";
import { normalizeSchedule, planningBounds } from "@/domain/activities/constraints";
import { DomainError } from "@/domain/errors";
import { solveSchedule } from "@/domain/activities/scheduler";
import { snapshot, NOW } from "../fixtures/domain";
import type { ScheduleInputV2, TaskInputV2 } from "@/domain/activities/schemas";
const task = (id: string, baselineStartUtc = "2026-10-21T07:00:00Z"): TaskInputV2 => ({ activity: { schemaVersion: 2, id, category: "television", name: id, durationMinutes: 15, quantity: 1, energy: { kind: "average_power", powerMw: 100000, origin: "user_estimate", confirmed: true } }, baselineStartUtc, windows: [{ startUtc: "2026-10-21T07:00:00Z", endUtc: "2026-10-21T08:00:00Z" }], blocks: [], resourceIds: [], predecessorIds: [], requiresAttention: false, fixedStartUtc: null });
const input = (tasks: TaskInputV2[]): ScheduleInputV2 => ({ schemaVersion: 2, kind: "tasks", geography: "GB_NATIONAL", timezone: "Europe/London", dayDate: null, tasks });
describe("household joint scheduling", () => {
  it("reports the current planning range independently of forecast availability", () => {
    expect(planningBounds("2026-10-24T18:47:12Z")).toEqual({
      earliestWindowUtc: "2026-10-24T18:30:00Z",
      earliestStartUtc: "2026-10-24T18:58:00Z",
      latestEndUtc: "2026-10-26T18:47:12Z",
    });
  });
  it("identifies the exact stale availability field before comparison", () => {
    const a = task("ironing"); a.windows[0]!.startUtc = "2026-10-21T05:30:00Z";
    try { normalizeSchedule(input([a]), [], NOW); throw new Error("Expected invalid window"); }
    catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).fieldErrors).toEqual([{ path: "tasks.ironing.windows.0.startUtc", message: expect.stringContaining("Available from") }]);
    }
  });
  it("directs overnight windows to task planning while preserving the complete DST day", () => {
    const a = task("ironing", "2026-10-25T22:00:00Z");
    a.windows = [{ startUtc: "2026-10-25T19:00:00Z", endUtc: "2026-10-26T06:00:00Z" }];
    const overnight = input([a]);
    expect(normalizeSchedule(overnight, [], "2026-10-24T19:00:00Z").tasks).toHaveLength(1);
    try { normalizeSchedule({ ...overnight, kind: "day", dayDate: "2026-10-25" }, [], "2026-10-24T19:00:00Z"); throw new Error("Expected invalid day window"); }
    catch (error) {
      expect((error as DomainError).fieldErrors).toEqual([{ path: "tasks.ironing.windows.0.endUtc", message: expect.stringContaining("For an overnight window, use Plan tasks") }]);
    }
    a.windows[0]!.endUtc = "2026-10-26T00:00:00Z";
    expect(normalizeSchedule({ ...input([a]), kind: "day", dayDate: "2026-10-25" }, [], "2026-10-24T19:00:00Z").tasks).toHaveLength(1);
  });
  it("preserves a feasible baseline and matches an independent exhaustive two-task oracle", () => {
    const a = task("a"), b = task("b", "2026-10-21T07:15:00Z"); a.resourceIds = b.resourceIds = ["shared"];
    const normalized = normalizeSchedule(input([a, b]), [], NOW), solved = solveSchedule(normalized, snapshot([300, 100]), NOW);
    // Independent minute overlap arithmetic: a 15 minute, 100 W task uses 25 Wh.
    const starts = Array.from({ length: 10 }, (_, i) => i * 5), values: { cost: number; starts: number[] }[] = [];
    const cost = (s: number) => (Math.max(0, Math.min(s + 15, 30) - s) * 300 + Math.max(0, s + 15 - Math.max(s, 30)) * 100) * 100 / 60;
    for (const x of starts) for (const y of starts) if (x + 15 <= y || y + 15 <= x) values.push({ cost: Math.round(cost(x)) + Math.round(cost(y)), starts: [x, y] });
    values.sort((x, y) => x.cost - y.cost || x.starts[0]! - y.starts[0]! || x.starts[1]! - y.starts[1]!);
    expect(solved.selected.estimatedMg).toBe(values[0]!.cost); expect(solved.selected.tasks.map((t) => (Date.parse(t.startUtc) - Date.parse(a.baselineStartUtc)) / 60000)).toEqual(values[0]!.starts);
    expect(solved.selected.estimatedMg).toBeLessThanOrEqual(solved.baseline.estimatedMg); expect(solved.search.status).toBe("optimal_within_candidates");
  });
  it("retains fixed starts and wash-before-dry order", () => { const a = task("wash"), b = task("dry", "2026-10-21T07:30:00Z"); a.fixedStartUtc = a.baselineStartUtc; b.predecessorIds = ["wash"]; const solved = solveSchedule(normalizeSchedule(input([a, b]), [], NOW), snapshot([300, 100]), NOW); expect(solved.selected.tasks.find((t) => t.taskId === "wash")!.startUtc).toBe(a.baselineStartUtc); expect(solved.selected.tasks.find((t) => t.taskId === "dry")!.startUtc >= "2026-10-21T07:15:00Z").toBe(true); });
  it("distinguishes short window, invalid baseline and cyclic constraints", () => {
    const a = task("a"); a.windows[0]!.endUtc = "2026-10-21T07:10:00Z"; expect(() => normalizeSchedule(input([a]), [], NOW)).toThrow(/uninterrupted/);
    const b = task("b", "2026-10-21T07:55:00Z"); expect(() => normalizeSchedule(input([b]), [], NOW)).toThrow(/usual start/);
    const c = task("c"), d = task("d"); c.predecessorIds = ["d"]; d.predecessorIds = ["c"]; expect(() => normalizeSchedule(input([c, d]), [], NOW)).toThrow(/cycle/);
  });
  it("permits touching resources but rejects overlapping reviewed baselines", () => { const a = task("a"), b = task("b", "2026-10-21T07:15:00Z"); a.requiresAttention = b.requiresAttention = true; expect(normalizeSchedule(input([a, b]), [], NOW).tasks).toHaveLength(2); b.baselineStartUtc = "2026-10-21T07:10:00Z"; expect(() => normalizeSchedule(input([a, b]), [], NOW)).toThrow(/conflict/); });
  it("keeps the baseline when the search budget ends and exposes the bound", () => { const a = task("a"), b = task("b", "2026-10-21T07:15:00Z"); a.requiresAttention = b.requiresAttention = true; const solved = solveSchedule(normalizeSchedule(input([a, b]), [], NOW), snapshot([300, 100]), NOW, 1); expect(solved.search).toMatchObject({ status: "best_found", nodesExplored: 1 }); expect(solved.selected.estimatedMg).toBeLessThanOrEqual(solved.baseline.estimatedMg); });
  it("does not turn missing factors into a clean window", () => { expect(() => solveSchedule(normalizeSchedule(input([task("a")]), [], NOW), snapshot([null, 100]), NOW)).toThrow(); });
  it("handles twelve independent tasks without combinatorial expansion", () => { const began = performance.now(), tasks = Array.from({ length: 12 }, (_, i) => task(`task-${i}`)); const solved = solveSchedule(normalizeSchedule(input(tasks), [], NOW), snapshot([300, 100]), NOW); expect(solved.selected.tasks).toHaveLength(12); expect(solved.search.nodesExplored).toBeLessThanOrEqual(48); console.info(JSON.stringify({ case: "12-independent-activities", elapsedMs: Math.round(performance.now() - began), search: solved.search })); });
});
