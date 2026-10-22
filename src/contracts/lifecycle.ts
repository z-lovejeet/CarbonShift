import { z } from "zod";
import { executionReportSchema, updatedResultSchema, utcInstantSchema } from "@/domain/schemas";

const reason = z.string().trim().max(500);
export const reportRequestSchema = z.strictObject({
  kind: z.enum(["ran", "did_not_run"]), reportedStartUtc: utcInstantSchema.nullable(),
  profileStillApplicable: z.boolean().nullable(), correctsReportId: z.uuid().nullable(), reason,
}).superRefine((value, context) => {
  if (value.kind === "ran" ? value.reportedStartUtc === null || value.profileStillApplicable === null : value.reportedStartUtc !== null || value.profileStillApplicable !== null)
    context.addIssue({ code: "custom", message: "A run requires its start and profile confirmation; non-execution requires both to be null." });
  if (value.correctsReportId !== null && !value.reason) context.addIssue({ code: "custom", path: ["reason"], message: "Explain this correction." });
});
export const cancelRequestSchema = z.strictObject({ reason: reason.min(1) });
export const refreshRequestSchema = z.strictObject({ expectedResultRevision: z.number().int().positive() });
export const accountDeleteRequestSchema = z.strictObject({ acknowledgeDeletion: z.literal(true) });
export const reportDocumentSchema = z.strictObject({
  schemaVersion: z.literal(1), id: z.uuid(), planId: z.uuid(), sequence: z.number().int().positive(), createdAtUtc: utcInstantSchema,
  kind: z.enum(["ran", "did_not_run"]), reportedStartUtc: utcInstantSchema.nullable(), profileStillApplicable: z.boolean().nullable(),
  correctsReportId: z.uuid().nullable(), reason, note: reason.default(""), source: z.enum(["report", "cancellation"]),
}).superRefine((value, context) => {
  if (!executionReportSchema.safeParse({ id: value.id, createdAtUtc: value.createdAtUtc, kind: value.kind, reportedStartUtc: value.reportedStartUtc, profileStillApplicable: value.profileStillApplicable }).success)
    context.addIssue({ code: "custom", message: "Invalid execution report." });
  if (value.correctsReportId !== null && !value.reason) context.addIssue({ code: "custom", message: "A correction requires a reason." });
  if (value.source === "cancellation" && (value.kind !== "did_not_run" || value.correctsReportId !== null || value.reason !== "cancelled_before_start")) context.addIssue({ code: "custom", message: "Invalid cancellation report." });
});
export const resultRevisionSchema = z.strictObject({
  schemaVersion: z.literal(1), id: z.uuid(), planId: z.uuid(), sequence: z.number().int().positive(), reportId: z.uuid(),
  createdAtUtc: utcInstantSchema, reason: z.enum(["submitted", "correction", "refresh", "cancelled"]),
  actualSnapshotId: z.uuid().nullable(), result: updatedResultSchema,
}).superRefine((value, context) => {
  if (value.result.reportId !== value.reportId || (value.actualSnapshotId === null) !== (value.result.snapshotHash === null)) context.addIssue({ code: "custom", message: "Result references disagree." });
});
export const lifecycleAckSchema = z.strictObject({ planId: z.uuid(), planVersion: z.number().int().positive(), reportId: z.uuid().nullable(), resultId: z.uuid().nullable(), changed: z.boolean(), deleted: z.boolean() });
export type ReportRequest = z.infer<typeof reportRequestSchema>;
export type ReportDocument = z.infer<typeof reportDocumentSchema>;
export type ResultRevision = z.infer<typeof resultRevisionSchema>;
export type LifecycleAck = z.infer<typeof lifecycleAckSchema>;
