import { z } from "zod";
import { addressSchema, hashSchema, nonzeroHashSchema } from "./schemas";
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const uint32 = integer.max(0xffffffff);
const eventPosition = { transactionHash: nonzeroHashSchema, blockHash: nonzeroHashSchema, blockNumber: integer, blockTimestamp: integer, logIndex: integer };
/** Only a caller's independently obtained contract reads/events belong here, never bundle metadata. */
export const chainObservationSchema = z.strictObject({
  chainId: integer, contractAddress: addressSchema, currentOwner: z.string().regex(/^0x[0-9a-f]{40}$/),
  receipt: z.strictObject({ receiptId: nonzeroHashSchema, exists: z.boolean(), planHash: hashSchema, methodHash: hashSchema, commitBefore: integer, committedAt: integer, isDemo: z.boolean(), initialIssuer: addressSchema, latestRevision: uint32, latestResultHash: hashSchema }),
  commit: z.strictObject({ ...eventPosition, receiptId: nonzeroHashSchema, planHash: nonzeroHashSchema, methodHash: nonzeroHashSchema, commitBefore: integer, committedAt: integer, isDemo: z.boolean(), issuer: addressSchema }),
  results: z.array(z.strictObject({ ...eventPosition, receiptId: nonzeroHashSchema, revision: uint32.min(1), previousResultHash: hashSchema, resultHash: nonzeroHashSchema, issuer: addressSchema })).max(100),
});
export const verificationContextSchema = z.strictObject({ expectedChainId: integer, expectedContractAddress: addressSchema, chain: chainObservationSchema.nullable() });
export type ChainObservation = z.infer<typeof chainObservationSchema>;
export type VerificationContext = z.infer<typeof verificationContextSchema>;
