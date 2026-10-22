import { z } from "zod";
import { reportDocumentSchema, resultRevisionSchema } from "./lifecycle";
import { comparisonSchema, durationSchema, energyBasisSchema, energyWhSchema, utcInstantSchema, gridSnapshotSchema } from "@/domain/schemas";

export const comparisonRequestSchema = z.strictObject({
  geography: z.literal("GB_NATIONAL"), timezone: z.literal("Europe/London"),
  earliestStartUtc: utcInstantSchema, deadlineUtc: utcInstantSchema, durationMinutes: durationSchema,
  energyWh: energyWhSchema, energyBasis: energyBasisSchema,
  blockedIntervals: z.array(z.strictObject({ startUtc: utcInstantSchema, endUtc: utcInstantSchema })).max(4),
  baseline: z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("user_selected"), startUtc: utcInstantSchema }), z.strictObject({ kind: z.literal("earliest_feasible") })]),
  constraintsConfirmed: z.literal(true),
});
export const acceptanceRequestSchema = z.strictObject({ comparisonId: z.uuid(), comparisonVersion: z.number().int().positive() });
export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);
export const comparisonDocumentSchema = comparisonSchema.safeExtend({ schemaVersion: z.literal(1), id: z.uuid(), version: z.literal(1) });
export const planSchema = z.strictObject({
  schemaVersion: z.literal(1), id: z.uuid(), version: z.number().int().positive(), comparisonId: z.uuid(),
  mode: z.literal("live"), status: z.enum(["accepted", "cancelled"]), acceptedAtUtc: utcInstantSchema,
  comparison: comparisonSchema, forecastSnapshot: gridSnapshotSchema,
  completion: z.enum(["not_reported", "ran", "did_not_run"]), publication: z.literal("private"),
  latestReport: reportDocumentSchema.nullable(), latestResult: resultRevisionSchema.nullable(), reports: z.array(reportDocumentSchema).default([]), revisions: z.array(resultRevisionSchema),
});
export const planSummarySchema = planSchema.pick({ schemaVersion: true, id: true, version: true, status: true, mode: true, acceptedAtUtc: true, comparisonId: true, completion: true, publication: true }).extend({ baseline: comparisonSchema.shape.baseline, selected: comparisonSchema.shape.selected, differenceMg: comparisonSchema.shape.differenceMg });
export const pageRequestSchema = z.strictObject({ limit: z.coerce.number().int().min(1).max(20).default(20), cursor: z.string().max(500).optional() });
export const cursorSchema = z.strictObject({ acceptedAtUtc: utcInstantSchema, id: z.uuid() });

export const comparisonViewSchema = z.strictObject({ comparison: comparisonDocumentSchema, forecastSnapshot: gridSnapshotSchema });
export const planPageSchema = z.strictObject({ items: z.array(planSummarySchema), nextCursor: z.string().nullable() });
export type ComparisonDocument = z.infer<typeof comparisonDocumentSchema>;
export type ComparisonView = z.infer<typeof comparisonViewSchema>;
export type Plan = z.infer<typeof planSchema>;
export type PlanSummary = z.infer<typeof planSummarySchema>;
export type PlanPage = z.infer<typeof planPageSchema>;
export type ComparisonRequest = z.infer<typeof comparisonRequestSchema>;
