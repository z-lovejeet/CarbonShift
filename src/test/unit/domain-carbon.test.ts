import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { actualCarbonMg, alignedCarbonMg, carbonDifference } from "@/domain/carbon";
import { energyWhFromKwh, uniformEnergyBins } from "@/domain/profile";
import { normalizeGridSnapshot } from "@/domain/grid";
import { snapshot } from "../fixtures/domain";

describe("M02.03 exact carbon and energy (T06)", () => {
  it("converts decimal kWh text exactly without rounding or unit coercion", () => {
    for (const [input, expected] of [["0.050", 50], ["1", 1000], ["1.001", 1001], ["4.999", 4999], ["5.000", 5000]] as const) expect(energyWhFromKwh(input)).toBe(expected);
    for (const input of ["0.049", "5.001", "1.0001", "1e0", "1,00", " 1", "1\n", "-1", "01", "NaN"]) expect(() => energyWhFromKwh(input)).toThrow();
  });
  it("reproduces the authored worked comparison and odd-Wh allocation", () => {
    expect(uniformEnergyBins(1001, 90)).toEqual([334, 334, 333]);
    expect(alignedCarbonMg([500, 500], [300, 340])).toBe(320000);
    expect(alignedCarbonMg([500, 500], [100, 140])).toBe(120000);
    expect(carbonDifference(320000, 120000)).toEqual({ differenceMg: 200000, differencePercent: 62.5 });
  });
  it("conserves every allowed integer Wh across every allowed duration", () => {
    fc.assert(fc.property(fc.integer({ min: 50, max: 5000 }), fc.constantFrom(30, 60, 90, 120, 150, 180), (energy, duration) => {
      const bins = uniformEnergyBins(energy, duration);
      expect(bins).toHaveLength(duration / 30);
      expect(bins.reduce((a, b) => a + b, 0)).toBe(energy);
      expect(Math.max(...bins) - Math.min(...bins)).toBeLessThanOrEqual(1);
    }), { seed: 20261021, numRuns: 1000 });
  });
  it("matches an independent aligned reference for generated profiles/factors", () => {
    fc.assert(fc.property(fc.integer({ min: 50, max: 5000 }), fc.constantFrom(30, 60, 90, 120, 150, 180), fc.array(fc.integer({ min: 0, max: 2000 }), { minLength: 6, maxLength: 6 }), (energy, duration, factors) => {
      const bins = uniformEnergyBins(energy, duration), used = factors.slice(0, bins.length);
      const expected = bins.map((bin, i) => bin * used[i]!).reduce((a, b) => a + b, 0);
      expect(alignedCarbonMg(bins, used)).toBe(expected);
      expect(expected).toBeGreaterThanOrEqual(0);
    }), { seed: 31, numRuns: 500 });
  });
  it("splits an arbitrary reported start and rounds only once across all bins", () => {
    expect(actualCarbonMg("2026-10-21T07:15:00Z", [500], snapshot([100, 200]))).toBe(75000);
    // Bin contributions 2.5 + 72.5 mg total 75; rounding each bin yields the wrong 76.
    expect(actualCarbonMg("2026-10-21T07:01:00Z", [25, 25], snapshot([0, 3, 0]))).toBe(75);
    const oneHalf = snapshot([0, 1]);
    expect(actualCarbonMg("2026-10-21T07:15:00Z", [51], oneHalf)).toBe(26);
  });
  it("overlap arithmetic matches an independent per-minute reference", () => {
    fc.assert(fc.property(fc.integer({ min: 50, max: 5000 }), fc.constantFrom(30, 60, 90, 120, 150, 180), fc.integer({ min: 0, max: 29 }), fc.array(fc.integer({ min: 0, max: 2000 }), { minLength: 7, maxLength: 7 }), (energy, duration, minute, factors) => {
      const bins = uniformEnergyBins(energy, duration);
      let numeratorMinutes = 0;
      for (let elapsed = 0; elapsed < duration; elapsed++) numeratorMinutes += bins[Math.floor(elapsed / 30)]! * factors[Math.floor((minute + elapsed) / 30)]!;
      const expected = Math.floor((numeratorMinutes + 15) / 30);
      const start = `2026-10-21T07:${String(minute).padStart(2, "0")}:00Z`;
      expect(actualCarbonMg(start, bins, snapshot(factors))).toBe(expected);
    }), { seed: 1206, numRuns: 500 });
  });
  it("never turns absent ends or null actuals into partial success", () => {
    const input = snapshot([100, 200]);
    expect(actualCarbonMg("2026-10-21T06:59:00Z", [500], input)).toBeNull();
    expect(actualCarbonMg("2026-10-21T07:31:00Z", [500], input)).toBeNull();
    expect(actualCarbonMg("2026-10-21T07:15:00Z", [500], snapshot([null, 200]))).toBeNull();
    expect(actualCarbonMg("2026-10-21T07:00:00Z", [500], snapshot([0]))).toBe(0);
  });
  it("handles zero baselines and negative updated differences", () => {
    expect(carbonDifference(0, 0)).toEqual({ differenceMg: 0, differencePercent: null });
    expect(carbonDifference(190000, 340000)).toEqual({ differenceMg: -150000, differencePercent: -150000 * 100 / 190000 });
    expect(carbonDifference(0, 100)).toEqual({ differenceMg: -100, differencePercent: null });
  });
  it("uses exact intermediates but rejects unsafe totals and invalid units", () => {
    expect(() => alignedCarbonMg([500], [Number.MAX_SAFE_INTEGER])).toThrow(expect.objectContaining({ code: "NUMERIC_OVERFLOW" }));
    expect(() => actualCarbonMg("2026-10-21T07:00:00Z", [500], snapshot([Number.MAX_SAFE_INTEGER]))).toThrow(expect.objectContaining({ code: "NUMERIC_OVERFLOW" }));
    expect(() => alignedCarbonMg([500], [null as unknown as number])).toThrow();
    expect(() => uniformEnergyBins(1, 60)).toThrow();
    expect(() => uniformEnergyBins(1000, 45)).toThrow();
    expect(() => alignedCarbonMg([500, 500], [100])).toThrow();
    expect(() => alignedCarbonMg([499, 501], [100, 100])).toThrow();
    // This numerator exceeds Number.MAX_SAFE_INTEGER while the final mg is safe.
    const factor = 10_000_000_000;
    expect(actualCarbonMg("2026-10-21T07:01:00Z", [500], snapshot([factor, factor]))).toBe(5_000_000_000_000);
  });
  it("sorts on a copy and rejects internally incomplete snapshots", () => {
    const grid = snapshot(); grid.intervals.reverse();
    const normalized = normalizeGridSnapshot(grid);
    expect(normalized.intervals[0]!.fromUtc).toBe("2026-10-21T07:00:00Z");
    expect(grid.intervals[0]!.fromUtc).toBe("2026-10-21T10:30:00Z");
    expect(() => normalizeGridSnapshot({ ...grid, intervals: grid.intervals.slice(0, 2).concat(grid.intervals.slice(3)) })).toThrow(expect.objectContaining({ code: "INVALID_GRID_SNAPSHOT" }));
  });
});
