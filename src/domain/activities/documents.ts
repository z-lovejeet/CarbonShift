import { z } from "zod";
import { activityInputSchema, resolvedActivitySchema, referenceProfileSchema } from "@/domain/activities/schemas";
import { gridSnapshotSchema, digestSchema, utcInstantSchema } from "@/domain/schemas";
import { ACTIVITY_METHOD } from "@/domain/activities/method";

const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const simulationRequestSchema = z.strictObject({ schemaVersion: z.literal(2), activity: activityInputSchema, startUtc: utcInstantSchema });
export type SimulationRequest = z.infer<typeof simulationRequestSchema>;
export const activityEstimateSchema = z.strictObject({ startUtc: utcInstantSchema, endUtc: utcInstantSchema, energyMwh: amount,
  estimatedMg: amount.nullable(), status: z.enum(["available", "incomplete_grid", "no_direct_electricity"]), factorKind: z.enum(["forecast", "actual"]),
  intervals: z.array(z.strictObject({ fromUtc: utcInstantSchema, toUtc: utcInstantSchema, factorGPerKwh: amount.nullable(), roundedEnergyMwh: amount, roundedMg: amount.nullable() })).max(256),
});
export const gridRecordSchema = z.strictObject({ id: z.uuid(), hash: digestSchema, snapshot: gridSnapshotSchema, attribution: z.string().max(600) });
export const simulationDocumentSchema = z.strictObject({ schemaVersion: z.literal(2), methodVersion: z.literal(ACTIVITY_METHOD.version),
  activity: resolvedActivitySchema, estimate: activityEstimateSchema, grid: gridRecordSchema.nullable(),
  calculatedAtUtc: utcInstantSchema, dataStatus: z.enum(["available", "partial", "unavailable", "not_required"]),
  message: z.string().max(600).nullable(),
});
export type SimulationDocument = z.infer<typeof simulationDocumentSchema>;
export const profileListSchema = z.strictObject({ schemaVersion: z.literal(2), profiles: z.array(referenceProfileSchema).max(100) });
