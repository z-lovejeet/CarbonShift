import { z } from "zod";
import { METHOD } from "../method";
import { digestSchema, intervalSchema, safeNonnegativeInteger, utcInstantSchema } from "./primitives";

export { digestSchema, utcInstantSchema } from "./primitives";
export const durationSchema = z.union(METHOD.durationsMinutes.map((minutes) => z.literal(minutes)));
export const energyWhSchema = z.number().int().min(METHOD.minimumEnergyWh).max(METHOD.maximumEnergyWh);
export const energyBasisSchema = z.enum(["user_estimate", "illustrative_default"]);

export const confirmedConstraintsSchema = z.strictObject({
  geography: z.literal(METHOD.geography), timezone: z.literal(METHOD.timezone),
  earliestStartUtc: utcInstantSchema, deadlineUtc: utcInstantSchema,
  durationMinutes: durationSchema, energyWh: energyWhSchema, energyBasis: energyBasisSchema,
  blockedIntervals: z.array(intervalSchema).max(METHOD.maximumBlocks),
  baselineStartUtc: utcInstantSchema,
  baselineOrigin: z.enum(["user_selected", "earliest_feasible_confirmed"]),
  confirmedAtUtc: utcInstantSchema,
}).superRefine((value, ctx) => {
  if (value.earliestStartUtc >= value.deadlineUtc) ctx.addIssue({ code: "custom", path: ["deadlineUtc"], message: "Deadline must follow earliest start." });
  const blocks = [...value.blockedIntervals].sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    if (block.startUtc < value.earliestStartUtc || block.endUtc > value.deadlineUtc) ctx.addIssue({ code: "custom", path: ["blockedIntervals"], message: "Blocks must lie within the requested window." });
    if (i > 0 && blocks[i - 1]!.endUtc > block.startUtc) ctx.addIssue({ code: "custom", path: ["blockedIntervals"], message: "Blocked intervals must not overlap." });
  }
});
export type ConfirmedConstraintsV1 = z.infer<typeof confirmedConstraintsSchema>;

export const gridIntervalSchema = z.strictObject({
  fromUtc: utcInstantSchema, toUtc: utcInstantSchema,
  forecastGPerKwh: safeNonnegativeInteger.nullable(), actualGPerKwh: safeNonnegativeInteger.nullable(),
}).superRefine((value, ctx) => {
  const from = Date.parse(value.fromUtc) / 1000;
  if (from % METHOD.intervalSeconds !== 0 || Date.parse(value.toUtc) / 1000 - from !== METHOD.intervalSeconds) {
    ctx.addIssue({ code: "custom", message: "Grid intervals must be aligned UTC half-hours." });
  }
});
export const gridSnapshotFieldsSchema = z.strictObject({
  geography: z.literal(METHOD.geography), sourceUrl: z.url({ protocol: /^https$/ }),
  retrievedAtUtc: utcInstantSchema, providerIssuedAtUtc: utcInstantSchema.nullable(),
  license: z.string().min(1).max(200), intervals: z.array(gridIntervalSchema).min(1),
});
export const gridSnapshotSchema = gridSnapshotFieldsSchema.superRefine((value, ctx) => {
  if (value.providerIssuedAtUtc !== null && value.providerIssuedAtUtc > value.retrievedAtUtc) ctx.addIssue({ code: "custom", path: ["providerIssuedAtUtc"], message: "Issuance cannot follow retrieval." });
  for (let i = 1; i < value.intervals.length; i++) {
    if (value.intervals[i - 1]!.toUtc !== value.intervals[i]!.fromUtc) ctx.addIssue({ code: "custom", path: ["intervals", i], message: "Intervals must be ordered and contiguous, without duplicates." });
  }
});
export type GridSnapshotV1 = z.infer<typeof gridSnapshotSchema>;
export type GridIntervalV1 = z.infer<typeof gridIntervalSchema>;

