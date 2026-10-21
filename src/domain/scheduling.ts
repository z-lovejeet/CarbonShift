import { z } from "zod";
import { alignedCarbonMg, carbonDifference } from "./carbon";
import { feasibleStarts, normalizeConstraints, planningCoverageStart } from "./constraints";
import { DomainError, parseDomain } from "./errors";
import { assertForecastFreshness, normalizeGridSnapshot, requireForecastCoverage } from "./grid";
import { freezeDomain, METHOD } from "./method";
import { uniformEnergyBins } from "./profile";
import { comparisonSchema, digestSchema, type CandidateV1, type ComparisonV1 } from "./schemas";
import { addSeconds, assertAcceptanceTime, ceilHalfHour, comparisonExpiry } from "./time";

export type ComparisonInput = {
  constraints: unknown;
  snapshot: unknown;
  forecastSnapshotId: string;
  forecastSnapshotHash: string;
};

/** All clock-dependent work is replayable by supplying the original creation instant. */
export function createComparison(input: ComparisonInput, nowUtc: string): ComparisonV1 {
  const constraints = normalizeConstraints(input.constraints);
  const starts = feasibleStarts(constraints, nowUtc);
  if (!starts.includes(constraints.baselineStartUtc)) throw new DomainError("INVALID_BASELINE", "Confirm a baseline that satisfies the same timing constraints.");
  if (constraints.baselineOrigin === "earliest_feasible_confirmed" && constraints.baselineStartUtc !== starts[0]) {
    throw new DomainError("INVALID_BASELINE", "The confirmed earliest-feasible baseline does not match this window.");
  }
  const snapshot = normalizeGridSnapshot(input.snapshot);
  assertForecastFreshness(snapshot, nowUtc);
  requireForecastCoverage(snapshot, planningCoverageStart(constraints, nowUtc), ceilHalfHour(constraints.deadlineUtc));
  const bins = uniformEnergyBins(constraints.energyWh, constraints.durationMinutes);
  const factors = new Map(snapshot.intervals.map((interval) => [interval.fromUtc, interval.forecastGPerKwh]));
  const candidates: CandidateV1[] = starts.map((startUtc) => {
    const used = bins.map((_, i) => {
      const factor = factors.get(addSeconds(startUtc, i * METHOD.intervalSeconds));
      if (factor == null) throw new DomainError("INCOMPLETE_GRID_COVERAGE", "A required forecast factor is missing.");
      return factor;
    });
    return { startUtc, endUtc: addSeconds(startUtc, constraints.durationMinutes * 60), energyWhBins: [...bins], factorGPerKwh: used, estimatedMg: alignedCarbonMg(bins, used), rank: 0 };
  });
  candidates.sort((a, b) => a.estimatedMg - b.estimatedMg || a.startUtc.localeCompare(b.startUtc));
  candidates.forEach((candidate, index) => { candidate.rank = index + 1; });
  // Feasibility and baseline checks above guarantee these exist.
  const selected = candidates[0]!, baseline = candidates.find((candidate) => candidate.startUtc === constraints.baselineStartUtc)!;
  return freezeDomain(parseDomain(comparisonSchema, {
    constraints, forecastSnapshotId: parseDomain(z.uuid(), input.forecastSnapshotId), forecastSnapshotHash: parseDomain(digestSchema, input.forecastSnapshotHash),
    baseline, selected, alternatives: candidates.slice(1, 1 + METHOD.maximumAlternatives),
    ...carbonDifference(baseline.estimatedMg, selected.estimatedMg), methodVersion: METHOD.version,
    createdAtUtc: nowUtc, expiresAtUtc: comparisonExpiry(nowUtc, baseline.startUtc, selected.startUtc),
  }));
}

export function parseSupportedComparison(input: unknown): ComparisonV1 {
  if (input !== null && typeof input === "object" && "methodVersion" in input && input.methodVersion !== METHOD.version) {
    throw new DomainError("UNSUPPORTED_METHOD", "This calculation method is not supported.");
  }
  return parseDomain(comparisonSchema, input);
}

/** Temporal/freshness gate only; ownership, snapshot identity and atomic persistence belong to M04. */
export function assertComparisonAcceptable(input: unknown, snapshotInput: unknown, nowUtc: string): void {
  const comparison = parseSupportedComparison(input);
  assertAcceptanceTime({ ...comparison, baselineStartUtc: comparison.baseline.startUtc, selectedStartUtc: comparison.selected.startUtc }, nowUtc);
  assertForecastFreshness(normalizeGridSnapshot(snapshotInput), nowUtc);
}
