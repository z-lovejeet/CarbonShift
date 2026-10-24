import { z } from "zod";
import { planManifestSchema, resultManifestSchema, nonzeroHashSchema } from "@/domain/proof/schemas";
import { utcInstantSchema } from "@/domain/schemas";

export const CONSENT_VERSION = "public-proof-v1";
export const publicationStatusSchema = z.enum(["private", "queued", "signing", "submitted", "confirmed", "failed", "uncertain"]);
export const consentRequestSchema = z.strictObject({ previewId: z.uuid(), manifestHash: nonzeroHashSchema, consentVersion: z.literal(CONSENT_VERSION), consent: z.literal(true) });
export const resultPreviewRequestSchema = z.strictObject({ correctionExplanation: z.string().trim().max(500) });
export const publicationAckSchema = z.strictObject({ operationId: z.uuid(), receiptId: nonzeroHashSchema, manifestHash: nonzeroHashSchema });
export const publicationPreviewSchema = z.strictObject({
  id: z.uuid(), manifest: z.union([planManifestSchema, resultManifestSchema]), manifestHash: nonzeroHashSchema,
  expiresAtUtc: utcInstantSchema, consentVersion: z.literal(CONSENT_VERSION),
});
export const operationSchema = z.strictObject({
  id: z.uuid(), kind: z.enum(["plan", "result"]), status: publicationStatusSchema.exclude(["private"]),
  manifestHash: nonzeroHashSchema, transactionHash: nonzeroHashSchema.nullable(), blockNumber: z.number().int().nonnegative().nullable(),
  checkedAtUtc: utcInstantSchema.nullable(), failureCode: z.string().max(80).nullable(),
});
export const publicationStateSchema = z.strictObject({ publication: z.strictObject({
  receiptId: nonzeroHashSchema, manifestHash: nonzeroHashSchema, manifest: planManifestSchema, operation: operationSchema,
  results: z.array(z.strictObject({ manifestHash: nonzeroHashSchema, manifest: resultManifestSchema, operation: operationSchema })).max(100),
}).nullable() });
export type PublicationPreview = z.infer<typeof publicationPreviewSchema>;
export type PublicationState = z.infer<typeof publicationStateSchema>;
export type LedgerOperation = z.infer<typeof operationSchema>;
