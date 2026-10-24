import { describe, expect, it } from "vitest";
import { createComparison } from "@/domain/scheduling";
import { calculateUpdatedResult } from "@/domain/results";
import { buildPlanManifest, buildResultManifest } from "@/server/proof/builders";
import { createProofIdentity } from "@/server/proof/identity";
import { hashGridSnapshot } from "@/server/grid/snapshot";
import { constraints, NOW, snapshot, SNAPSHOT_ID, REPORT_ID } from "../fixtures/domain";
import { hashPlan } from "@/domain/proof/canonical";
import { ZERO_HASH, planManifestSchema, resultManifestSchema } from "@/domain/proof/schemas";

function privatePlan() {
  const grid = snapshot();
  const comparison = createComparison({ constraints: constraints(), snapshot: grid, forecastSnapshotId: SNAPSHOT_ID, forecastSnapshotHash: hashGridSnapshot(grid) }, NOW);
  return { schemaVersion: 1, id: "f780ff0d-0e5c-4c7c-92a4-ea1b03bd6ffa", version: 1, comparisonId: SNAPSHOT_ID, mode: "live", status: "accepted", acceptedAtUtc: "2026-10-21T06:01:00Z", comparison, forecastSnapshot: grid, completion: "not_reported", publication: "private", latestReport: null, latestResult: null, reports: [] as unknown[], revisions: [] as unknown[] };
}
const identity = { receiptId: `0x${"2".repeat(64)}`, nonce: `0x${"3".repeat(64)}`, contractAddress: `0x${"1".repeat(40)}` };
function reportFixture(profile = true, cancellation = false) {
  const plan = privatePlan();
  const report = { schemaVersion: 1, id: REPORT_ID, planId: plan.id, sequence: 1, createdAtUtc: cancellation ? "2026-10-21T06:02:00Z" : "2026-10-21T12:00:00Z", kind: cancellation ? "did_not_run" : "ran", reportedStartUtc: cancellation ? null : "2026-10-21T09:00:00Z", profileStillApplicable: cancellation ? null : profile, correctsReportId: null, source: cancellation ? "cancellation" : "report", reason: cancellation ? "cancelled_before_start" : "private alice@example.com", note: "private household note" };
  const result = cancellation ? { status: "did_not_run", executionBasis: "self_reported", energyBasis: "user_estimate", methodVersion: plan.comparison.methodVersion, reportId: REPORT_ID, snapshotHash: null, baselineActualMg: null, reportedActualMg: null, differenceMg: null, differencePercent: null, reasonCodes: [], deviationCodes: [] } : calculateUpdatedResult({ comparison: plan.comparison, acceptedAtUtc: plan.acceptedAtUtc, report: { id: report.id, kind: "ran", createdAtUtc: report.createdAtUtc, reportedStartUtc: report.reportedStartUtc!, profileStillApplicable: profile }, actualSnapshot: null, actualSnapshotHash: null }, report.createdAtUtc);
  const revision = { schemaVersion: 1, id: "655fb99a-4ed1-4b70-b5e9-abd3de513526", planId: plan.id, sequence: 1, reportId: REPORT_ID, createdAtUtc: report.createdAtUtc, reason: cancellation ? "cancelled" : "submitted", actualSnapshotId: null, result };
  plan.reports = [report]; plan.revisions = [revision];
  return { plan, report, revision };
}
const options = { nonce: `0x${"4".repeat(64)}`, publicRevision: 1, previousResultHash: ZERO_HASH, correctionExplanation: "" };
describe("M08.01 sanitized immutable projection", () => {
  it("omits private identities and unreviewed text and preserves the real calculation inputs", () => {
    const { plan, report, revision } = reportFixture();
    const manifest = buildPlanManifest(plan, identity), result = buildResultManifest(plan, manifest, report, revision, null, options);
    const exported = JSON.stringify({ manifest, result });
    for (const privateValue of [plan.id, REPORT_ID, SNAPSHOT_ID, report.reason, report.note]) expect(exported).not.toContain(privateValue);
    expect(manifest.comparisonCreatedAtUtc).toBe(NOW); expect(result.resultCreatedAtUtc).toBe(revision.createdAtUtc);
    expect(result.correctionExplanation).toBe(""); expect(Object.isFrozen(manifest.constraints)).toBe(true);
  });
  it("retains changed-profile unavailability and early terminal cancellation", () => {
    for (const [profile, cancellation] of [[false, false], [true, true]]) {
      const { plan, report, revision } = reportFixture(profile, cancellation);
      const result = buildResultManifest(plan, buildPlanManifest(plan, identity), report, revision, null, options);
      expect(result.baselineActualMg).toBeNull(); expect(result.reasonCode).toBe(cancellation ? "cancelled_before_start" : "PROFILE_CHANGED");
    }
  });
  it("requires the accepted snapshot, retained report/result and exact public plan", () => {
    const { plan, report, revision } = reportFixture(); const manifest = buildPlanManifest(plan, identity);
    expect(() => buildResultManifest(plan, { ...manifest, differenceMg: 1 }, report, revision, null, options)).toThrow();
    expect(() => buildResultManifest(plan, manifest, { ...report, note: "changed" }, revision, null, options)).toThrow();
    expect(() => buildPlanManifest({ ...plan, forecastSnapshot: { ...plan.forecastSnapshot, retrievedAtUtc: "2026-10-21T05:59:00Z" } }, identity)).toThrow();
  });
  it("reuses supplied identity on retry; a new manifest receives a fresh identity", () => {
    const p = privatePlan(), a = buildPlanManifest(p, identity), b = buildPlanManifest(p, identity);
    expect(hashPlan(a)).toBe(hashPlan(b)); const fresh = createProofIdentity();
    expect(fresh.receiptId).toMatch(/^0x[0-9a-f]{64}$/); expect(fresh.nonce).not.toBe(identity.nonce);
    expect(hashPlan(buildPlanManifest(p, { ...identity, nonce: fresh.nonce }))).not.toBe(hashPlan(a));
  });
  it("rejects unknown fields, missing profile, cross-mode evidence and unsafe values", () => {
    const manifest = buildPlanManifest(privatePlan(), identity);
    expect(planManifestSchema.safeParse({ ...manifest, ownerId: REPORT_ID }).success).toBe(false);
    expect(() => hashPlan({ ...manifest, differenceMg: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
    const { plan, report, revision } = reportFixture(); const result = buildResultManifest(plan, manifest, report, revision, null, options);
    expect(resultManifestSchema.safeParse({ ...result, profileStillApplicable: null }).success).toBe(false);
    expect(resultManifestSchema.safeParse({ ...result, mode: "demo" }).success).toBe(false);
  });
});
