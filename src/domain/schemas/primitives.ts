import { z } from "zod";

export const safeNonnegativeInteger = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const utcInstantSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/).refine((value) => {
  const instant = new Date(value);
  return Number.isFinite(instant.getTime()) && instant.toISOString().replace(".000Z", "Z") === value;
}, "Use a valid canonical UTC instant with whole seconds.");
export const digestSchema = z.string().length(66).regex(/^0x[0-9a-f]{64}$/);
export const intervalSchema = z.strictObject({ startUtc: utcInstantSchema, endUtc: utcInstantSchema })
  .refine((value) => value.startUtc < value.endUtc, "Interval end must follow its start.");
