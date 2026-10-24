import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/server/db/schema";
import type { WorkerEnvironment } from "@/config/environment";
import { ledgerJobSchema, signedTransactionSchema, type LedgerStore, type Observation } from "./contracts";

export function createLedgerStore(environment: WorkerEnvironment, signer: string, holder: string): LedgerStore {
  const client = createClient<Database>(environment.databaseUrl, environment.databaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, redirect: "error", signal: AbortSignal.timeout(10000) }) },
  });
  const scope = `11155111:${signer.toLowerCase()}`;
  const safe = (error: unknown) => { if (error) throw new Error("LEDGER_DATABASE_UNAVAILABLE"); };
  async function job(id: string) {
    const op = await client.from("ledger_operations").select("id,publication_id,result_id,kind,expected_hash,transaction_hash,block_hash").eq("id", id).single(); safe(op.error);
    const pub = await client.from("publications").select("manifest").eq("id", op.data!.publication_id).single(); safe(pub.error);
    const results = await client.from("published_results").select("id,manifest,public_sequence").eq("publication_id", op.data!.publication_id).order("public_sequence"); safe(results.error);
    const target = results.data?.find((r) => r.id === op.data!.result_id)?.public_sequence ?? 0;
    return ledgerJobSchema.parse({ id, kind: op.data!.kind, expectedHash: op.data!.expected_hash, plan: pub.data!.manifest,
      results: (results.data ?? []).filter((r) => r.public_sequence <= target).map((r) => r.manifest), transactionHash: op.data!.transaction_hash, blockHash: op.data!.block_hash });
  }
  return {
    async lease() { const r = await client.rpc("cs_ledger_lease", { p_scope: scope, p_holder: holder }); safe(r.error); return r.data === null ? null : z.number().int().positive().parse(r.data); },
    async release(fence) { const r = await client.rpc("cs_ledger_release", { p_scope: scope, p_holder: holder, p_fence: fence }); safe(r.error); },
    async reconciliationJobs() {
      const r = await client.from("ledger_operations").select("id").not("transaction_hash", "is", null).order("checked_at", { nullsFirst: true }).limit(5); safe(r.error);
      const jobs = []; for (const item of r.data ?? []) jobs.push(await job(item.id)); return jobs;
    },
    async next() {
      const active = await client.from("ledger_operations").select("id,status,transaction_hash").in("status", ["signing", "submitted", "uncertain"]).order("created_at").limit(1); safe(active.error);
      const current = active.data?.[0];
      if (current) return current.status === "signing" && current.transaction_hash === null ? job(current.id) : null;
      const queued = await client.from("ledger_operations").select("id").eq("status", "queued").order("created_at").limit(1); safe(queued.error);
      return queued.data?.[0] ? job(queued.data[0].id) : null;
    },
    async signed(id) {
      const r = await client.from("ledger_signed_transactions").select("nonce,raw_transaction,transaction_hash,signer,chain_id").eq("operation_id", id).maybeSingle(); safe(r.error);
      if (!r.data) return null;
      if (r.data.signer !== signer.toLowerCase() || r.data.chain_id !== 11155111) throw new Error("SIGNER_CONFIGURATION_MISMATCH");
      return signedTransactionSchema.parse({ nonce: r.data.nonce, raw: r.data.raw_transaction, hash: r.data.transaction_hash });
    },
    async prepare(id, fence) { const r = await client.rpc("cs_ledger_prepare", { p_operation: id, p_scope: scope, p_holder: holder, p_fence: fence }); safe(r.error); return r.data === true; },
    async persist(id, fence, signed) { const r = await client.rpc("cs_ledger_persist_signed", { p_operation: id, p_scope: scope, p_holder: holder, p_fence: fence, p_nonce: signed.nonce, p_raw: signed.raw, p_hash: signed.hash }); safe(r.error); return r.data === true; },
    async observe(id: string, fence: number, observation: Observation) {
      const r = await client.rpc("cs_ledger_observe", { p_operation: id, p_scope: scope, p_holder: holder, p_fence: fence, p_status: observation.status, p_code: observation.code, p_block: observation.block, p_block_hash: observation.blockHash }); safe(r.error);
    },
  };
}
