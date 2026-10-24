import { normalizeSchedule } from "@/domain/activities/constraints";
import { solveSchedule } from "@/domain/activities/scheduler";
import { taskResultAmounts, aggregateSchedule } from "@/domain/activities/results";
import { addSeconds, epochSeconds } from "@/domain/time";
import { assertForecastFreshness } from "@/domain/grid";
import { scheduleDocumentSchema } from "@/domain/activities/schedule-documents";
import { scheduleReportSchema, taskResultSchema, type ScheduleHistory } from "@/domain/activities/report-schemas";
import { bundleV2Schema, type BundleV2 } from "./schemas";
import { importBundleV2, canonicalV2, hashPlanV2, hashResultV2, hashMethodV2, METHOD_V2_HASH, METHOD_V2_DESCRIPTOR } from "./canonical";
import { verificationContextSchema, type VerificationContext } from "../observations";
import type { VerificationReport, VerificationChecks } from "../verifier";
import { ZERO_HASH } from "../schemas";
const ID = "00000000-0000-4000-8000-000000000001", HASH = `0x${"1".repeat(64)}`;
const same = (a: unknown, b: unknown) => canonicalV2(a) === canonicalV2(b);
const requireValue = (condition: boolean) => { if (!condition) throw new Error("Proof mismatch"); };
export function planDocumentFromV2(bundle: BundleV2) {
  const p = bundle.plan;
  return scheduleDocumentSchema.parse({ schemaVersion: 2, id: ID, acceptedAtUtc: p.acceptedAtUtc, optionIndex: p.optionIndex, comparison: { schemaVersion: 2, id: ID, version: 1, methodVersion: p.methodVersion, input: p.input, activities: p.activities, grid: { id: ID, hash: HASH, snapshot: p.forecastSnapshot, attribution: p.attribution }, solution: p.solution, createdAtUtc: p.comparisonCreatedAtUtc, expiresAtUtc: addSeconds(p.comparisonCreatedAtUtc, 300) } });
}
function calculate(bundle: BundleV2) {
  const p = bundle.plan, references = p.activities.flatMap((a) => a.reference ? [a.reference] : []), normalized = normalizeSchedule(p.input, references, p.comparisonCreatedAtUtc), solution = solveSchedule(normalized, p.forecastSnapshot, p.comparisonCreatedAtUtc);
  requireValue(same(solution, p.solution) && same(normalized.tasks.map((t) => t.activity), p.activities));
  requireValue(p.acceptedAtUtc >= p.comparisonCreatedAtUtc && epochSeconds(p.acceptedAtUtc) < epochSeconds(p.comparisonCreatedAtUtc) + 300); assertForecastFreshness(p.forecastSnapshot, p.acceptedAtUtc);
  const chosen = p.optionIndex === 0 ? p.solution.selected : p.solution.alternatives[p.optionIndex - 1]!;
  requireValue(p.mode === "demo" || [...p.solution.baseline.tasks, ...chosen.tasks].every((t) => epochSeconds(t.startUtc) - epochSeconds(p.acceptedAtUtc) >= 600));
  const plan = planDocumentFromV2(bundle);
  for (const result of bundle.results) {
    requireValue(result.tasks.length === p.input.tasks.length);
    const history: ScheduleHistory = { schemaVersion: 2, reports: [], results: [] };
    for (const [i, row] of result.tasks.entries()) {
      requireValue(row.taskId === p.input.tasks[i]!.activity.id && (row.report === null) === (row.result === null));
      if (!row.report || !row.result) { requireValue(row.reportSequence === 0 && row.resultSequence === 0 && row.actualSnapshot === null); continue; }
      requireValue(row.reportSequence > 0 && row.resultSequence > 0 && row.result.calculatedAtUtc >= row.report.reportedAtUtc && result.resultCreatedAtUtc >= row.result.calculatedAtUtc && (row.actualSnapshot === null || row.actualSnapshot.retrievedAtUtc <= row.result.calculatedAtUtc));
      const report = scheduleReportSchema.parse({ ...row.report, schemaVersion: 2, id: ID, scheduleId: ID, taskId: row.taskId, sequence: row.reportSequence, previousReportId: null });
      const calculated = taskResultAmounts(plan, report, row.actualSnapshot, row.result.calculatedAtUtc);
      const { calculatedAtUtc: _at, ...amounts } = row.result; void _at;
      requireValue(same(calculated, amounts));
      history.reports.push(report); history.results.push(taskResultSchema.parse({ ...row.result, schemaVersion: 2, id: ID, scheduleId: ID, taskId: row.taskId, reportId: ID, sequence: row.resultSequence, grid: row.actualSnapshot ? { id: ID, hash: HASH, snapshot: row.actualSnapshot, attribution: p.attribution } : null }));
    }
    requireValue(same(aggregateSchedule(plan, history), result.aggregate));
  }
}
export function verifyBundleV2(input: unknown, contextInput?: VerificationContext): VerificationReport {
  const checks = Object.fromEntries(["schema", "planIntegrity", "method", "calculation", "timing", "resultHistory", "evidenceBasis"].map((key) => [key, { state: "unavailable", detail: "A valid bundle is required." }])) as VerificationChecks;
  const report: VerificationReport = { checks, planHash: null, resultHashes: [], originalIssuer: null, currentOwner: null, limitations: ["Electricity is estimated from recorded inputs; execution is self-reported.", "Hashes bind content. They do not verify devices, source truth or measured avoided emissions."] };
  let bundle: BundleV2;
  try { bundle = typeof input === "string" ? importBundleV2(input) : bundleV2Schema.parse(input); canonicalV2(bundle); checks.schema = { state: "match", detail: "Strict version-2 bounded integer manifests." }; }
  catch { checks.schema = { state: "mismatch", detail: "Unsupported, malformed, unsafe or oversized bundle." }; return report; }
  const p = bundle.plan; report.planHash = hashPlanV2(p); report.resultHashes = bundle.results.map(hashResultV2);
  const known = p.methodHash === METHOD_V2_HASH && hashMethodV2(bundle.method) === METHOD_V2_HASH && same(bundle.method, METHOD_V2_DESCRIPTOR);
  checks.method = { state: known ? "match" : "unsupported", detail: known ? "Pinned household method recognized." : "This method descriptor is not supported." };
  if (known) { try { calculate(bundle); checks.calculation = { state: "match", detail: "Recomputed task energy, feasibility, bounded search and all published updated amounts." }; } catch { checks.calculation = { state: "mismatch", detail: "The inputs do not reproduce the recorded schedule, chronology or results." }; } }
  else checks.calculation = { state: "unsupported", detail: "Cannot calculate an unknown method." };
  let previous = ZERO_HASH, validHistory = true; const nonces = new Set([p.nonce]);
  for (const [i, r] of bundle.results.entries()) {
    const prior = bundle.results[i - 1];
    validHistory &&= r.publicRevision === i + 1 && r.previousResultHash === previous && r.planHash === report.planHash && r.receiptId === p.receiptId && r.chainId === p.chainId && r.contractAddress === p.contractAddress && r.mode === p.mode && r.methodHash === p.methodHash && !nonces.has(r.nonce);
    if (prior) validHistory &&= r.resultCreatedAtUtc >= prior.resultCreatedAtUtc && r.tasks.every((t, n) => t.taskId === prior.tasks[n]?.taskId && t.resultSequence >= prior.tasks[n]!.resultSequence && t.reportSequence >= prior.tasks[n]!.reportSequence) && r.tasks.some((t, n) => t.resultSequence > prior.tasks[n]!.resultSequence) && r.correctionExplanation.trim().length > 0;
    previous = report.resultHashes[i]!; nonces.add(r.nonce);
  }
  const chosen = p.optionIndex === 0 ? p.solution.selected : p.solution.alternatives[p.optionIndex - 1]!;
  const cutoff = [...p.solution.baseline.tasks, ...chosen.tasks].map((t) => t.startUtc).sort()[0]!;
  const validCutoff = p.commitBeforeUtc === (p.mode === "live" ? cutoff : null);
  checks.timing = { state: validCutoff ? "unavailable" : "mismatch", detail: validCutoff ? "Cutoff agrees with all starts; chain observation is required." : "The cutoff differs from the earliest start." };
  checks.resultHistory = { state: validHistory ? "unavailable" : "mismatch", detail: validHistory ? "Local lineage agrees; chain history is unavailable." : "Revision context, order or lineage differs." };
  checks.evidenceBasis = { state: "match", detail: p.mode === "demo" ? "Labeled demonstration; no historical commitment claim." : "Reviewed energy assumptions and self-reported completion." };
  if (bundle.chainReferences && (bundle.chainReferences.chainId !== p.chainId || bundle.chainReferences.contractAddress !== p.contractAddress || bundle.chainReferences.resultTransactionHashes.length !== bundle.results.length)) { checks.resultHistory = { state: "mismatch", detail: "Chain reference context differs." }; validHistory = false; }
  let context: VerificationContext | undefined;
  try { context = contextInput ? verificationContextSchema.parse(contextInput) : undefined; } catch { checks.planIntegrity = { state: "mismatch", detail: "Invalid chain observation." }; return report; }
  const chain = context?.chain;
  if (!chain) return report;
  report.originalIssuer = chain.receipt.initialIssuer; report.currentOwner = chain.currentOwner;
  const stored = chain.receipt, commit = chain.commit;
  const commitment = context!.expectedChainId === p.chainId && context!.expectedContractAddress === p.contractAddress && chain.chainId === p.chainId && chain.contractAddress === p.contractAddress && stored.exists && stored.receiptId === p.receiptId && stored.planHash === report.planHash && stored.methodHash === p.methodHash && stored.isDemo === (p.mode === "demo") && commit.receiptId === p.receiptId && commit.planHash === stored.planHash && commit.methodHash === stored.methodHash && commit.isDemo === stored.isDemo && commit.commitBefore === stored.commitBefore && commit.committedAt === stored.committedAt && commit.blockTimestamp === stored.committedAt && commit.issuer === stored.initialIssuer && (!bundle.chainReferences || bundle.chainReferences.planTransactionHash === commit.transactionHash);
  checks.planIntegrity = { state: commitment ? "match" : "mismatch", detail: commitment ? "Digest matches the observed contract record and commitment event." : "Commitment, event, network or digest differs." };
  const timing = commitment && validCutoff && stored.commitBefore === (p.mode === "demo" ? 0 : epochSeconds(cutoff)) && (p.mode === "demo" || stored.committedAt >= epochSeconds(p.acceptedAtUtc) && stored.committedAt < epochSeconds(cutoff));
  checks.timing = { state: timing ? "match" : "mismatch", detail: timing ? "Observed inclusion respects the commitment cutoff." : "Observed timing or cutoff differs." };
  let events = commitment && validHistory && chain.results.length === bundle.results.length && stored.latestRevision === bundle.results.length && stored.latestResultHash === (report.resultHashes.at(-1) ?? ZERO_HASH), priorPosition = commit;
  for (const [i, result] of bundle.results.entries()) { const event = chain.results[i]; if (!event) { events = false; continue; } const ordered = event.blockNumber > priorPosition.blockNumber || event.blockNumber === priorPosition.blockNumber && event.blockHash === priorPosition.blockHash && event.logIndex > priorPosition.logIndex;
    events &&= event.receiptId === p.receiptId && event.revision === result.publicRevision && event.resultHash === report.resultHashes[i] && event.previousResultHash === result.previousResultHash && event.blockTimestamp >= priorPosition.blockTimestamp && event.blockTimestamp >= epochSeconds(result.resultCreatedAtUtc) && ordered && (!bundle.chainReferences || bundle.chainReferences.resultTransactionHashes[i] === event.transactionHash); priorPosition = { ...commit, ...event }; }
  checks.resultHistory = { state: events ? "match" : "mismatch", detail: events ? "Observed result events, hashes, order and latest pointers agree." : "Observed history or latest pointer differs." };
  return report;
}
