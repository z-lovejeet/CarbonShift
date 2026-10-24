import { createComparison, assertComparisonAcceptable } from "../scheduling";
import { calculateUpdatedResult } from "../results";
import { freezeDomain } from "../method";
import { epochSeconds, precommitCutoff } from "../time";
import type { ComparisonV1 } from "../schemas";
import { assertProofJson, canonicalJson, hashMethod, hashPlan, hashResult, importProofBundle } from "./canonical";
import { METHOD_DESCRIPTOR, SUPPORTED_METHOD_HASH } from "./method-descriptor";
import { proofBundleSchema, ZERO_HASH, type ProofBundleV1 } from "./schemas";
import { verificationContextSchema, type VerificationContext } from "./observations";

export type CheckState = "match" | "mismatch" | "unsupported" | "unavailable";
export type ProofCheck = { state: CheckState; detail: string };
export type VerificationChecks = Record<"schema" | "planIntegrity" | "method" | "calculation" | "timing" | "resultHistory" | "evidenceBasis", ProofCheck>;
export type VerificationReport = { checks: VerificationChecks; planHash: string | null; resultHashes: string[]; originalIssuer: string | null; currentOwner: string | null; limitations: string[] };
const check = (state: CheckState, detail: string): ProofCheck => ({ state, detail });
const equal = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const requireMatch = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
// Calculation APIs require private storage references. These neutral internal placeholders are
// never exported, treated as source provenance, or compared with a private DB digest.
const INTERNAL_ID = "00000000-0000-4000-8000-000000000001";
const INTERNAL_HASH = `0x${"1".repeat(64)}`;
function comparisonFrom(bundle: ProofBundleV1): ComparisonV1 {
  const p = bundle.plan;
  const c = createComparison({ constraints: p.constraints, snapshot: p.forecastSnapshot, forecastSnapshotId: INTERNAL_ID, forecastSnapshotHash: INTERNAL_HASH }, p.comparisonCreatedAtUtc);
  assertComparisonAcceptable(c, p.forecastSnapshot, p.acceptedAtUtc);
  return c;
}
function calculations(bundle: ProofBundleV1): void {
  const p = bundle.plan, c = comparisonFrom(bundle);
  const project = (v: typeof c.selected) => ({ startUtc: v.startUtc, endUtc: v.endUtc, estimatedMg: v.estimatedMg });
  requireMatch(equal(p.baseline, project(c.baseline)) && equal(p.selected, project(c.selected)) && equal(p.energyWhBins, c.selected.energyWhBins) && p.differenceMg === c.differenceMg, "The baseline, feasible optimum, profile or forecast totals differ.");
  for (const r of bundle.results) {
    requireMatch(r.energyBasis === p.constraints.energyBasis && r.reportCreatedAtUtc >= p.acceptedAtUtc && r.resultCreatedAtUtc >= r.reportCreatedAtUtc, "Result basis or chronology differs.");
    if (r.reportSource === "cancellation") {
      requireMatch(r.reportCreatedAtUtc < p.selected.startUtc && r.reportedKind === "did_not_run" && r.resultStatus === "did_not_run" && r.reasonCode === "cancelled_before_start", "Invalid early cancellation.");
      continue;
    }
    const report = r.reportedKind === "ran" ? { id: INTERNAL_ID, createdAtUtc: r.reportCreatedAtUtc, kind: "ran" as const, reportedStartUtc: r.reportedStartUtc!, profileStillApplicable: r.profileStillApplicable! } : { id: INTERNAL_ID, createdAtUtc: r.reportCreatedAtUtc, kind: "did_not_run" as const, reportedStartUtc: null, profileStillApplicable: null };
    const calculated = calculateUpdatedResult({ comparison: c, acceptedAtUtc: p.acceptedAtUtc, report, actualSnapshot: r.actualSnapshot, actualSnapshotHash: r.actualSnapshot === null ? null : INTERNAL_HASH }, r.resultCreatedAtUtc);
    requireMatch(calculated.status === r.resultStatus && calculated.baselineActualMg === r.baselineActualMg && calculated.reportedActualMg === r.reportedActualMg && calculated.differenceMg === r.differenceMg && (calculated.reasonCodes[0] ?? null) === r.reasonCode && (calculated.snapshotHash === null) === (r.actualSnapshot === null), "Updated result does not reproduce from its report and actual factors.");
  }
}
function localHistory(bundle: ProofBundleV1, planHash: string, hashes: string[]): void {
  const p = bundle.plan, nonces = new Set([p.nonce]); let previous = ZERO_HASH;
  for (const [i, r] of bundle.results.entries()) {
    const prior = bundle.results[i - 1];
    requireMatch(r.receiptId === p.receiptId && r.mode === p.mode && r.chainId === p.chainId && r.contractAddress === p.contractAddress && r.planHash === planHash && r.methodVersion === p.methodVersion && r.methodHash === p.methodHash, "Result context differs from the plan.");
    requireMatch(r.publicRevision === i + 1 && r.previousResultHash === previous && !nonces.has(r.nonce), "Public revision order, previous hash or nonce differs.");
    if (prior) {
      requireMatch(prior.reportSource !== "cancellation" && r.privateResultRevisionNumber > prior.privateResultRevisionNumber && r.resultCreatedAtUtc >= prior.resultCreatedAtUtc && r.reportCreatedAtUtc >= prior.reportCreatedAtUtc, "History is not an append-only chronological sequence.");
      const fields = (v: typeof r) => [v.reportedKind, v.reportedStartUtc, v.reportCreatedAtUtc, v.profileStillApplicable, v.reportSource];
      if (!equal(fields(r), fields(prior))) requireMatch(r.reportCreatedAtUtc >= prior.reportCreatedAtUtc && r.correctionExplanation.trim().length > 0, "A public report correction needs a reviewed explanation.");
    }
    nonces.add(r.nonce); previous = hashes[i]!;
  }
  if (bundle.chainReferences) requireMatch(bundle.chainReferences.chainId === p.chainId && bundle.chainReferences.contractAddress === p.contractAddress && bundle.chainReferences.resultTransactionHashes.length === hashes.length, "Chain reference context differs.");
}

