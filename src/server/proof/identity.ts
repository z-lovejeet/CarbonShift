import "server-only";
import { randomBytes } from "node:crypto";

/** M09 must persist these once before preview; retries must load the persisted identity. */
export function createProofIdentity(): { receiptId: string; nonce: string } {
  return { receiptId: `0x${randomBytes(32).toString("hex")}`, nonce: `0x${randomBytes(32).toString("hex")}` };
}
