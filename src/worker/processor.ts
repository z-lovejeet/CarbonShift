import { METHOD_DESCRIPTOR } from "@/domain/proof";
import { versionedPlanHash as hashPlan, versionedResultHash as hashResult, verifyVersionedBundle as verifyProofBundle } from "@/domain/proof/versions";
import { METHOD_V2_DESCRIPTOR } from "@/domain/proof/v2/canonical";
import { signedTransactionSchema, ledgerJobSchema, LedgerFault, type LedgerChain, type LedgerJob, type LedgerStore } from "./contracts";

export function validateLedgerJob(input: unknown, contract: string): LedgerJob {
  const job = ledgerJobSchema.parse(input), report = verifyProofBundle({ schemaVersion: job.plan.schemaVersion, plan: job.plan, results: job.results, method: job.plan.schemaVersion === 1 ? METHOD_DESCRIPTOR : METHOD_V2_DESCRIPTOR, chainReferences: null });
  const digest = job.kind === "plan" ? hashPlan(job.plan) : job.results.length ? hashResult(job.results.at(-1)!) : null;
  if (job.plan.contractAddress !== contract.toLowerCase() || digest !== job.expectedHash || [report.checks.schema, report.checks.method, report.checks.calculation].some((c) => c.state !== "match") || report.checks.resultHistory.state === "mismatch") throw new LedgerFault("INVALID_MANIFEST");
  return job;
}
/** A crash after persist is recovered from the exact same signed bytes, never a new nonce. */
export function createLedgerProcessor(store: LedgerStore, chain: LedgerChain, contract: string) {
  return async function tick(reconcileOnly = false) {
    const fence = await store.lease(); if (fence === null) return "leased_elsewhere";
    try {
      try { await chain.verify(); }
      catch (error) {
        for (const job of await store.reconciliationJobs()) await store.observe(job.id, fence, { status: "uncertain", code: error instanceof LedgerFault ? error.code : "RPC_UNAVAILABLE", block: null, blockHash: null });
        throw new LedgerFault("CHAIN_MISMATCH");
      }
      for (const candidate of await store.reconciliationJobs()) {
        if (await store.lease() !== fence) throw new Error("LEASE_LOST");
        const signed = await store.signed(candidate.id); if (!signed) continue;
        let job: LedgerJob;
        try { job = validateLedgerJob(candidate, contract); }
        catch { await store.observe(candidate.id, fence, { status: "uncertain", code: "INVALID_MANIFEST", block: null, blockHash: null }); continue; }
        try {
          const observation = await chain.inspect(job, signed);
          await store.observe(job.id, fence, observation);
          if (!reconcileOnly && observation.code === "NOT_FOUND") {
            // The persisted receipt/nonce stays authoritative even if broadcast acknowledgment was lost.
            try { await chain.broadcast(job, signed); await store.observe(job.id, fence, { status: "submitted", code: null, block: null, blockHash: null }); }
            catch { /* Keep the already-persisted uncertain observation; never allocate a replacement nonce. */ }
          }
        } catch {
          await store.observe(job.id, fence, { status: "uncertain", code: "RPC_UNAVAILABLE", block: null, blockHash: null });
        }
      }
      if (reconcileOnly) return "reconciled";
      const candidate = await store.next(); if (!candidate) return "idle_or_pending";
      if (await store.lease() !== fence) throw new Error("LEASE_LOST");
      const job = validateLedgerJob(candidate, contract);
      if (!await store.prepare(job.id, fence)) return "state_changed";
      let signed;
      try { signed = signedTransactionSchema.parse(await chain.sign(job)); }
      catch (error) {
        // No bytes were broadcast. A transient preparation failure remains safely reclaimable.
        if (error instanceof LedgerFault && error.code !== "RPC_UNAVAILABLE") await store.observe(job.id, fence, { status: "uncertain", code: error.code, block: null, blockHash: null });
        return "signing_deferred";
      }
      // The transaction that wins the plan lock is the only one allowed onto the network.
      if (await store.lease() !== fence) throw new Error("LEASE_LOST");
      if (!await store.persist(job.id, fence, signed)) return "state_changed";
      try { await chain.broadcast(job, signed); }
      catch { await store.observe(job.id, fence, { status: "uncertain", code: "RPC_UNAVAILABLE", block: null, blockHash: null }); }
      return "submitted";
    } finally { await store.release(fence); }
  };
}
