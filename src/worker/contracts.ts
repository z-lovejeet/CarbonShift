import { z } from "zod";
import { nonzeroHashSchema } from "@/domain/proof/schemas";
import { anyPlanSchema, anyResultSchema } from "@/domain/proof/versions";
export const ledgerJobSchema = z.strictObject({
  id: z.uuid(), kind: z.enum(["plan", "result"]), expectedHash: nonzeroHashSchema,
  plan: anyPlanSchema, results: z.array(anyResultSchema).max(100),
  transactionHash: nonzeroHashSchema.nullable(), blockHash: nonzeroHashSchema.nullable(),
});
export const signedTransactionSchema = z.strictObject({ nonce: z.number().int().nonnegative(), raw: z.string().regex(/^0x[0-9a-f]+$/).max(32768), hash: nonzeroHashSchema });
export type LedgerJob = z.infer<typeof ledgerJobSchema>;
export type SignedTransaction = z.infer<typeof signedTransactionSchema>;
export type Observation = { status: "submitted" | "confirmed" | "uncertain" | "failed"; code: string | null; block: number | null; blockHash: string | null };
export interface LedgerChain {
  verify(): Promise<void>;
  sign(job: LedgerJob): Promise<SignedTransaction>;
  broadcast(job: LedgerJob, signed: SignedTransaction): Promise<void>;
  inspect(job: LedgerJob, signed: SignedTransaction): Promise<Observation>;
}
export interface LedgerStore {
  lease(): Promise<number | null>;
  release(fence: number): Promise<void>;
  reconciliationJobs(): Promise<LedgerJob[]>;
  next(): Promise<LedgerJob | null>;
  signed(id: string): Promise<SignedTransaction | null>;
  prepare(id: string, fence: number): Promise<boolean>;
  persist(id: string, fence: number, signed: SignedTransaction): Promise<boolean>;
  observe(id: string, fence: number, observation: Observation): Promise<void>;
}
export class LedgerFault extends Error {
  constructor(readonly code: "RPC_UNAVAILABLE" | "CHAIN_MISMATCH" | "NONCE_CONFLICT" | "EVENT_MISMATCH" | "INVALID_MANIFEST") { super(code); }
}
