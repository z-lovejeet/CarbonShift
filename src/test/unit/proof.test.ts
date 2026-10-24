import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalJson, exportProofBundle, hashMethod, hashPlan, hashResult, importProofBundle, MAX_BUNDLE_BYTES } from "@/domain/proof/canonical";
import { verifyProofBundle } from "@/domain/proof/verifier";
import { SUPPORTED_METHOD_HASH } from "@/domain/proof/method-descriptor";
import golden from "../fixtures/proof/golden-bundle.json" with { type: "json" };
import digests from "../fixtures/proof/golden-digests.json" with { type: "json" };
import { proofBundle } from "../fixtures/proof/bundle";
import { proofObservation } from "../fixtures/proof/observation";
import { inspectDomainPurity } from "../../../scripts/lib/import-boundaries";

const mutate = () => structuredClone(proofBundle());
describe("M08.02 canonical encoding and golden vectors", () => {
  it("pins all golden digests against a separate Node SHA-256 implementation", () => {
    const b = proofBundle(); expect(b).toEqual(golden);
    expect(hashPlan(b.plan)).toBe(digests.planHash); expect(b.results.map(hashResult)).toEqual(digests.resultHashes);
    expect(hashMethod(b.method)).toBe(digests.methodHash); expect(digests.methodHash).toBe(SUPPORTED_METHOD_HASH);
    const digest = (kind: string, value: unknown) => `0x${createHash("sha256").update(`CarbonShift:${kind}:v1\n`).update(canonicalJson(value)).digest("hex")}`;
    expect(digest("plan", b.plan)).toBe(digests.planHash); expect(digest("result", b.results[1])).toBe(digests.resultHashes[1]); expect(digest("method", b.method)).toBe(SUPPORTED_METHOD_HASH);
  });
  it("uses UTF-16 JCS ordering and stable nested key permutation", () => {
    expect(canonicalJson({ "דּ": 5, "😀": 4, "€": 3, "ö": 2, "\u0080": 1, "1": 0, "\r": null })).toBe('{"\\r":null,"1":0,"\u0080":1,"ö":2,"€":3,"😀":4,"דּ":5}');
    const reverse = (v: unknown): unknown => Array.isArray(v) ? v.map(reverse) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).reverse().map(([k, child]) => [k, reverse(child)])) : v;
    expect(hashPlan(reverse(golden.plan))).toBe(digests.planHash); expect(hashResult(reverse(golden.results[1]))).toBe(digests.resultHashes[1]);
    const b = mutate(); b.plan.forecastSnapshot.intervals[0]!.forecastGPerKwh!++; expect(hashPlan(b.plan)).not.toBe(digests.planHash);
    const reordered = mutate(); reordered.plan.forecastSnapshot.intervals.reverse(); expect(() => hashPlan(reordered.plan)).toThrow();
  });
  it("round-trips a portable export without trusting external chain references", () => {
    expect(importProofBundle(exportProofBundle(golden))).toEqual(golden);
    const b = mutate(); b.chainReferences = { chainId: b.plan.chainId, contractAddress: b.plan.contractAddress, planTransactionHash: digests.planHash, resultTransactionHashes: [...digests.resultHashes] };
    expect(verifyProofBundle(b).checks.planIntegrity.state).toBe("unavailable");
  });
  it.each([NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1.5, -0, undefined, new Date("2026-01-01"), { value: undefined }, { toJSON: () => 1 }, [undefined], "\ud800", "\udfff"])("rejects ambiguous or unsafe JSON %#", (value) => {
    expect(() => canonicalJson(value)).toThrow();
  });
  it("rejects accessors without invoking them, cycles, sparse arrays and excessive depth", () => {
    let touched = false; const object = { get value() { touched = true; return 1; } };
    expect(() => canonicalJson(object)).toThrow(); expect(touched).toBe(false);
    const cycle: { a?: unknown } = {}; cycle.a = cycle; expect(() => canonicalJson(cycle)).toThrow();
    expect(() => canonicalJson(new Array(2))).toThrow(); let nested: unknown = null;
    for (let i = 0; i < 34; i++) nested = [nested]; expect(() => canonicalJson(nested)).toThrow();
  });
  it.each(['{"schemaVersion":1,"schema\\u0056ersion":1}', '{"a":1.0000000000000001}', '{"a":1e-400}', '{"a":9007199254740993}', '{"a":-0}', '{"a":"\\ud800"}', '{"a":1,}', '[] trailing'])("rejects malformed or lossy imported JSON %s", (text) => {
    expect(() => importProofBundle(text)).toThrow();
  });
  it("enforces import/export size limits and narrow pure dependency access", () => {
    expect(() => importProofBundle(" ".repeat(MAX_BUNDLE_BYTES + 1))).toThrow(); expect(() => canonicalJson("😀".repeat(MAX_BUNDLE_BYTES / 2))).toThrow();
    expect(inspectDomainPurity(new Map([["src/domain/proof/canonical.ts", "import canonicalize from 'canonicalize'; import {sha256} from '@noble/hashes/sha2.js';"]]))).toEqual([]);
    expect(inspectDomainPurity(new Map([["src/domain/proof/verifier.ts", "import {randomBytes} from '@noble/hashes/utils.js';"]]))).toHaveLength(1);
  });
});
describe("M08.03 independent computation and evidence states", () => {
  it("recomputes all local values while keeping unavailable chain checks separate", () => {
    const report = verifyProofBundle(golden);
    expect(report.checks.schema.state).toBe("match"); expect(report.checks.method.state).toBe("match"); expect(report.checks.calculation.state).toBe("match");
    expect(report.checks.planIntegrity.state).toBe("unavailable"); expect(report.checks.timing.state).toBe("unavailable"); expect(report.checks.resultHistory.state).toBe("unavailable");
    expect(golden.results[1]!.differenceMg).toBeLessThan(0); expect(report.limitations.join(" ")).toContain("not measured avoided emissions");
  });
  it.each(["live", "demo"] as const)("matches trusted %s observations and preserves original issuer across ownership transfer", (mode) => {
    const b = proofBundle(undefined, mode), context = proofObservation(b), report = verifyProofBundle(b, context);
    expect(Object.values(report.checks).map((c) => c.state)).toEqual(Array(7).fill("match"));
    expect(report.currentOwner).not.toBe(report.originalIssuer); if (mode === "demo") expect(report.checks.evidenceBasis.detail).toContain("simulated");
  });
  it("detects changed factors in both integrity and calculation checks", () => {
    const b = mutate(), context = proofObservation(b); b.plan.forecastSnapshot.intervals[0]!.forecastGPerKwh!++;
    const report = verifyProofBundle(b, context); expect(report.checks.planIntegrity.state).toBe("mismatch"); expect(report.checks.calculation.state).toBe("mismatch");
  });
  it("rejects a feasible but inferior schedule and a false baseline", () => {
    const b = mutate(); b.plan.selected = { startUtc: "2026-10-21T08:00:00Z", endUtc: "2026-10-21T09:00:00Z", estimatedMg: 240000 }; b.plan.differenceMg = 80000;
    expect(verifyProofBundle(b).checks.calculation.state).toBe("mismatch");
    const baseline = mutate(); baseline.plan.constraints.baselineOrigin = "earliest_feasible_confirmed"; baseline.plan.constraints.baselineStartUtc = "2026-10-21T08:00:00Z";
    expect(verifyProofBundle(baseline).checks.calculation.state).toBe("mismatch");
  });
  it("does not accept an arbitrary descriptor with its own self-consistent hash", () => {
    const b = mutate(); b.method.rules.actual = "Trust the supplied totals."; b.plan.methodHash = hashMethod(b.method); b.results = [];
    const report = verifyProofBundle(b, proofObservation(b)); expect(report.checks.planIntegrity.state).toBe("match"); expect(report.checks.method.state).toBe("unsupported"); expect(report.checks.calculation.state).toBe("unsupported");
  });
  it("detects actual-factor tampering, future snapshots and changed-profile numbers", () => {
    const b = mutate(), context = proofObservation(b); b.results[1]!.actualSnapshot!.intervals[0]!.actualGPerKwh!++;
    expect(verifyProofBundle(b, context).checks.calculation.state).toBe("mismatch"); expect(verifyProofBundle(b, context).checks.resultHistory.state).toBe("mismatch");
    const future = mutate(); future.results[1]!.actualSnapshot!.retrievedAtUtc = "2026-10-22T00:00:00Z"; expect(verifyProofBundle(future).checks.calculation.state).toBe("mismatch");
    const changed = mutate(); changed.results[1]!.profileStillApplicable = false; expect(verifyProofBundle(changed).checks.calculation.state).toBe("mismatch");
    const valid = mutate(); valid.results = [{ ...valid.results[0]!, profileStillApplicable: false, resultStatus: "outside_supported_window", reasonCode: "PROFILE_CHANGED" }];
    expect(verifyProofBundle(valid).checks.calculation.state).toBe("match");
  });
  it("checks public sequence, previous digest, skipped private revisions and corrections", () => {
    for (const edit of [ (b: ReturnType<typeof mutate>) => { b.results[1]!.previousResultHash = digests.planHash; }, (b: ReturnType<typeof mutate>) => { b.results[1]!.publicRevision = 3; }, (b: ReturnType<typeof mutate>) => { b.results[1]!.privateResultRevisionNumber = 1; }, (b: ReturnType<typeof mutate>) => { b.results[1]!.nonce = b.results[0]!.nonce; }, (b: ReturnType<typeof mutate>) => { b.results[1]!.reportedStartUtc = "2026-10-21T09:30:00Z"; b.results[1]!.correctionExplanation = ""; } ]) {
      const b = mutate(); edit(b); expect(verifyProofBundle(b).checks.resultHistory.state).toBe("mismatch");
    }
    const b = mutate(); expect(b.results[1]!.privateResultRevisionNumber).toBe(3); expect(verifyProofBundle(b).checks.calculation.state).toBe("match");
  });
  it("allows terminal early cancellation but rejects early ordinary non-run and later appends", () => {
    const b = mutate(); b.results = [{ ...b.results[0]!, reportCreatedAtUtc: "2026-10-21T06:02:00Z", resultCreatedAtUtc: "2026-10-21T06:02:00Z", reportSource: "cancellation", reportedKind: "did_not_run", reportedStartUtc: null, profileStillApplicable: null, resultStatus: "did_not_run", reasonCode: "cancelled_before_start" }];
    expect(verifyProofBundle(b).checks.calculation.state).toBe("match");
    const early = structuredClone(b); early.results[0]!.reportSource = "report"; early.results[0]!.reasonCode = null; expect(verifyProofBundle(early).checks.calculation.state).toBe("mismatch");
    b.results.push(mutate().results[1]!); expect(verifyProofBundle(b).checks.resultHistory.state).toBe("mismatch");
  });
  it("rejects wrong network, contract, mode, cutoff, omitted events and reordered events", () => {
    const b = mutate();
    const badNetwork = proofObservation(b); badNetwork.chain!.chainId = 31337; expect(verifyProofBundle(b, badNetwork).checks.planIntegrity.state).toBe("mismatch");
    const offlineWrongContext = { ...proofObservation(b), expectedChainId: 31337, chain: null }; expect(verifyProofBundle(b, offlineWrongContext).checks.planIntegrity.state).toBe("mismatch");
    const badAddress = proofObservation(b); badAddress.expectedContractAddress = `0x${"f".repeat(40)}`; expect(verifyProofBundle(b, badAddress).checks.planIntegrity.state).toBe("mismatch");
    const badMode = proofObservation(b); badMode.chain!.receipt.isDemo = true; expect(verifyProofBundle(b, badMode).checks.planIntegrity.state).toBe("mismatch");
    const late = proofObservation(b); late.chain!.receipt.committedAt = late.chain!.receipt.commitBefore; expect(verifyProofBundle(b, late).checks.timing.state).toBe("mismatch");
    const cutoff = mutate(); cutoff.plan.commitBeforeUtc = cutoff.plan.selected.startUtc; expect(verifyProofBundle(cutoff).checks.timing.state).toBe("mismatch");
    const prefix = mutate(); prefix.results.pop(); expect(verifyProofBundle(prefix, proofObservation(b)).checks.resultHistory.state).toBe("mismatch");
    const wrongEvents = proofObservation(b); wrongEvents.chain!.results.reverse(); expect(verifyProofBundle(b, wrongEvents).checks.resultHistory.state).toBe("mismatch");
  });
});
