import { expect, it } from "vitest";
import { activityProofBundle } from "../fixtures/proof/activity-bundle";
import { exportBundleV2, hashPlanV2, hashResultV2, importBundleV2, METHOD_V2_HASH } from "@/domain/proof/v2/canonical";
import { verifyBundleV2 } from "@/domain/proof/v2/verifier";
import { verifyVersionedBundle } from "@/domain/proof/versions";
import { proofBundle } from "../fixtures/proof/bundle";
import golden from "../fixtures/proof/activity-golden.json";
it("reproduces a v2 schedule and non-run vector while preserving v1 dispatch", () => { const bundle = activityProofBundle(), report = verifyBundleV2(importBundleV2(exportBundleV2(bundle))); expect(report.checks.schema.state).toBe("match"); expect(report.checks.calculation.state).toBe("match"); expect(report.checks.planIntegrity.state).toBe("unavailable"); expect(verifyVersionedBundle(proofBundle()).checks.calculation.state).toBe("match"); expect(bundle.plan.solution.selected.estimatedMg).toBe(5000); expect(bundle.plan.solution.baseline.estimatedMg).toBe(15000); });
it("retains the frozen v2 method, plan and result canonical digests", () => {
  const bundle = activityProofBundle();
  expect(METHOD_V2_HASH).toBe(golden.methodHash);
  expect(hashPlanV2(bundle.plan)).toBe(golden.planHash);
  expect(hashResultV2(bundle.results[0])).toBe(golden.resultHash);
});
it("rejects changed arithmetic, broken lineage, mixed versions and private labels", () => { const bundle = activityProofBundle(), original = hashPlanV2(bundle.plan); bundle.plan.solution.selected.estimatedMg++; expect(hashPlanV2(bundle.plan)).not.toBe(original); expect(verifyBundleV2(bundle).checks.calculation.state).toBe("mismatch"); const clean = activityProofBundle(); clean.results[0]!.previousResultHash = "0x" + "12".repeat(32); expect(verifyBundleV2(clean).checks.schema.state).toBe("mismatch"); const named = activityProofBundle(); named.plan.input.tasks[0]!.activity.name = "Private family routine"; expect(verifyBundleV2(named).checks.schema.state).toBe("mismatch"); expect(() => importBundleV2('{"schemaVersion":2,"schemaVersion":2}')).toThrow(); });