/** No RPC, storage, AI, server verdict, ambient clock or overall certification badge. */
export function verifyProofBundle(input: unknown, contextInput?: VerificationContext): VerificationReport {
  const checks: VerificationChecks = Object.fromEntries(["schema", "planIntegrity", "method", "calculation", "timing", "resultHistory", "evidenceBasis"].map((key) => [key, check("unavailable", "Valid bundle required.")])) as VerificationChecks;
  const report: VerificationReport = { checks, planHash: null, resultHashes: [], originalIssuer: null, currentOwner: null, limitations: ["Hashes bind recorded content; source authenticity and physical execution remain unverified.", "Energy is assumed and execution is self-reported; national estimates are not measured avoided emissions."] };
  let bundle: ProofBundleV1;
  try {
    if (typeof input === "string") bundle = importProofBundle(input);
    else { assertProofJson(input); canonicalJson(input); bundle = proofBundleSchema.parse(input); }
    checks.schema = check("match", "Strict version-1 schemas and bounded integer JSON.");
  } catch {
    checks.schema = check("mismatch", "Invalid, unsafe, oversized or unsupported-schema bundle."); return freezeDomain(report);
  }
  const p = bundle.plan;
  report.planHash = hashPlan(p); report.resultHashes = bundle.results.map(hashResult);
  const supported = p.methodVersion === METHOD_DESCRIPTOR.methodVersion && p.methodHash === SUPPORTED_METHOD_HASH && hashMethod(bundle.method) === SUPPORTED_METHOD_HASH && hashMethod(METHOD_DESCRIPTOR) === SUPPORTED_METHOD_HASH && bundle.results.every((r) => r.methodVersion === p.methodVersion && r.methodHash === p.methodHash);
  checks.method = check(supported ? "match" : "unsupported", supported ? "Pinned method descriptor and version recognized." : "Method is not the pinned supported algorithm.");
  if (supported) {
    try { calculations(bundle); checks.calculation = check("match", "Recomputed feasibility, global optimum, forecast and all updated amounts."); }
    catch { checks.calculation = check("mismatch", "The exported inputs do not reproduce the schedule, chronology or amounts."); }
  } else checks.calculation = check("unsupported", "Calculation cannot be certified for an unknown method.");
  checks.evidenceBasis = check("match", p.mode === "demo" ? "Demo: simulated execution, assumed energy; no historical precommitment claim." : "Live: execution not observed at planning, results self-reported, energy assumed.");
  if (p.mode === "demo") report.limitations.push("This is a synthetic/demo record; its chain timestamp cannot prove a historical commitment.");
  let historyValid = true;
  try { localHistory(bundle, report.planHash, report.resultHashes); }
  catch { historyValid = false; checks.resultHistory = check("mismatch", "Local public revisions, context, correction history or hashes differ."); }
  const cutoffValid = p.commitBeforeUtc === (p.mode === "live" ? precommitCutoff(p.baseline.startUtc, p.selected.startUtc) : null);
  if (!cutoffValid) checks.timing = check("mismatch", "Manifest cutoff differs from mode and the earlier start.");
  let context: VerificationContext | undefined;
  try { if (contextInput !== undefined) { assertProofJson(contextInput); context = verificationContextSchema.parse(contextInput); } }
  catch { checks.planIntegrity = check("mismatch", "Invalid trusted chain observation."); if (cutoffValid) checks.timing = check("unavailable", "Valid chain observation required."); if (historyValid) checks.resultHistory = check("unavailable", "Local history consistent; valid chain observation required."); return freezeDomain(report); }
  const chain = context?.chain;
  if (!chain) {
    checks.planIntegrity = context && (context.expectedChainId !== p.chainId || context.expectedContractAddress !== p.contractAddress)
      ? check("mismatch", "Manifest differs from configured chain/contract even though observations are unavailable.")
      : check("unavailable", "Plan digest computed locally; independent chain observation unavailable.");
    if (cutoffValid) checks.timing = check("unavailable", "Manifest cutoff consistent; chain timing unavailable.");
    if (historyValid) checks.resultHistory = check("unavailable", "Local revision chain consistent; on-chain history unavailable.");
    return freezeDomain(report);
  }
  report.originalIssuer = chain.receipt.initialIssuer; report.currentOwner = chain.currentOwner;
  const s = chain.receipt, event = chain.commit;
  const contextMatches = context!.expectedChainId === p.chainId && context!.expectedContractAddress === p.contractAddress && chain.chainId === p.chainId && chain.contractAddress === p.contractAddress;
  const commitmentMatches = contextMatches && s.exists && s.receiptId === p.receiptId && s.planHash === report.planHash && s.methodHash === p.methodHash && s.isDemo === (p.mode === "demo") && event.receiptId === p.receiptId && event.planHash === s.planHash && event.methodHash === s.methodHash && event.isDemo === s.isDemo && event.commitBefore === s.commitBefore && event.committedAt === s.committedAt && event.blockTimestamp === s.committedAt && event.issuer === s.initialIssuer;
  const refs = bundle.chainReferences;
  const refPlanMatches = !refs || refs.planTransactionHash === event.transactionHash;
  checks.planIntegrity = check(commitmentMatches && refPlanMatches ? "match" : "mismatch", commitmentMatches && refPlanMatches ? "Canonical plan digest matches the independently supplied commitment and event." : "Plan digest, contract context or commitment event differs.");
  const cutoff = p.commitBeforeUtc === null ? 0 : epochSeconds(p.commitBeforeUtc);
  const timingMatches = commitmentMatches && cutoffValid && s.commitBefore === cutoff && (p.mode === "demo" ? cutoff === 0 : s.committedAt >= epochSeconds(p.acceptedAtUtc) && s.committedAt < cutoff);
  checks.timing = check(timingMatches ? "match" : "mismatch", timingMatches ? p.mode === "demo" ? "Demo zero cutoff; no historical timing attestation." : "Live commitment mined after acceptance and before both starts." : "Chain timing/cutoff does not match the manifest.");
  let eventsMatch = contextMatches && commitmentMatches && historyValid && chain.results.length === bundle.results.length && s.latestRevision === bundle.results.length && s.latestResultHash === (report.resultHashes.at(-1) ?? ZERO_HASH);
  let previousPosition = event;
  for (const [i, r] of bundle.results.entries()) {
    const e = chain.results[i];
    if (!e) { eventsMatch = false; continue; }
    const ordered = e.blockNumber > previousPosition.blockNumber || e.blockNumber === previousPosition.blockNumber && e.blockHash === previousPosition.blockHash && e.blockTimestamp === previousPosition.blockTimestamp && e.logIndex > previousPosition.logIndex;
    if (e.receiptId !== p.receiptId || e.revision !== r.publicRevision || e.previousResultHash !== r.previousResultHash || e.resultHash !== report.resultHashes[i] || e.blockTimestamp < previousPosition.blockTimestamp || e.blockTimestamp < epochSeconds(r.resultCreatedAtUtc) || !ordered || refs && refs.resultTransactionHashes[i] !== e.transactionHash) eventsMatch = false;
    previousPosition = { ...event, ...e };
  }
  checks.resultHistory = check(eventsMatch ? "match" : "mismatch", eventsMatch ? "All public result digests, events, order and latest pointers agree." : "Published revisions, event digests/order or latest pointer differ.");
  return freezeDomain(report);
}