export const candidateSchema = z.strictObject({
  startUtc: utcInstantSchema, endUtc: utcInstantSchema,
  energyWhBins: z.array(safeNonnegativeInteger).min(1).max(METHOD.maximumProfileBins),
  factorGPerKwh: z.array(safeNonnegativeInteger).min(1).max(METHOD.maximumProfileBins),
  estimatedMg: safeNonnegativeInteger, rank: z.number().int().min(1).max(96),
}).superRefine((value, ctx) => {
  const seconds = Date.parse(value.startUtc) / 1000;
  const bins = value.energyWhBins.length;
  const energy = value.energyWhBins.reduce((sum, bin) => sum + bin, 0);
  const total = value.energyWhBins.reduce((sum, bin, i) => sum + BigInt(bin) * BigInt(value.factorGPerKwh[i] ?? 0), 0n);
  const q = Math.floor(energy / bins), r = energy % bins;
  if (seconds % METHOD.intervalSeconds !== 0 || Date.parse(value.endUtc) / 1000 - seconds !== bins * METHOD.intervalSeconds ||
    value.factorGPerKwh.length !== bins || energy < METHOD.minimumEnergyWh || energy > METHOD.maximumEnergyWh ||
    value.energyWhBins.some((bin, i) => bin !== q + (i < r ? 1 : 0)) || total !== BigInt(value.estimatedMg)) {
    ctx.addIssue({ code: "custom", message: "Candidate timing, profile, factors and total must agree." });
  }
});
export type CandidateV1 = z.infer<typeof candidateSchema>;

export const comparisonSchema = z.strictObject({
  constraints: confirmedConstraintsSchema,
  forecastSnapshotId: z.uuid(), forecastSnapshotHash: digestSchema,
  baseline: candidateSchema, selected: candidateSchema,
  alternatives: z.array(candidateSchema).max(METHOD.maximumAlternatives),
  differenceMg: safeNonnegativeInteger, differencePercent: z.number().min(0).max(100).nullable(),
  methodVersion: z.literal(METHOD.version), createdAtUtc: utcInstantSchema, expiresAtUtc: utcInstantSchema,
}).superRefine((value, ctx) => {
  const expectedPercent = value.baseline.estimatedMg > 0 ? 100 * value.differenceMg / value.baseline.estimatedMg : null;
  const starts = [value.selected, ...value.alternatives].map((candidate) => candidate.startUtc);
  if (value.baseline.startUtc !== value.constraints.baselineStartUtc || value.selected.rank !== 1 ||
    value.differenceMg !== value.baseline.estimatedMg - value.selected.estimatedMg || value.differencePercent !== expectedPercent ||
    new Set(starts).size !== starts.length || value.createdAtUtc >= value.expiresAtUtc) {
    ctx.addIssue({ code: "custom", message: "Comparison references, amounts, ranks and expiry must agree." });
  }
  const created = Date.parse(value.createdAtUtc) / 1000;
  const cutoff = Math.min(Date.parse(value.baseline.startUtc), Date.parse(value.selected.startUtc)) / 1000;
  const expectedExpiry = Math.min(created + METHOD.comparisonLifetimeSeconds, cutoff - METHOD.operationalBufferSeconds);
  const first = Math.ceil(Math.max(Date.parse(value.constraints.earliestStartUtc) / 1000, created + METHOD.operationalBufferSeconds) / METHOD.intervalSeconds) * METHOD.intervalSeconds;
  const all = [value.baseline, value.selected, ...value.alternatives];
  if (Date.parse(value.expiresAtUtc) / 1000 !== expectedExpiry || value.constraints.confirmedAtUtc > value.createdAtUtc ||
    Date.parse(value.constraints.deadlineUtc) / 1000 > created + METHOD.horizonSeconds ||
    all.some((candidate) => {
      return Date.parse(candidate.startUtc) / 1000 < first || candidate.endUtc > value.constraints.deadlineUtc ||
        Date.parse(candidate.endUtc) - Date.parse(candidate.startUtc) !== value.constraints.durationMinutes * 60000 ||
        candidate.energyWhBins.reduce((sum, bin) => sum + bin, 0) !== value.constraints.energyWh ||
        value.constraints.blockedIntervals.some((block) => candidate.startUtc < block.endUtc && candidate.endUtc > block.startUtc);
    }) || value.alternatives.some((candidate, i) => {
      const previous = i === 0 ? value.selected : value.alternatives[i - 1]!;
      return candidate.rank !== i + 2 || candidate.estimatedMg < previous.estimatedMg ||
        (candidate.estimatedMg === previous.estimatedMg && candidate.startUtc < previous.startUtc);
    }) || all.some((candidate) => candidate.startUtc === value.baseline.startUtc && JSON.stringify(candidate) !== JSON.stringify(value.baseline))) {
    ctx.addIssue({ code: "custom", message: "Comparison timing, constraints, baseline and ordered alternatives must be consistent." });
  }
});
export type ComparisonV1 = z.infer<typeof comparisonSchema>;

