import { describe, expect, it } from "vitest";
import { candidateSchema, comparisonSchema, confirmedConstraintsSchema, executionReportSchema, gridSnapshotSchema, updatedResultSchema, utcInstantSchema } from "@/domain/schemas";
import { DomainError, parseDomain } from "@/domain/errors";
import { candidate, comparison, constraints, NOW, REPORT_ID, snapshot } from "../fixtures/domain";

describe("M02.01 shared domain contracts (T03/T06)", () => {
  it("accepts explicit units and clones the input", () => {
    const input = constraints();
    expect(confirmedConstraintsSchema.parse(input)).toEqual(input);
    expect(confirmedConstraintsSchema.parse(input)).not.toBe(input);
    expect(candidateSchema.parse(candidate())).toEqual(candidate());
    expect(comparisonSchema.parse(comparison())).toEqual(comparison());
  });
  it.each([
    { energyWh: 49 }, { energyWh: 5001 }, { energyWh: 0 }, { energyWh: null }, { energyWh: 1000.1 }, { energyWh: "1000" },
    { durationMinutes: 45 }, { durationMinutes: 0 }, { durationMinutes: 181 }, { timezone: "Asia/Kolkata" },
    { geography: "IN" }, { energyKwh: 1 }, { ownerId: "someone" }, { deadlineUtc: NOW }, { baselineStartUtc: null },
  ])("rejects invalid or unexpected constraints %j", (change) => {
    expect(confirmedConstraintsSchema.safeParse({ ...constraints(), ...change }).success).toBe(false);
  });
  it.each(["2026-02-30T07:00:00Z", "2026-10-21T07:00Z", "2026-10-21T07:00:00.000Z", "2026-10-21T08:00:00+01:00", "2026-10-21T24:00:00Z", "2026-10-21T07:00:60Z", "bad", null])("rejects noncanonical or invalid UTC %j", (value) => {
    expect(utcInstantSchema.safeParse(value).success).toBe(false);
  });
  it("rejects overlapping, reversed, out-of-range and excessive blocks, permitting touching", () => {
    const block = { startUtc: "2026-10-21T08:00:00Z", endUtc: "2026-10-21T09:00:00Z" };
    const parse = (blockedIntervals: unknown) => confirmedConstraintsSchema.safeParse({ ...constraints(), blockedIntervals }).success;
    expect(parse([block, { startUtc: block.endUtc, endUtc: "2026-10-21T10:00:00Z" }])).toBe(true);
    expect(parse([block, block])).toBe(false);
    expect(parse([{ startUtc: block.endUtc, endUtc: block.startUtc }])).toBe(false);
    expect(parse([{ ...block, startUtc: NOW }])).toBe(false);
    expect(parse(Array.from({ length: 5 }, () => block))).toBe(false);
  });
  it("retains missing actual and forecast factors as null, not zero", () => {
    const value = gridSnapshotSchema.parse(snapshot([null, 0]));
    expect(value.intervals[0]!.actualGPerKwh).toBeNull();
    expect(value.intervals[1]!.forecastGPerKwh).toBe(0);
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "100", undefined])("rejects unsafe/wrong grid factors %j", (factor) => {
    const value = snapshot();
    expect(gridSnapshotSchema.safeParse({ ...value, intervals: [{ ...value.intervals[0], forecastGPerKwh: factor }] }).success).toBe(false);
  });
  it("rejects duplicates, gaps, overlap, wrong lengths and mismatched bins", () => {
    const grid = snapshot();
    expect(gridSnapshotSchema.safeParse({ ...grid, intervals: [grid.intervals[0], grid.intervals[0]] }).success).toBe(false);
    expect(gridSnapshotSchema.safeParse({ ...grid, intervals: grid.intervals.slice(0, 1).concat(grid.intervals.slice(2)) }).success).toBe(false);
    expect(gridSnapshotSchema.safeParse({ ...grid, intervals: [{ ...grid.intervals[0], toUtc: "2026-10-21T07:45:00Z" }] }).success).toBe(false);
    for (const change of [{ energyWhBins: [500] }, { factorGPerKwh: [100] }, { estimatedMg: 1 }, { rank: 0 }, { energyWhBins: [499, 501] }]) {
      expect(candidateSchema.safeParse({ ...candidate(), ...change }).success).toBe(false);
    }
  });
  it("rejects inconsistent comparison output and unknown methods", () => {
    for (const change of [{ differenceMg: 2 }, { differencePercent: null }, { methodVersion: "future" }, { expiresAtUtc: NOW }, { expiresAtUtc: "2026-10-21T06:10:00Z" }, { alternatives: [comparison().selected] }]) {
      expect(comparisonSchema.safeParse({ ...comparison(), ...change }).success).toBe(false);
    }
  });
  it("requires explicit report kind/profile confirmation and minute precision", () => {
    const report = { id: REPORT_ID, kind: "ran", reportedStartUtc: "2026-10-21T09:00:00Z", profileStillApplicable: false, createdAtUtc: "2026-10-21T10:00:00Z" };
    expect(executionReportSchema.safeParse(report).success).toBe(true);
    expect(executionReportSchema.safeParse({ ...report, profileStillApplicable: undefined }).success).toBe(false);
    expect(executionReportSchema.safeParse({ ...report, reportedStartUtc: "2026-10-21T09:00:01Z" }).success).toBe(false);
    expect(executionReportSchema.safeParse({ ...report, kind: "did_not_run" }).success).toBe(false);
  });
  it("prevents numeric success in an unavailable result", () => {
    expect(updatedResultSchema.safeParse({ status: "actual_pending", executionBasis: "self_reported", energyBasis: "user_estimate", methodVersion: "carbonshift-gb-uniform-v1", reportId: REPORT_ID, snapshotHash: null, baselineActualMg: 0, reportedActualMg: null, differenceMg: null, differencePercent: null, reasonCodes: ["MISSING_ACTUAL_FACTORS"], deviationCodes: [] }).success).toBe(false);
  });
  it("exposes typed, structured errors without copying invalid input values", () => {
    try { parseDomain(confirmedConstraintsSchema, { ...constraints(), energyWh: "private-invalid-value" }); }
    catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toMatchObject({ code: "INVALID_INPUT", fieldErrors: [{ path: "energyWh", message: expect.any(String) }] });
      expect(JSON.stringify(error)).not.toContain("private-invalid-value");
      return;
    }
    throw new Error("Expected validation failure");
  });
});
