import { z } from "zod";
import { actualCarbonMg, carbonDifference } from "./carbon";
import { DomainError, parseDomain } from "./errors";
import { normalizeGridSnapshot } from "./grid";
import { freezeDomain, METHOD } from "./method";
import { uniformEnergyBins } from "./profile";
import { digestSchema, executionReportSchema, updatedResultSchema, utcInstantSchema, type UpdatedResultV1 } from "./schemas";
import { parseSupportedComparison } from "./scheduling";
import { addSeconds, assertAcceptanceTime, epochSeconds, overlaps } from "./time";

const resultInputSchema = z.strictObject({
  comparison: z.unknown(), acceptedAtUtc: utcInstantSchema, report: executionReportSchema.nullable(),
  actualSnapshot: z.unknown().nullable(), actualSnapshotHash: digestSchema.nullable(),
});
export type UpdatedResultInput = z.infer<typeof resultInputSchema>;

/** A projection only: no fetching, persistence, report correction or plan-status mutation. */
export function calculateUpdatedResult(input: UpdatedResultInput, nowUtc: string): UpdatedResultV1 {
  const value = parseDomain(resultInputSchema, input, "INVALID_REPORT");
  const comparison = parseSupportedComparison(value.comparison);
  const now = epochSeconds(nowUtc), accepted = epochSeconds(value.acceptedAtUtc);
  assertAcceptanceTime({ ...comparison, baselineStartUtc: comparison.baseline.startUtc, selectedStartUtc: comparison.selected.startUtc }, value.acceptedAtUtc);
  if (accepted > now) throw new DomainError("INVALID_REPORT", "Acceptance cannot be in the future.");
  const base: UpdatedResultV1 = {
    status: "forecast_only", executionBasis: "self_reported", energyBasis: comparison.constraints.energyBasis, methodVersion: METHOD.version,
    reportId: value.report?.id ?? null, snapshotHash: null,
    baselineActualMg: null, reportedActualMg: null, differenceMg: null, differencePercent: null, reasonCodes: [], deviationCodes: [],
  };
  const finish = (updates: Partial<UpdatedResultV1>) => freezeDomain(parseDomain(updatedResultSchema, { ...base, ...updates }));
  const report = value.report;
  if (report === null) return finish({});
  const reportedAt = epochSeconds(report.createdAtUtc);
  if (reportedAt < accepted || reportedAt > now) throw new DomainError("INVALID_REPORT", "Report creation must lie between acceptance and the current clock.");
  if (report.kind === "did_not_run") {
    if (reportedAt < epochSeconds(comparison.selected.endUtc)) throw new DomainError("INVALID_REPORT", "Report non-execution after the planned cycle has ended; early cancellation is a separate action.");
    return finish({ status: "did_not_run" });
  }
  const start = epochSeconds(report.reportedStartUtc);
  const endUtc = addSeconds(report.reportedStartUtc, comparison.constraints.durationMinutes * 60);
  if (start < accepted || epochSeconds(endUtc) > reportedAt) throw new DomainError("INVALID_REPORT", "The reported run must start after acceptance and finish before report creation.");
  const deviationCodes: UpdatedResultV1["deviationCodes"] = [];
  if (report.reportedStartUtc !== comparison.selected.startUtc) deviationCodes.push("DIFFERENT_START");
  if (report.reportedStartUtc < comparison.constraints.earliestStartUtc) deviationCodes.push("BEFORE_EARLIEST");
  if (endUtc > comparison.constraints.deadlineUtc) deviationCodes.push("AFTER_DEADLINE");
  if (comparison.constraints.blockedIntervals.some((block) => overlaps(report.reportedStartUtc, endUtc, block.startUtc, block.endUtc))) deviationCodes.push("BLOCKED_PERIOD");
  if (!report.profileStillApplicable) return finish({ status: "outside_supported_window", reasonCodes: ["PROFILE_CHANGED"], deviationCodes });
  if (start > epochSeconds(comparison.constraints.deadlineUtc) + METHOD.resultStartExtensionSeconds) {
    return finish({ status: "outside_supported_window", reasonCodes: ["REPORT_TOO_LATE"], deviationCodes });
  }
  if (value.actualSnapshot === null) {
    if (value.actualSnapshotHash !== null) throw new DomainError("INVALID_REPORT", "A snapshot reference requires its data.");
    return finish({ status: "actual_pending", reasonCodes: ["ACTUAL_SNAPSHOT_UNAVAILABLE"], deviationCodes });
  }
  if (value.actualSnapshotHash === null) throw new DomainError("INVALID_REPORT", "An actual snapshot requires its trusted digest reference.");
  const snapshot = normalizeGridSnapshot(value.actualSnapshot);
  if (epochSeconds(snapshot.retrievedAtUtc) > now) throw new DomainError("FUTURE_GRID_SNAPSHOT", "Actual snapshot retrieval cannot be in the future.");
  const bins = uniformEnergyBins(comparison.constraints.energyWh, comparison.constraints.durationMinutes);
  const baselineActualMg = actualCarbonMg(comparison.baseline.startUtc, bins, snapshot);
  const reportedActualMg = actualCarbonMg(report.reportedStartUtc, bins, snapshot);
  if (baselineActualMg === null || reportedActualMg === null) {
    return finish({ status: "actual_pending", snapshotHash: value.actualSnapshotHash, reasonCodes: ["MISSING_ACTUAL_FACTORS"], deviationCodes });
  }
  return finish({ status: "actual_estimate", snapshotHash: value.actualSnapshotHash, baselineActualMg, reportedActualMg,
    ...carbonDifference(baselineActualMg, reportedActualMg), deviationCodes });
}
