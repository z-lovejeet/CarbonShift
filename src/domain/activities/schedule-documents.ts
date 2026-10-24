import { z } from "zod";
import { ACTIVITY_METHOD } from "@/domain/activities/method";
import { scheduleInputSchema, resolvedActivitySchema, activityIdSchema } from "@/domain/activities/schemas";
import { activityEstimateSchema, gridRecordSchema } from "./documents";
import { utcInstantSchema } from "@/domain/schemas";
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const assignmentSchema = activityEstimateSchema.omit({ intervals: true }).extend({ taskId: activityIdSchema });
export const scheduleOptionSchema = z.strictObject({ tasks: z.array(assignmentSchema).min(1).max(12), energyMwh: count, estimatedMg: count });
export const solutionSchema = z.strictObject({ baseline: scheduleOptionSchema, selected: scheduleOptionSchema, alternatives: z.array(scheduleOptionSchema).max(3), differenceMg: z.number().int().safe(),
  search: z.strictObject({ status: z.enum(["optimal_within_candidates", "best_found"]), nodesExplored: count, candidateStepSeconds: z.literal(300), nodeBudget: z.literal(50000), candidateCounts: z.array(count).min(1).max(12) }) });
export const scheduleComparisonSchema = z.strictObject({ schemaVersion: z.literal(2), id: z.uuid(), version: z.literal(1), methodVersion: z.literal(ACTIVITY_METHOD.version),
  input: scheduleInputSchema, activities: z.array(resolvedActivitySchema).min(1).max(12), grid: gridRecordSchema, solution: solutionSchema, createdAtUtc: utcInstantSchema, expiresAtUtc: utcInstantSchema });
export type ScheduleComparison = z.infer<typeof scheduleComparisonSchema>;
export const compareScheduleRequestSchema = z.strictObject({ input: scheduleInputSchema, constraintsConfirmed: z.literal(true) });
export const acceptScheduleRequestSchema = z.strictObject({ comparisonId: z.uuid(), version: z.literal(1), optionIndex: z.number().int().min(0).max(3), confirmed: z.literal(true) });
export const scheduleDocumentSchema = z.strictObject({ schemaVersion: z.literal(2), id: z.uuid(), acceptedAtUtc: utcInstantSchema, publicationStatus: z.enum(["private", "queued", "signing", "submitted", "confirmed", "failed", "uncertain"]).default("private"), comparison: scheduleComparisonSchema, optionIndex: z.number().int().min(0).max(3) });
export type ScheduleDocument = z.infer<typeof scheduleDocumentSchema>;
export const schedulePageSchema = z.strictObject({ items: z.array(scheduleDocumentSchema).max(20), nextCursor: z.string().max(500).nullable() });
export function selectedSchedule(plan: ScheduleDocument) { return plan.optionIndex === 0 ? plan.comparison.solution.selected : plan.comparison.solution.alternatives[plan.optionIndex - 1]!; }
