import { describe, expect, it, vi } from "vitest";
import accounting from "@/fixtures/demo/accounting-v1.json" with { type: "json" };
import { GB_UNIFORM_V1_FIXTURE as fixture } from "@/fixtures/demo/gb-uniform-v1";
import { actualCarbonMg } from "@/domain/carbon";
import { METHOD } from "@/domain/method";
import { uniformEnergyBins } from "@/domain/profile";
import { calculateUpdatedResult, type UpdatedResultInput } from "@/domain/results";
import { createComparison } from "@/domain/scheduling";
import { REPORT_ID, snapshot } from "../fixtures/domain";

const fixtureComparison = (constraints: unknown = fixture.constraints, grid: unknown = fixture.snapshot) => createComparison({ constraints, snapshot: grid, forecastSnapshotId: fixture.snapshotReference.id, forecastSnapshotHash: fixture.snapshotReference.hash }, fixture.nowUtc);
describe("M02.05 frozen authored v1 fixtures", () => {
  it("retains explicit demo provenance and immutable method assumptions", () => {
    for (const value of [fixture, accounting]) {
      expect(value.mode).toBe("demo"); expect(value.dataOrigin).toBe("authored_synthetic"); expect(value.label.length).toBeGreaterThan(30);
    }
    expect(fixture.fixtureVersion).toBe("carbonshift-authored-gb-v1");
    expect(accounting.fixtureVersion).toBe("carbonshift-authored-accounting-v1");
    expect(Object.isFrozen(fixture.constraints)).toBe(true);
    expect(Object.isFrozen(METHOD.durationsMinutes)).toBe(true);
    expect(fixture.snapshot.sourceUrl).toContain("example.invalid");
    expect(fixture.snapshotReference.meaning).toContain("not a computed snapshot digest");
  });
  it("replays all expected planning amounts, windows, ranks and expiry without network or ambient time", () => {
    const network = vi.fn(() => { throw new Error("Unexpected network access"); });
    vi.stubGlobal("fetch", network); vi.useFakeTimers(); vi.setSystemTime(new Date("2045-01-01T00:00:00Z"));
    try {
      const result = fixtureComparison(), expected = fixture.expected;
      expect(result).toMatchObject({ methodVersion: expected.methodVersion, differenceMg: expected.differenceMg, differencePercent: expected.differencePercent, expiresAtUtc: expected.expiresAtUtc });
      expect(result.baseline).toMatchObject({ startUtc: expected.baselineStartUtc, estimatedMg: expected.baselineMg });
      expect(result.selected).toMatchObject({ startUtc: expected.selectedStartUtc, estimatedMg: expected.selectedMg });
      expect(result.alternatives.map((candidate) => candidate.startUtc)).toEqual(expected.alternativeStartsUtc);
      expect(result.alternatives.map((candidate) => candidate.estimatedMg)).toEqual(expected.alternativeMg);
      expect(fixtureComparison()).toEqual(result); expect(network).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it("reproduces odd energy, overlap and one-time rounding vectors", () => {
    const { oddEnergy, overlap, roundOnce } = accounting;
    expect(uniformEnergyBins(oddEnergy.energyWh, oddEnergy.durationMinutes)).toEqual(oddEnergy.expectedBins);
    for (const vector of [overlap, roundOnce]) expect(actualCarbonMg(vector.startUtc, vector.energyWhBins, snapshot(vector.actualFactors))).toBe(vector.expectedMg);
  });
  it("reproduces zero, tie and single-feasible-candidate vectors", () => {
    for (const factors of [accounting.zero.factors, accounting.tie.factors]) {
      const result = fixtureComparison(fixture.constraints, { ...fixture.snapshot, intervals: snapshot(factors).intervals });
      expect(result.differenceMg).toBe(0); expect(result.selected.startUtc).toBe(accounting.tie.expectedStartUtc);
      if (factors === accounting.zero.factors) expect(result.differencePercent).toBeNull();
    }
    const result = fixtureComparison({ ...fixture.constraints, deadlineUtc: accounting.singleCandidate.deadlineUtc }, { ...fixture.snapshot, intervals: snapshot(accounting.singleCandidate.factors).intervals });
    expect(result.selected.startUtc).toBe(accounting.singleCandidate.expectedStartUtc); expect(result.differenceMg).toBe(0); expect(result.alternatives).toHaveLength(0);
  });
  it("reproduces updated negative, pending, non-run, changed-profile and blocked-deviation vectors", () => {
    const vector = accounting.updated;
    const report = { id: REPORT_ID, kind: "ran" as const, reportedStartUtc: vector.reportedStartUtc, profileStillApplicable: true, createdAtUtc: vector.reportCreatedAtUtc };
    const input: UpdatedResultInput = { comparison: fixtureComparison(), acceptedAtUtc: fixture.nowUtc, report, actualSnapshot: snapshot(vector.actualFactors), actualSnapshotHash: fixture.snapshotReference.hash };
    expect(calculateUpdatedResult(input, vector.nowUtc)).toMatchObject({ baselineActualMg: vector.expectedBaselineMg, reportedActualMg: vector.expectedReportedMg, differenceMg: vector.expectedDifferenceMg });
    const missing = snapshot(vector.actualFactors); missing.intervals[vector.missingFactorIndex]!.actualGPerKwh = null;
    expect(calculateUpdatedResult({ ...input, actualSnapshot: missing }, vector.nowUtc)).toMatchObject({ status: vector.missingStatus, baselineActualMg: null, reportedActualMg: null, differenceMg: null });
    expect(calculateUpdatedResult({ ...input, report: { ...report, kind: "did_not_run", reportedStartUtc: null, profileStillApplicable: null } }, vector.nowUtc).status).toBe(vector.nonRunStatus);
    expect(calculateUpdatedResult({ ...input, report: { ...report, profileStillApplicable: false } }, vector.nowUtc)).toMatchObject({ status: vector.changedProfileStatus, reasonCodes: [vector.changedProfileReason], differenceMg: null });
    const block = accounting.blockedDeviation;
    const comparison = fixtureComparison({ ...fixture.constraints, blockedIntervals: [{ startUtc: block.startUtc, endUtc: block.endUtc }] });
    expect(calculateUpdatedResult({ ...input, comparison, report: { ...report, reportedStartUtc: block.reportedStartUtc } }, vector.nowUtc).deviationCodes).toEqual(block.expectedDeviations);
  });
});
