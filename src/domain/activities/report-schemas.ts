import { z } from "zod";
import { utcInstantSchema } from "@/domain/schemas";
import { activityIdSchema } from "@/domain/activities/schemas";
import { gridRecordSchema } from "./documents";
const seq = z.number().int().nonnegative().max(1_000_000), amount = z.number().int().nonnegative().safe().nullable();
const common = { expectedReportSequence: seq, correctsReportId: z.uuid().nullable() };
export const scheduleReportRequestSchema = z.discriminatedUnion("kind", [z.strictObject({ ...common, kind: z.literal("ran"), actualStartUtc: utcInstantSchema, profileUnchanged: z.boolean() }), z.strictObject({ ...common, kind: z.literal("did_not_run"), actualStartUtc: z.null(), profileUnchanged: z.null() })]);
export type ScheduleReportRequest = z.infer<typeof scheduleReportRequestSchema>;
export const scheduleReportSchema = z.strictObject({ schemaVersion: z.literal(2), id: z.uuid(), scheduleId: z.uuid(), taskId: activityIdSchema, sequence: seq.min(1), previousReportId: z.uuid().nullable(), kind: z.enum(["ran", "did_not_run"]), actualStartUtc: utcInstantSchema.nullable(), profileUnchanged: z.boolean().nullable(), reportedAtUtc: utcInstantSchema });
export type ScheduleReport = z.infer<typeof scheduleReportSchema>;
export const taskResultSchema = z.strictObject({ schemaVersion: z.literal(2), id: z.uuid(), scheduleId: z.uuid(), taskId: activityIdSchema, reportId: z.uuid(), sequence: seq.min(1), calculatedAtUtc: utcInstantSchema,
  state: z.enum(["complete", "pending", "did_not_run", "profile_changed"]), baselineActualMg: amount, reportedActualMg: amount, differenceMg: z.number().int().safe().nullable(),
  deviationCodes: z.array(z.enum(["DIFFERENT_START", "OUTSIDE_WINDOWS", "BLOCKED_PERIOD", "CONSTRAINT_DEVIATION"])).max(4), grid: gridRecordSchema.nullable(),
}).superRefine((value, ctx) => { if ((value.state === "complete") !== (value.baselineActualMg !== null && value.reportedActualMg !== null && value.differenceMg !== null)) ctx.addIssue({ code: "custom", message: "Only a complete result has comparable amounts." }); });
export type TaskResult = z.infer<typeof taskResultSchema>;
export const scheduleHistorySchema = z.strictObject({ schemaVersion: z.literal(2), reports: z.array(scheduleReportSchema).max(12000), results: z.array(taskResultSchema).max(24000) });
export type ScheduleHistory = z.infer<typeof scheduleHistorySchema>;
export const lifecycleAckV2Schema = z.strictObject({ schemaVersion: z.literal(2), scheduleId: z.uuid(), taskId: activityIdSchema, reportId: z.uuid(), resultId: z.uuid(), reportSequence: seq.min(1), resultSequence: seq.min(1), unchanged: z.boolean() });
