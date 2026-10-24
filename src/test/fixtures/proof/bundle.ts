/** Authored synthetic proof only. No address, time or factor here is live deployment evidence. */
import { constraints, NOW, snapshot, SNAPSHOT_ID, SNAPSHOT_HASH, REPORT_ID } from "../domain";
import { createComparison } from "../../../domain/scheduling";
import { calculateUpdatedResult } from "../../../domain/results";
import { METHOD_DESCRIPTOR } from "../../../domain/proof/method-descriptor";
import { hashMethod, hashPlan, hashResult } from "../../../domain/proof/canonical";
import { proofBundleSchema, ZERO_HASH, PROOF_CHAIN_ID } from "../../../domain/proof/schemas";

export function proofBundle(contractAddress = `0x${"1".repeat(40)}`, mode: "live" | "demo" = "live") {
  const grid = snapshot();
  const comparison = createComparison({ constraints: constraints(), snapshot: grid, forecastSnapshotId: SNAPSHOT_ID, forecastSnapshotHash: SNAPSHOT_HASH }, NOW);
  const window = (v: typeof comparison.selected) => ({ startUtc: v.startUtc, endUtc: v.endUtc, estimatedMg: v.estimatedMg });
  const plan = {
    schemaVersion: 1 as const, type: "plan" as const, receiptId: `0x${"2".repeat(64)}`, nonce: `0x${"3".repeat(64)}`, mode,
    chainId: PROOF_CHAIN_ID as 11155111, contractAddress, methodVersion: METHOD_DESCRIPTOR.methodVersion, methodHash: hashMethod(METHOD_DESCRIPTOR),
    comparisonCreatedAtUtc: NOW, acceptedAtUtc: "2026-10-21T06:01:00Z", commitBeforeUtc: mode === "live" ? comparison.baseline.startUtc : null,
    constraints: comparison.constraints, energyWhBins: comparison.selected.energyWhBins, forecastSnapshot: grid,
    baseline: window(comparison.baseline), selected: window(comparison.selected), differenceMg: comparison.differenceMg, executionBasis: "not_observed" as const,
    attribution: "Authored synthetic fixture; NESO API format, CC BY 4.0",
  };
  const report = { id: REPORT_ID, createdAtUtc: "2026-10-21T12:00:00Z", kind: "ran" as const, reportedStartUtc: "2026-10-21T09:15:00Z", profileStillApplicable: true };
  const actual = { ...snapshot([100, 100, 500, 500, 500, 500, 500, 500]), retrievedAtUtc: "2026-10-21T13:00:00Z" };
  const project = (publicRevision: number, previousResultHash: string, actualSnapshot: typeof actual | null) => {
    const now = publicRevision === 1 ? report.createdAtUtc : actual.retrievedAtUtc;
    const calculated = calculateUpdatedResult({ comparison, acceptedAtUtc: plan.acceptedAtUtc, report, actualSnapshot, actualSnapshotHash: actualSnapshot === null ? null : SNAPSHOT_HASH }, now);
    return {
      schemaVersion: 1, type: "result", receiptId: plan.receiptId, nonce: `0x${String(publicRevision + 3).repeat(64)}`, mode,
      chainId: plan.chainId, contractAddress, planHash: hashPlan(plan), methodVersion: plan.methodVersion, methodHash: plan.methodHash,
      publicRevision, previousResultHash, privateResultRevisionNumber: publicRevision === 1 ? 1 : 3,
      reportedKind: report.kind, reportedStartUtc: report.reportedStartUtc, reportCreatedAtUtc: report.createdAtUtc, resultCreatedAtUtc: now,
      reportSource: "report", profileStillApplicable: true, executionBasis: mode === "live" ? "self_reported" : "simulated", energyBasis: calculated.energyBasis,
      resultStatus: calculated.status, baselineActualMg: calculated.baselineActualMg, reportedActualMg: calculated.reportedActualMg, differenceMg: calculated.differenceMg,
      actualSnapshot, reasonCode: calculated.reasonCodes[0] ?? null, correctionExplanation: publicRevision === 1 ? "" : "Actual factors became available.",
    };
  };
  const first = project(1, ZERO_HASH, null), second = project(2, hashResult(first), actual);
  return proofBundleSchema.parse({ schemaVersion: 1, plan, results: [first, second], method: METHOD_DESCRIPTOR, chainReferences: null });
}