const reportFields = {
  id: z.uuid(), createdAtUtc: utcInstantSchema,
};
export const executionReportSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...reportFields, kind: z.literal("ran"), reportedStartUtc: utcInstantSchema.refine((value) => value.endsWith(":00Z"), "Reported start must have minute precision."), profileStillApplicable: z.boolean() }),
  z.strictObject({ ...reportFields, kind: z.literal("did_not_run"), reportedStartUtc: z.null(), profileStillApplicable: z.null() }),
]);
export type ExecutionReportV1 = z.infer<typeof executionReportSchema>;
export const updatedResultSchema = z.strictObject({
  status: z.enum(["forecast_only", "actual_pending", "actual_estimate", "did_not_run", "outside_supported_window"]),
  executionBasis: z.literal("self_reported"), energyBasis: energyBasisSchema, methodVersion: z.literal(METHOD.version),
  reportId: z.uuid().nullable(), snapshotHash: digestSchema.nullable(),
  baselineActualMg: safeNonnegativeInteger.nullable(), reportedActualMg: safeNonnegativeInteger.nullable(),
  differenceMg: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).nullable(),
  differencePercent: z.number().finite().nullable(),
  reasonCodes: z.array(z.enum(["ACTUAL_SNAPSHOT_UNAVAILABLE", "MISSING_ACTUAL_FACTORS", "PROFILE_CHANGED", "REPORT_TOO_LATE"])),
  deviationCodes: z.array(z.enum(["DIFFERENT_START", "BEFORE_EARLIEST", "AFTER_DEADLINE", "BLOCKED_PERIOD"])),
}).superRefine((value, ctx) => {
  if (value.status === "actual_estimate") {
    if (value.baselineActualMg === null || value.reportedActualMg === null || value.differenceMg !== value.baselineActualMg - value.reportedActualMg ||
      value.differencePercent !== (value.baselineActualMg > 0 ? 100 * (value.differenceMg ?? 0) / value.baselineActualMg : null) || value.reasonCodes.length > 0 || value.reportId === null || value.snapshotHash === null) {
      ctx.addIssue({ code: "custom", message: "Updated amounts require complete actual-factor coverage and matching arithmetic." });
    }
  } else if ([value.baselineActualMg, value.reportedActualMg, value.differenceMg, value.differencePercent].some((amount) => amount !== null)) {
    ctx.addIssue({ code: "custom", message: "Unavailable results must not contain numeric estimates." });
  }
  if ((value.status === "forecast_only") !== (value.reportId === null)) ctx.addIssue({ code: "custom", message: "Result status must match report presence." });
  const reason = value.reasonCodes[0];
  if (new Set(value.reasonCodes).size !== value.reasonCodes.length || new Set(value.deviationCodes).size !== value.deviationCodes.length ||
    (["forecast_only", "did_not_run"].includes(value.status) && (value.reasonCodes.length > 0 || value.deviationCodes.length > 0 || value.snapshotHash !== null)) ||
    (value.status === "actual_pending" && (value.reasonCodes.length !== 1 ||
      !["ACTUAL_SNAPSHOT_UNAVAILABLE", "MISSING_ACTUAL_FACTORS"].includes(reason ?? "") ||
      (reason === "ACTUAL_SNAPSHOT_UNAVAILABLE") !== (value.snapshotHash === null))) ||
    (value.status === "outside_supported_window" && (value.reasonCodes.length !== 1 || !["PROFILE_CHANGED", "REPORT_TOO_LATE"].includes(reason ?? "") || value.snapshotHash !== null))) {
    ctx.addIssue({ code: "custom", message: "Result reasons, missing-data references and evidence state must agree." });
  }
});
export type UpdatedResultV1 = z.infer<typeof updatedResultSchema>;
