import "server-only";
import { z } from "zod";
import { planSchema } from "@/contracts/planning";
import { reportDocumentSchema, resultRevisionSchema } from "@/contracts/lifecycle";
import { freezeDomain, METHOD } from "@/domain/method";
import { precommitCutoff } from "@/domain/time";
import { assertComparisonAcceptable } from "@/domain/scheduling";
import { canonicalJson, hashMethod, hashPlan, hashResult } from "@/domain/proof/canonical";
import { METHOD_DESCRIPTOR } from "@/domain/proof/method-descriptor";
import { planManifestSchema, resultManifestSchema, PROOF_CHAIN_ID, type PlanManifestV1 } from "@/domain/proof/schemas";
import { hashGridSnapshot } from "@/server/grid/snapshot";
import { GRID_POLICY } from "@/server/grid/provider";

const identitySchema = z.strictObject({ receiptId: planManifestSchema.shape.receiptId, nonce: planManifestSchema.shape.nonce, contractAddress: planManifestSchema.shape.contractAddress });
/** Explicit allowlist projection: private IDs, raw prose, notes and derived percentage never escape. */
export function buildPlanManifest(planInput: unknown, identityInput: unknown): PlanManifestV1 {
  const p = planSchema.parse(planInput), identity = identitySchema.parse(identityInput), c = p.comparison;
  assertComparisonAcceptable(c, p.forecastSnapshot, p.acceptedAtUtc);
  if (hashGridSnapshot(p.forecastSnapshot) !== c.forecastSnapshotHash) throw new Error("Forecast snapshot does not match the accepted record.");
  const window = ({ startUtc, endUtc, estimatedMg }: typeof c.selected) => ({ startUtc, endUtc, estimatedMg });
  const projected = {
    schemaVersion: 1, type: "plan", ...identity, mode: p.mode, chainId: PROOF_CHAIN_ID, methodVersion: METHOD.version, methodHash: hashMethod(METHOD_DESCRIPTOR),
    comparisonCreatedAtUtc: c.createdAtUtc, acceptedAtUtc: p.acceptedAtUtc, commitBeforeUtc: precommitCutoff(c.baseline.startUtc, c.selected.startUtc),
    constraints: c.constraints, energyWhBins: c.selected.energyWhBins, forecastSnapshot: p.forecastSnapshot,
    baseline: window(c.baseline), selected: window(c.selected), differenceMg: c.differenceMg, executionBasis: "not_observed", attribution: GRID_POLICY.attribution,
  };
  canonicalJson(projected);
  return freezeDomain(planManifestSchema.parse(projected));
}
const resultOptionsSchema = z.strictObject({ nonce: resultManifestSchema.shape.nonce, publicRevision: resultManifestSchema.shape.publicRevision, previousResultHash: resultManifestSchema.shape.previousResultHash, correctionExplanation: resultManifestSchema.shape.correctionExplanation });
export function buildResultManifest(planInput: unknown, manifestInput: unknown, reportInput: unknown, revisionInput: unknown, actualSnapshot: unknown, optionsInput: unknown) {
  const p = planSchema.parse(planInput), plan = planManifestSchema.parse(manifestInput), report = reportDocumentSchema.parse(reportInput), revision = resultRevisionSchema.parse(revisionInput), options = resultOptionsSchema.parse(optionsInput);
  // A result is built only from this plan's retained immutable records, not a client-selected pairing.
  if (report.planId !== p.id || revision.planId !== p.id || revision.reportId !== report.id ||
    !p.reports.some((r) => canonicalJson(r) === canonicalJson(report)) || !p.revisions.some((r) => JSON.stringify(r) === JSON.stringify(revision))) throw new Error("Result and report must belong to the retained plan history.");
  const expected = buildPlanManifest(p, { receiptId: plan.receiptId, nonce: plan.nonce, contractAddress: plan.contractAddress });
  if (hashPlan(expected) !== hashPlan(plan)) throw new Error("Public plan differs from the accepted plan.");
  const result = revision.result;
  if ((actualSnapshot === null) !== (result.snapshotHash === null) || actualSnapshot !== null && hashGridSnapshot(actualSnapshot) !== result.snapshotHash) throw new Error("Actual snapshot differs from the immutable result reference.");
  const output = {
    schemaVersion: 1, type: "result", receiptId: plan.receiptId, ...options, mode: plan.mode, chainId: plan.chainId, contractAddress: plan.contractAddress,
    planHash: hashPlan(plan), methodVersion: result.methodVersion, methodHash: plan.methodHash, privateResultRevisionNumber: revision.sequence,
    reportedKind: report.kind, reportedStartUtc: report.reportedStartUtc, reportCreatedAtUtc: report.createdAtUtc, resultCreatedAtUtc: revision.createdAtUtc,
    reportSource: report.source, profileStillApplicable: report.profileStillApplicable, executionBasis: "self_reported", energyBasis: result.energyBasis,
    resultStatus: result.status, baselineActualMg: result.baselineActualMg, reportedActualMg: result.reportedActualMg, differenceMg: result.differenceMg,
    actualSnapshot, reasonCode: report.source === "cancellation" ? "cancelled_before_start" : result.reasonCodes[0] ?? null,
  };
  hashResult(output);
  return freezeDomain(resultManifestSchema.parse(output));
}
