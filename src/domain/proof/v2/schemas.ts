import { z } from "zod";
import { scheduleInputSchema, resolvedActivitySchema } from "@/domain/activities/schemas";
import { solutionSchema } from "@/domain/activities/schedule-documents";
import { hashSchema, nonzeroHashSchema, addressSchema, publicSnapshotSchema, chainReferencesSchema } from "../schemas";
import { utcInstantSchema } from "@/domain/schemas";
const integer = z.number().int().nonnegative().safe(), nullableAmount = integer.nullable();
const context = { receiptId: nonzeroHashSchema, nonce: nonzeroHashSchema, mode: z.enum(["live", "demo"]), chainId: z.literal(11155111), contractAddress: addressSchema, methodVersion: z.string().min(1).max(80), methodHash: nonzeroHashSchema };
export const methodV2Schema = z.strictObject({ schemaVersion: z.literal(2), methodVersion: z.string().max(80), algorithm: z.string().max(100), constants: z.record(z.string(), z.union([z.string(), integer])) });
export const planV2Schema = z.strictObject({ schemaVersion: z.literal(2), type: z.literal("plan"), ...context,
  comparisonCreatedAtUtc: utcInstantSchema, acceptedAtUtc: utcInstantSchema, commitBeforeUtc: utcInstantSchema.nullable(), input: scheduleInputSchema,
  activities: z.array(resolvedActivitySchema).min(1).max(12), forecastSnapshot: publicSnapshotSchema,
  solution: solutionSchema, optionIndex: z.number().int().min(0).max(3), executionBasis: z.literal("not_observed"), attribution: z.string().max(500),
}).superRefine((v, ctx) => {
  if ((v.mode === "demo") !== (v.commitBeforeUtc === null) || v.optionIndex > v.solution.alternatives.length) ctx.addIssue({ code: "custom", message: "Mode, cutoff or selected option is invalid." });
  const aliases = v.input.tasks.map((t, i) => `task-${String(i + 1).padStart(2, "0")}`);
  if (v.input.tasks.some((t, i) => t.activity.id !== aliases[i] || t.activity.name !== t.activity.category || t.resourceIds.some((r) => !/^resource-\d{2}$/.test(r))) || v.activities.some((a) => a.input.name !== a.input.category || !aliases.includes(a.input.id))) ctx.addIssue({ code: "custom", message: "Public tasks must use generic names and local aliases." });
});
const publicReport = z.strictObject({ kind: z.enum(["ran", "did_not_run"]), actualStartUtc: utcInstantSchema.nullable(), profileUnchanged: z.boolean().nullable(), reportedAtUtc: utcInstantSchema });
const publicResult = z.strictObject({ state: z.enum(["complete", "pending", "did_not_run", "profile_changed"]), baselineActualMg: nullableAmount, reportedActualMg: nullableAmount, differenceMg: z.number().int().safe().nullable(), deviationCodes: z.array(z.enum(["DIFFERENT_START", "OUTSIDE_WINDOWS", "BLOCKED_PERIOD", "CONSTRAINT_DEVIATION"])).max(4), calculatedAtUtc: utcInstantSchema });
export const taskVectorSchema = z.strictObject({ taskId: z.string().regex(/^task-\d{2}$/), reportSequence: integer, resultSequence: integer, report: publicReport.nullable(), result: publicResult.nullable(), actualSnapshot: publicSnapshotSchema.nullable() });
const aggregateAmounts = z.strictObject({ baselineMg: integer, reportedMg: integer, differenceMg: z.number().int().safe() });
export const aggregateV2Schema = z.strictObject({ counts: z.strictObject({ total: integer.max(12), covered: integer.max(12), missingFactors: integer.max(12), notReported: integer.max(12), didNotRun: integer.max(12), profileChanged: integer.max(12) }), wholeSchedule: aggregateAmounts.nullable(), coveredSubtotal: aggregateAmounts.nullable() });
export const resultV2Schema = z.strictObject({ schemaVersion: z.literal(2), type: z.literal("result"), ...context, planHash: nonzeroHashSchema, publicRevision: integer.min(1).max(100), previousResultHash: hashSchema,
  resultCreatedAtUtc: utcInstantSchema, tasks: z.array(taskVectorSchema).min(1).max(12), aggregate: aggregateV2Schema, executionBasis: z.literal("self_reported"), correctionExplanation: z.string().max(500),
}).superRefine((v, ctx) => { if (new Set(v.tasks.map((t) => t.taskId)).size !== v.tasks.length || (v.publicRevision === 1) !== (v.previousResultHash === `0x${"0".repeat(64)}`)) ctx.addIssue({ code: "custom", message: "Invalid revision or repeated task." }); });
export const bundleV2Schema = z.strictObject({ schemaVersion: z.literal(2), plan: planV2Schema, results: z.array(resultV2Schema).max(100), method: methodV2Schema, chainReferences: chainReferencesSchema.nullable() });
export type PlanV2 = z.infer<typeof planV2Schema>;
export type ResultV2 = z.infer<typeof resultV2Schema>;
export type BundleV2 = z.infer<typeof bundleV2Schema>;
