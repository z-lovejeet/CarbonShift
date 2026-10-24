import { z } from "zod";
import { planV2Schema, resultV2Schema } from "@/domain/proof/v2/schemas";
import { nonzeroHashSchema } from "@/domain/proof/schemas";
import { operationSchema } from "./publication";
import { utcInstantSchema } from "@/domain/schemas";
export const schedulePreviewSchema = z.strictObject({ id: z.uuid(), manifest: z.union([planV2Schema, resultV2Schema]), manifestHash: nonzeroHashSchema, expiresAtUtc: utcInstantSchema, consentVersion: z.literal("public-proof-v2") });
export const scheduleConsentSchema = z.strictObject({ previewId: z.uuid(), manifestHash: nonzeroHashSchema, consentVersion: z.literal("public-proof-v2"), consent: z.literal(true) });
export const schedulePublicationStateSchema = z.strictObject({ publication: z.strictObject({ receiptId: nonzeroHashSchema, manifestHash: nonzeroHashSchema, manifest: planV2Schema, operation: operationSchema, results: z.array(z.strictObject({ manifest: resultV2Schema, manifestHash: nonzeroHashSchema, operation: operationSchema })).max(100) }).nullable() });
export type SchedulePublicationState = z.infer<typeof schedulePublicationStateSchema>;
