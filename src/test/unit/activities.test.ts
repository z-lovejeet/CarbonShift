import { describe, expect, it } from "vitest";
import { decimalToInteger, resolveActivity, estimateActivity, activityInputSchema, resolvedActivitySchema, type ActivityInputV2 } from "@/domain/activities";
import { ACTIVITY_PROFILES } from "@/data/activity-profiles";
import { londonDayBounds, epochSeconds, halfHourCoverage } from "@/domain/time";
import { snapshot } from "../fixtures/domain";

const start = "2026-10-21T07:00:00Z";
function activity(changes: Partial<ActivityInputV2> = {}): ActivityInputV2 {
  return { schemaVersion: 2, id: "vacuum", name: "Vacuum the living room", category: "vacuuming", durationMinutes: 10, quantity: 1,
    energy: { kind: "average_power", powerMw: 900000, origin: "user_estimate", confirmed: true }, ...changes };
}

describe("v2 activity energy and source contract", () => {
  it("calculates a short vacuum session in mWh and mg from known independent units", () => {
    const load = resolveActivity(activity());
    expect(load.energyMwh).toBe(150000);
    expect(estimateActivity(load, start, snapshot([200]))).toMatchObject({ estimatedMg: 30000, endUtc: "2026-10-21T07:10:00Z", status: "available" });
  });
  it("integrates a television across distinct half-hour factors", () => {
    const load = resolveActivity(activity({ category: "television", durationMinutes: 60, energy: { kind: "average_power", powerMw: 100000, origin: "user_estimate", confirmed: true } }));
    expect(estimateActivity(load, start, snapshot([100, 300]))).toMatchObject({ energyMwh: 100000, estimatedMg: 20000 });
  });
  it("retains odd cycle energy and rounds carbon once across partial source intervals", () => {
    const load = resolveActivity(activity({ durationMinutes: 3, energy: { kind: "cycle_energy", energyMwh: 1001, origin: "user_estimate", confirmed: true } }));
    // One minute at 100 and two at 200: 1001 * (100/3 + 400/3) / 1000 = 166.833 mg.
    const result = estimateActivity(load, "2026-10-21T07:29:00Z", snapshot([100, 200]));
    expect(result.estimatedMg).toBe(167); expect(result.energyMwh).toBe(1001);
    expect(resolveActivity(activity({ energy: { kind: "cycle_energy", energyMwh: 1001000, origin: "device_label", confirmed: true } })).energyMwh).toBe(1001000);
  });
  it("multiplies device quantity exactly once before rounding power energy", () => {
    expect(resolveActivity(activity({ quantity: 3 })).energyMwh).toBe(450000);
    expect(resolveActivity(activity({ quantity: 3, energy: { kind: "cycle_energy", energyMwh: 17, origin: "user_estimate", confirmed: true } })).energyMwh).toBe(51);
    expect(resolveActivity(activity({ durationMinutes: 1, quantity: 3, energy: { kind: "average_power", powerMw: 100, origin: "user_estimate", confirmed: true } })).energyMwh).toBe(5);
  });
  it("parses decimal energy/power without float drift and rejects hidden rounding", () => {
    expect(decimalToInteger("0.100001", 6)).toBe(100001);
    expect(decimalToInteger("91.125", 3)).toBe(91125);
    for (const invalid of ["1e3", "-1", "1 W", "1.0001", "NaN"]) expect(() => decimalToInteger(invalid, 3)).toThrow();
  });
  it("requires confirmed complete inputs; task labels cannot supply wattage", () => {
    expect(activityInputSchema.safeParse({ ...activity(), energy: { kind: "average_power", confirmed: true } }).success).toBe(false);
    expect(activityInputSchema.safeParse({ ...activity(), energy: { ...activity().energy, confirmed: false } }).success).toBe(false);
    expect(() => resolveActivity(activity({ energy: { kind: "reference", profileId: "invented", profileVersion: 1, confirmed: true } }), ACTIVITY_PROFILES)).toThrow();
  });
  it("resolves reviewed exact profiles and keeps rating limits visible", () => {
    const profile = ACTIVITY_PROFILES.find((p) => p.category === "car_cleaning")!;
    const result = resolveActivity(activity({ category: "car_cleaning", energy: { kind: "reference", profileId: profile.id, profileVersion: 1, confirmed: true } }), ACTIVITY_PROFILES);
    expect(result.energyMwh).toBe(233333); expect(result.limitations).toContain("nameplate_scenario"); expect(result.reference).toEqual(profile);
    expect(() => resolveActivity(activity({ energy: { kind: "reference", profileId: profile.id, profileVersion: 1, confirmed: true } }), ACTIVITY_PROFILES)).toThrow();
  });
  it("returns zero only for an explicitly confirmed direct-electricity-free activity", () => {
    const load = resolveActivity(activity({ category: "car_cleaning", energy: { kind: "no_direct_electricity", confirmed: true } }));
    expect(estimateActivity(load, start, snapshot([null]))).toMatchObject({ energyMwh: 0, estimatedMg: 0, status: "no_direct_electricity" });
    expect(load.limitations).toContain("electricity_only");
  });
  it("does not turn missing factors or uncovered time into zero emissions", () => {
    const load = resolveActivity(activity({ durationMinutes: 60 }));
    expect(estimateActivity(load, start, snapshot([0, 0])).estimatedMg).toBe(0);
    expect(estimateActivity(load, start, snapshot([0, null]))).toMatchObject({ estimatedMg: null, energyMwh: 900000, status: "incomplete_grid" });
    expect(estimateActivity(load, start, snapshot([200])).estimatedMg).toBeNull();
    const grid = snapshot([200, 200]); grid.intervals[0]!.actualGPerKwh = null;
    expect(estimateActivity(load, start, grid, "actual").estimatedMg).toBeNull();
    expect(estimateActivity(load, start, grid, "forecast").estimatedMg).toBe(180000);
  });
  it("checks segment conservation and handles variable segments without energy loss", () => {
    const base = resolveActivity(activity({ durationMinutes: 60, energy: { kind: "cycle_energy", energyMwh: 100000, origin: "user_estimate", confirmed: true } }));
    const segmented = { ...base, segments: [{ offsetSeconds: 0, durationSeconds: 1800, energyMwh: 75000 }, { offsetSeconds: 1800, durationSeconds: 1800, energyMwh: 25000 }] };
    expect(estimateActivity(segmented, start, snapshot([100, 300])).estimatedMg).toBe(15000);
    expect(resolvedActivitySchema.safeParse({ ...segmented, energyMwh: 99999 }).success).toBe(false);
  });
  it("bounds quantity and aggregate energy", () => {
    expect(() => resolveActivity(activity({ quantity: 51 }))).toThrow();
    expect(() => resolveActivity(activity({ quantity: 2, energy: { kind: "cycle_energy", energyMwh: 1000000000, origin: "user_estimate", confirmed: true } }))).toThrow();
  });
});

describe("v2 calendar and source range", () => {
  it("uses 23- and 25-hour London days, independent of the machine timezone", () => {
    for (const [date, hours] of [["2026-03-29", 23], ["2026-10-25", 25], ["2026-10-21", 24]] as const) {
      const day = londonDayBounds(date); expect(epochSeconds(day.endUtc) - epochSeconds(day.startUtc)).toBe(hours * 3600);
    }
    expect(() => londonDayBounds("2026-02-30")).toThrow();
  });
  it("pads short minute-level activities to their actual source interval coverage", () => {
    expect(halfHourCoverage("2026-10-21T07:29:00Z", "2026-10-21T07:32:00Z")).toEqual({ fromUtc: start, toUtc: "2026-10-21T08:00:00Z" });
  });
});
