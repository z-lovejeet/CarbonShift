import { describe, expect, it } from "vitest";
import { calculateUpdatedResult, type UpdatedResultInput } from "@/domain/results";
import { createComparison } from "@/domain/scheduling";
import { constraints, NOW, REPORT_ID, SNAPSHOT_HASH, SNAPSHOT_ID, snapshot } from "../fixtures/domain";

const UPDATED_NOW = "2026-10-21T12:00:00Z";
function input(): UpdatedResultInput {
  return {
    comparison: createComparison({ constraints: constraints(), snapshot: snapshot(), forecastSnapshotId: SNAPSHOT_ID, forecastSnapshotHash: SNAPSHOT_HASH }, NOW),
    acceptedAtUtc: "2026-10-21T06:01:00Z",
    report: { id: REPORT_ID, kind: "ran", reportedStartUtc: "2026-10-21T09:00:00Z", profileStillApplicable: true, createdAtUtc: "2026-10-21T10:01:00Z" },
    actualSnapshot: { ...snapshot([180, 200, 240, 240, 320, 360, 400, 400]), retrievedAtUtc: "2026-10-21T11:30:00Z" },
    actualSnapshotHash: SNAPSHOT_HASH,
  };
}
describe("M02.04 updated estimate projection (T09 domain subset)", () => {
  it("preserves the forecast while showing a signed negative updated difference", () => {
    const value = input(), original = JSON.stringify(value.comparison), result = calculateUpdatedResult(value, UPDATED_NOW);
    expect(result).toMatchObject({ status: "actual_estimate", baselineActualMg: 190000, reportedActualMg: 340000, differenceMg: -150000, executionBasis: "self_reported", energyBasis: "user_estimate", reasonCodes: [], deviationCodes: [] });
    expect(JSON.stringify(value.comparison)).toBe(original);
    expect(Object.isFrozen(result)).toBe(true);
  });
  it("returns forecast-only without report, never updated amounts", () => {
    const result = calculateUpdatedResult({ ...input(), report: null, actualSnapshot: null, actualSnapshotHash: null }, UPDATED_NOW);
    expect(result).toMatchObject({ status: "forecast_only", reportId: null, baselineActualMg: null, reportedActualMg: null, differenceMg: null });
  });
  it.each(["baseline", "run", "beginning", "end", "snapshot"])("suppresses all totals when %s coverage is missing", (kind) => {
    const grid = snapshot([180, 200, 240, 240, 320, 360, 400, 400]);
    if (kind === "baseline") grid.intervals[0]!.actualGPerKwh = null;
    if (kind === "run") grid.intervals[4]!.actualGPerKwh = null;
    if (kind === "beginning") grid.intervals.shift();
    if (kind === "end") grid.intervals = grid.intervals.slice(0, 5);
    const result = calculateUpdatedResult({ ...input(), actualSnapshot: kind === "snapshot" ? null : grid, actualSnapshotHash: kind === "snapshot" ? null : SNAPSHOT_HASH }, UPDATED_NOW);
    expect(result.status).toBe("actual_pending");
    for (const key of ["baselineActualMg", "reportedActualMg", "differenceMg", "differencePercent"] as const) expect(result[key]).toBeNull();
    expect(result.reasonCodes).toEqual([kind === "snapshot" ? "ACTUAL_SNAPSHOT_UNAVAILABLE" : "MISSING_ACTUAL_FACTORS"]);
  });
  it("allows refresh from pending to complete without changing earlier results", () => {
    const value = input();
    const pending = calculateUpdatedResult({ ...value, actualSnapshot: null, actualSnapshotHash: null }, UPDATED_NOW);
    expect(calculateUpdatedResult(value, UPDATED_NOW).status).toBe("actual_estimate");
    expect(pending.status).toBe("actual_pending");
  });
  it("does not award savings for non-execution", () => {
    const value = input();
    value.report = { id: REPORT_ID, kind: "did_not_run", reportedStartUtc: null, profileStillApplicable: null, createdAtUtc: "2026-10-21T10:00:00Z" };
    expect(calculateUpdatedResult(value, UPDATED_NOW)).toMatchObject({ status: "did_not_run", baselineActualMg: null, reportedActualMg: null, differenceMg: null, snapshotHash: null });
    value.report.createdAtUtc = "2026-10-21T09:59:59Z";
    expect(() => calculateUpdatedResult(value, UPDATED_NOW)).toThrow(expect.objectContaining({ code: "INVALID_REPORT" }));
  });
  it("records a blocked/changed start without rewriting the constraints", () => {
    const value = input();
    const c = { ...constraints(), blockedIntervals: [{ startUtc: "2026-10-21T08:00:00Z", endUtc: "2026-10-21T09:00:00Z" }] };
    value.comparison = createComparison({ constraints: c, snapshot: snapshot(), forecastSnapshotId: SNAPSHOT_ID, forecastSnapshotHash: SNAPSHOT_HASH }, NOW);
    if (value.report?.kind === "ran") value.report.reportedStartUtc = "2026-10-21T08:15:00Z";
    const result = calculateUpdatedResult(value, UPDATED_NOW);
    expect(result.status).toBe("actual_estimate");
    expect(result.deviationCodes).toEqual(["DIFFERENT_START", "BLOCKED_PERIOD"]);
    expect((value.comparison as { constraints: unknown }).constraints).toEqual(c);
  });
  it("handles an early start and finish after deadline as deviations", () => {
    const value = input();
    if (value.report?.kind === "ran") value.report.reportedStartUtc = "2026-10-21T06:15:00Z";
    expect(calculateUpdatedResult(value, UPDATED_NOW).deviationCodes).toContain("BEFORE_EARLIEST");
    if (value.report?.kind === "ran") { value.report.reportedStartUtc = "2026-10-21T10:30:00Z"; value.report.createdAtUtc = "2026-10-21T11:30:00Z"; }
    expect(calculateUpdatedResult(value, UPDATED_NOW).deviationCodes).toContain("AFTER_DEADLINE");
  });
  it("keeps changed profiles unsupported even with complete actual data", () => {
    const value = input();
    if (value.report?.kind === "ran") value.report.profileStillApplicable = false;
    expect(calculateUpdatedResult(value, UPDATED_NOW)).toMatchObject({ status: "outside_supported_window", reasonCodes: ["PROFILE_CHANGED"], baselineActualMg: null, reportedActualMg: null, differenceMg: null });
  });
  it("supports exactly deadline+24h, but preserves later reports as unsupported", () => {
    const value = input();
    if (value.report?.kind === "ran") { value.report.reportedStartUtc = "2026-10-22T11:00:00Z"; value.report.createdAtUtc = "2026-10-22T12:01:00Z"; }
    expect(calculateUpdatedResult(value, "2026-10-22T13:00:00Z").status).toBe("actual_pending");
    if (value.report?.kind === "ran") value.report.reportedStartUtc = "2026-10-22T11:01:00Z";
    expect(calculateUpdatedResult(value, "2026-10-22T13:00:00Z")).toMatchObject({ status: "outside_supported_window", reasonCodes: ["REPORT_TOO_LATE"], differenceMg: null });
  });
  it.each(["before_acceptance", "future_creation", "unfinished_at_report", "future_acceptance"])("rejects invalid report timing: %s", (kind) => {
    const value = input();
    if (value.report?.kind === "ran") {
      if (kind === "before_acceptance") value.report.reportedStartUtc = "2026-10-21T06:00:00Z";
      if (kind === "future_creation") value.report.createdAtUtc = "2026-10-22T10:00:00Z";
      if (kind === "unfinished_at_report") value.report.createdAtUtc = "2026-10-21T09:59:00Z";
    }
    if (kind === "future_acceptance") value.acceptedAtUtc = "2026-10-22T06:00:00Z";
    expect(() => calculateUpdatedResult(value, UPDATED_NOW)).toThrow();
  });
  it("requires digest/data pairs and rejects future actual retrieval", () => {
    expect(() => calculateUpdatedResult({ ...input(), actualSnapshotHash: null }, UPDATED_NOW)).toThrow();
    expect(() => calculateUpdatedResult({ ...input(), actualSnapshot: null }, UPDATED_NOW)).toThrow();
    expect(() => calculateUpdatedResult({ ...input(), actualSnapshot: { ...snapshot(), retrievedAtUtc: "2026-10-22T12:00:00Z" } }, UPDATED_NOW)).toThrow(expect.objectContaining({ code: "FUTURE_GRID_SNAPSHOT" }));
  });
  it("handles complete actual zeroes without division by zero", () => {
    expect(calculateUpdatedResult({ ...input(), actualSnapshot: snapshot(Array(8).fill(0)) }, UPDATED_NOW)).toMatchObject({ status: "actual_estimate", baselineActualMg: 0, reportedActualMg: 0, differenceMg: 0, differencePercent: null });
  });
});
