import { z } from "zod";
import { utcInstantSchema, intervalSchema } from "../schemas/primitives";
import { ACTIVITY_METHOD as M } from "./method";

const integer = (min: number, max: number) => z.number().int().min(min).max(max);
export const activityCategories = ["washing", "dishwasher", "drying", "television", "computer", "lighting", "fan", "vacuuming", "ironing", "car_cleaning", "charging", "custom"] as const;
export const activityCategorySchema = z.enum(activityCategories);
export const activityIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
export const energyInputSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("average_power"), powerMw: integer(100, 50_000_000), origin: z.enum(["user_estimate", "user_reported_measurement", "device_label"]), confirmed: z.literal(true) }),
  z.strictObject({ kind: z.literal("cycle_energy"), energyMwh: integer(1, M.maximumEnergyMwh), origin: z.enum(["user_estimate", "user_reported_measurement", "device_label"]), confirmed: z.literal(true) }),
  z.strictObject({ kind: z.literal("reference"), profileId: activityIdSchema, profileVersion: integer(1, 1000), confirmed: z.literal(true) }),
  z.strictObject({ kind: z.literal("no_direct_electricity"), confirmed: z.literal(true) }),
]);
export const activityInputSchema = z.strictObject({
  schemaVersion: z.literal(2), id: activityIdSchema, category: activityCategorySchema,
  name: z.string().trim().min(1).max(80), durationMinutes: integer(1, M.maximumDurationMinutes),
  quantity: integer(1, 50), energy: energyInputSchema,
});
export type ActivityInputV2 = z.infer<typeof activityInputSchema>;

export const referenceProfileSchema = z.strictObject({
  id: activityIdSchema, version: integer(1, 1000), category: activityCategorySchema,
  title: z.string().min(1).max(120), model: z.string().min(1).max(80),
  basis: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("power"), powerMw: integer(100, 50_000_000), rating: z.enum(["average", "rated", "maximum"]) }),
    z.strictObject({ kind: z.literal("cycle"), energyMwh: integer(1, M.maximumEnergyMwh) }),
  ]),
  sourceUrl: z.url().refine((v) => v.startsWith("https://")), sourceTitle: z.string().min(1).max(160),
  reviewedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), conditions: z.string().min(1).max(600),
});
export type ReferenceProfileV2 = z.infer<typeof referenceProfileSchema>;
export const segmentSchema = z.strictObject({ offsetSeconds: integer(0, 172800), durationSeconds: integer(1, 172800), energyMwh: integer(0, M.maximumEnergyMwh) });
export const resolvedActivitySchema = z.strictObject({
  input: activityInputSchema, durationSeconds: integer(60, 172800), energyMwh: integer(0, M.maximumEnergyMwh),
  segments: z.array(segmentSchema).min(1).max(M.maximumSegments),
  reference: referenceProfileSchema.nullable(),
  limitations: z.array(z.enum(["estimated_energy", "user_reported_energy", "uniform_cycle", "constant_power", "nameplate_scenario", "electricity_only", "no_direct_electricity"])).max(8),
}).superRefine((v, ctx) => {
  let end = 0, energy = 0;
  for (const segment of v.segments) {
    if (segment.offsetSeconds !== end) ctx.addIssue({ code: "custom", message: "Energy segments must be contiguous." });
    end += segment.durationSeconds; energy += segment.energyMwh;
  }
  if (end !== v.durationSeconds || end !== v.input.durationMinutes * 60 || energy !== v.energyMwh)
    ctx.addIssue({ code: "custom", message: "Segments must preserve total duration and energy." });
  if ((v.energyMwh === 0) !== (v.input.energy.kind === "no_direct_electricity"))
    ctx.addIssue({ code: "custom", message: "Zero energy requires a confirmed non-electrical activity." });
});
export type ResolvedActivityV2 = z.infer<typeof resolvedActivitySchema>;
const minuteUtc = utcInstantSchema.refine((v) => v.endsWith(":00Z"), "Choose a whole-minute start.");
export const taskInputSchema = z.strictObject({
  activity: activityInputSchema, baselineStartUtc: minuteUtc,
  windows: z.array(intervalSchema.refine((v) => v.startUtc.endsWith(":00Z") && v.endUtc.endsWith(":00Z"), "Use whole-minute windows.")).min(1).max(8), blocks: z.array(intervalSchema.refine((v) => v.startUtc.endsWith(":00Z") && v.endUtc.endsWith(":00Z"), "Use whole-minute blocks.")).max(8),
  fixedStartUtc: minuteUtc.nullable(), resourceIds: z.array(activityIdSchema).max(4),
  requiresAttention: z.boolean(), predecessorIds: z.array(activityIdSchema).max(11),
});
export type TaskInputV2 = z.infer<typeof taskInputSchema>;
export const scheduleInputSchema = z.strictObject({
  schemaVersion: z.literal(2), kind: z.enum(["tasks", "day"]),
  geography: z.literal("GB_NATIONAL"), timezone: z.literal("Europe/London"),
  dayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  tasks: z.array(taskInputSchema).min(1).max(M.maximumTasks),
}).superRefine((v, ctx) => {
  if ((v.kind === "day") !== (v.dayDate !== null)) ctx.addIssue({ code: "custom", path: ["dayDate"], message: "A day plan needs its London date; other plans have no day boundary." });
  const ids = new Set(v.tasks.map((t) => t.activity.id));
  if (ids.size !== v.tasks.length) ctx.addIssue({ code: "custom", path: ["tasks"], message: "Task IDs must be unique." });
  for (const [i, task] of v.tasks.entries()) {
    if (task.predecessorIds.some((id) => id === task.activity.id || !ids.has(id)) || new Set(task.predecessorIds).size !== task.predecessorIds.length)
      ctx.addIssue({ code: "custom", path: ["tasks", i, "predecessorIds"], message: "Choose distinct other tasks in this schedule." });
    if (new Set(task.resourceIds).size !== task.resourceIds.length)
      ctx.addIssue({ code: "custom", path: ["tasks", i, "resourceIds"], message: "Resources must be distinct." });
  }
});
export type ScheduleInputV2 = z.infer<typeof scheduleInputSchema>;
