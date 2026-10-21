import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { assertComparisonAcceptable, createComparison, parseSupportedComparison } from "@/domain/scheduling";
import { constraints, NOW, SNAPSHOT_HASH, SNAPSHOT_ID, snapshot } from "../fixtures/domain";

const compare = (fields: unknown = constraints(), grid: unknown = snapshot(), now = NOW) => createComparison({ constraints: fields, snapshot: grid, forecastSnapshotId: SNAPSHOT_ID, forecastSnapshotHash: SNAPSHOT_HASH }, now);
describe("M02.04 deterministic optimization (T03/T06)", () => {
  it("finds the global minimum among all intermediate windows", () => {
    const result = compare();
    expect(result.baseline.estimatedMg).toBe(320000);
    expect(result.selected).toMatchObject({ startUtc: "2026-10-21T09:00:00Z", endUtc: "2026-10-21T10:00:00Z", estimatedMg: 120000, rank: 1 });
    expect(result.differenceMg).toBe(200000);
    expect(result.differencePercent).toBe(62.5);
    expect(result.alternatives.map((candidate) => candidate.estimatedMg)).toEqual([160000, 210000, 240000]);
    expect(result.baseline.rank).toBe(7);
    expect(new Set([result.selected, ...result.alternatives].map((candidate) => candidate.startUtc)).size).toBe(4);
  });
  it("matches independent brute-force enumeration and constraints across generated scenarios", () => {
    fc.assert(fc.property(
      fc.integer({ min: 50, max: 5000 }), fc.integer({ min: 1, max: 6 }),
      fc.array(fc.integer({ min: 0, max: 1500 }), { minLength: 12, maxLength: 12 }), fc.boolean(),
      (energy, count, factors, hasBlock) => {
        const origin = Date.parse("2026-10-21T07:00:00Z");
        const iso = (index: number) => new Date(origin + index * 1800000).toISOString().replace(".000Z", "Z");
        const blockFrom = 5, blockTo = 6;
        // Reference uses integer indices and independent overlap inequalities.
        const possible = Array.from({ length: 13 - count }, (_, index) => index).filter((index) => !hasBlock || index >= blockTo || index + count <= blockFrom);
        const expected = possible.map((index) => {
          const bins = Array.from({ length: count }, (_, k) => Math.floor(energy / count) + (k < energy % count ? 1 : 0));
          return { index, mg: bins.reduce((sum, bin, k) => sum + bin * factors[index + k]!, 0) };
        }).sort((a, b) => a.mg - b.mg || a.index - b.index);
        const input = { ...constraints(), durationMinutes: (count * 30) as 30 | 60 | 90 | 120 | 150 | 180, energyWh: energy, deadlineUtc: iso(12), baselineStartUtc: iso(possible.at(-1)!), blockedIntervals: hasBlock ? [{ startUtc: iso(blockFrom), endUtc: iso(blockTo) }] : [] };
        const result = compare(input, snapshot(factors));
        expect(result.selected.startUtc).toBe(iso(expected[0]!.index));
        expect(result.selected.estimatedMg).toBe(expected[0]!.mg);
        expect(result.selected.estimatedMg).toBeLessThanOrEqual(result.baseline.estimatedMg);
        for (const candidate of [result.baseline, result.selected, ...result.alternatives]) {
          expect(candidate.endUtc <= input.deadlineUtc).toBe(true);
          expect(possible).toContain((Date.parse(candidate.startUtc) - origin) / 1800000);
        }
      }), { seed: 20606, numRuns: 300 });
  });
  it("uses earliest UTC for ties and accepts baseline-only/zero results", () => {
    const tied = compare({ ...constraints(), baselineStartUtc: "2026-10-21T09:00:00Z" }, snapshot(Array(8).fill(100)));
    expect(tied.selected.startUtc).toBe("2026-10-21T07:00:00Z");
    expect(tied.differenceMg).toBe(0);
    const only = compare({ ...constraints(), deadlineUtc: "2026-10-21T08:00:00Z" }, snapshot([0, 0]));
    expect(only.selected).toEqual(only.baseline);
    expect(only.alternatives).toEqual([]);
    expect(only.differencePercent).toBeNull();
  });
  it.each(["2026-10-21T07:01:00Z", "2026-10-21T06:30:00Z", "2026-10-21T10:30:00Z"])("rejects infeasible explicit baseline %s without replacing it", (baselineStartUtc) => {
    expect(() => compare({ ...constraints(), baselineStartUtc })).toThrow(expect.objectContaining({ code: "INVALID_BASELINE" }));
  });
  it("rejects blocked baseline and mismatched earliest-feasible origin", () => {
    const input = { ...constraints(), blockedIntervals: [{ startUtc: "2026-10-21T07:00:00Z", endUtc: "2026-10-21T08:00:00Z" }] };
    expect(() => compare(input)).toThrow(expect.objectContaining({ code: "INVALID_BASELINE" }));
    expect(() => compare({ ...constraints(), baselineStartUtc: "2026-10-21T09:00:00Z", baselineOrigin: "earliest_feasible_confirmed" })).toThrow(expect.objectContaining({ code: "INVALID_BASELINE" }));
    expect(compare({ ...constraints(), baselineOrigin: "earliest_feasible_confirmed" }).baseline.startUtc).toBe(constraints().earliestStartUtc);
  });
  it.each(["first", "last", "null", "blocked"])("requires full planning coverage including %s factors", (kind) => {
    const grid = snapshot();
    if (kind === "first") grid.intervals.shift();
    if (kind === "last") grid.intervals.pop();
    if (kind === "null") grid.intervals[3]!.forecastGPerKwh = null;
    const input = constraints();
    if (kind === "blocked") {
      input.blockedIntervals = [{ startUtc: "2026-10-21T08:00:00Z", endUtc: "2026-10-21T09:00:00Z" }];
      grid.intervals[3]!.forecastGPerKwh = null;
    }
    expect(() => compare(input, grid)).toThrow(expect.objectContaining({ code: "INCOMPLETE_GRID_COVERAGE" }));
  });
  it("requires the rounded-up deadline tail even if no cycle uses it", () => {
    expect(() => compare({ ...constraints(), deadlineUtc: "2026-10-21T11:01:00Z" })).toThrow(expect.objectContaining({ code: "INCOMPLETE_GRID_COVERAGE" }));
  });
  it("validates future retrieval, exact freshness age and stale acceptance", () => {
    expect(compare(constraints(), { ...snapshot(), retrievedAtUtc: "2026-10-21T05:30:00Z" }).selected.rank).toBe(1);
    expect(() => compare(constraints(), { ...snapshot(), retrievedAtUtc: "2026-10-21T05:29:59Z" })).toThrow(expect.objectContaining({ code: "STALE_GRID_SNAPSHOT" }));
    expect(() => compare(constraints(), { ...snapshot(), retrievedAtUtc: "2026-10-21T06:00:01Z" })).toThrow(expect.objectContaining({ code: "FUTURE_GRID_SNAPSHOT" }));
    const grid = { ...snapshot(), retrievedAtUtc: "2026-10-21T05:30:01Z" }, result = compare(constraints(), grid);
    expect(() => assertComparisonAcceptable(result, grid, NOW)).not.toThrow();
    expect(() => assertComparisonAcceptable(result, grid, "2026-10-21T06:00:02Z")).toThrow(expect.objectContaining({ code: "STALE_GRID_SNAPSHOT" }));
    expect(() => assertComparisonAcceptable(result, grid, result.expiresAtUtc)).toThrow(expect.objectContaining({ code: "COMPARISON_EXPIRED" }));
  });
  it("is invariant to JSON key ordering and caller mutation, with no ambient clock", () => {
    const input = constraints(), grid = snapshot(), frozenInput = JSON.stringify(input);
    vi.useFakeTimers(); vi.setSystemTime(new Date("2040-01-01T00:00:00Z"));
    try {
      const first = compare(input, grid);
      const reordered = Object.fromEntries(Object.entries(input).reverse()) as ReturnType<typeof constraints>;
      expect(compare(reordered, { ...grid, intervals: [...grid.intervals].reverse() })).toEqual(first);
      expect(JSON.stringify(input)).toBe(frozenInput);
      input.energyWh = 2000; grid.intervals[0]!.forecastGPerKwh = 999;
      expect(first.constraints.energyWh).toBe(1000);
      expect(first.baseline.factorGPerKwh[0]).toBe(300);
      expect(Object.isFrozen(first.alternatives[0]!.energyWhBins)).toBe(true);
      expect(() => { first.selected.estimatedMg = 1; }).toThrow();
    } finally { vi.useRealTimers(); }
  });
  it("rejects unknown methods explicitly instead of guessing", () => {
    expect(() => parseSupportedComparison({ ...compare(), methodVersion: "future-v2" })).toThrow(expect.objectContaining({ code: "UNSUPPORTED_METHOD" }));
  });
});
