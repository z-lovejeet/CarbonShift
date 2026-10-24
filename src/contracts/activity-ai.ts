import { z } from "zod";
import { activityCategorySchema } from "@/domain/activities/schemas";
const local = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable();
export const activitySuggestionSchema = z.strictObject({ schemaVersion: z.literal(2), tasks: z.array(z.strictObject({
  category: activityCategorySchema, durationMinutes: z.number().int().min(1).max(2880).nullable(), quantity: z.number().int().min(1).max(50).nullable(),
  energyText: z.string().max(40).nullable(), earliestLocal: local, deadlineLocal: local, baselineLocal: local,
  fixed: z.boolean().nullable(), requiresAttention: z.boolean().nullable(),
  predecessorIndices: z.array(z.number().int().min(0).max(11)).max(11),
  sourceStart: z.number().int().min(0).max(2000), sourceEnd: z.number().int().min(1).max(2000),
  questions: z.array(z.enum(["energy", "duration", "timing", "equipment", "attention", "conflict", "unsupported"])).max(7),
})).min(1).max(12) });
export type ActivitySuggestion = z.infer<typeof activitySuggestionSchema>;
export const activityInterpretRequestSchema = z.strictObject({ schemaVersion: z.literal(2), text: z.string().min(1).max(2000).refine((s) => s.trim().length > 0),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), aiConsent: z.literal(true) });
export const scheduleExplanationSchema = z.strictObject({ schemaVersion: z.literal(2), codes: z.array(z.enum([
  "LOWER_ESTIMATE", "NO_IMPROVEMENT_FOUND", "FIXED_TIMES_RETAINED", "DEPENDENCIES_RESPECTED", "WINDOW_TOO_SHORT", "RESOURCE_CONFLICT", "WIDER_WINDOW_AVAILABLE", "DATA_MISSING", "SEARCH_LIMITED",
])).min(1).max(6) });
