import { z } from "zod";
import { confirmedConstraintsSchema, energyBasisSchema, gridSnapshotSchema, utcInstantSchema } from "../schemas";

export const ZERO_HASH = `0x${"0".repeat(64)}`;
export const PROOF_CHAIN_ID = 11155111;
export const hashSchema = z.string().regex(/^0x[0-9a-f]{64}$/);
export const nonzeroHashSchema = hashSchema.refine((v) => v !== ZERO_HASH, "Use a nonzero bytes32 value.");
export const addressSchema = z.string().regex(/^0x[0-9a-f]{40}$/).refine((v) => v !== `0x${"0".repeat(40)}`);
const unsigned = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const signed = z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const revision = z.number().int().min(1).max(0xffffffff);
const boundedText = z.string().max(500);
const methodVersion = z.string().min(1).max(80);
export const publicSnapshotSchema = gridSnapshotSchema.safeExtend({
  sourceUrl: z.string().max(2048).refine((v) => {
    try { const u = new URL(v); return u.protocol === "https:" && u.hostname === "api.carbonintensity.org.uk" && !u.port && !u.username && !u.password && !u.search && !u.hash; } catch { return false; }
  }, "Use the public national grid source without credentials or query data."),
  intervals: gridSnapshotSchema.shape.intervals.max(200),
});
const context = { receiptId: nonzeroHashSchema, nonce: nonzeroHashSchema, mode: z.enum(["live", "demo"]), chainId: z.literal(PROOF_CHAIN_ID), contractAddress: addressSchema, methodVersion, methodHash: nonzeroHashSchema };
const windowSummarySchema = z.strictObject({ startUtc: utcInstantSchema, endUtc: utcInstantSchema, estimatedMg: unsigned });
export const planManifestSchema = z.strictObject({
  schemaVersion: z.literal(1), type: z.literal("plan"), ...context,
  comparisonCreatedAtUtc: utcInstantSchema, acceptedAtUtc: utcInstantSchema, commitBeforeUtc: utcInstantSchema.nullable(),
  constraints: confirmedConstraintsSchema, energyWhBins: z.array(unsigned).min(1).max(6), forecastSnapshot: publicSnapshotSchema,
  baseline: windowSummarySchema, selected: windowSummarySchema, differenceMg: unsigned, executionBasis: z.literal("not_observed"), attribution: z.string().min(1).max(500),
}).superRefine((v, c) => {
  if ((v.mode === "demo") !== (v.commitBeforeUtc === null)) c.addIssue({ code: "custom", message: "Demo cutoff must be null; live cutoff is required." });
});
export const resultManifestSchema = z.strictObject({
  schemaVersion: z.literal(1), type: z.literal("result"), ...context, planHash: nonzeroHashSchema,
  publicRevision: revision, previousResultHash: hashSchema, privateResultRevisionNumber: revision,
  reportedKind: z.enum(["ran", "did_not_run"]), reportedStartUtc: utcInstantSchema.nullable(), reportCreatedAtUtc: utcInstantSchema,
  resultCreatedAtUtc: utcInstantSchema, reportSource: z.enum(["report", "cancellation"]), profileStillApplicable: z.boolean().nullable(),
  executionBasis: z.enum(["self_reported", "simulated"]), energyBasis: energyBasisSchema,
  resultStatus: z.enum(["actual_pending", "actual_estimate", "did_not_run", "outside_supported_window"]),
  baselineActualMg: unsigned.nullable(), reportedActualMg: unsigned.nullable(), differenceMg: signed.nullable(), actualSnapshot: publicSnapshotSchema.nullable(),
  reasonCode: z.enum(["ACTUAL_SNAPSHOT_UNAVAILABLE", "MISSING_ACTUAL_FACTORS", "PROFILE_CHANGED", "REPORT_TOO_LATE", "cancelled_before_start"]).nullable(),
  correctionExplanation: boundedText,
}).superRefine((v, c) => {
  const issue = (message: string) => c.addIssue({ code: "custom", message });
  if ((v.mode === "demo") !== (v.executionBasis === "simulated")) issue("Execution basis must retain its mode.");
  if (v.reportedKind === "ran" ? v.reportedStartUtc === null || v.profileStillApplicable === null || !v.reportedStartUtc.endsWith(":00Z") : v.reportedStartUtc !== null || v.profileStillApplicable !== null) issue("Report kind and profile fields disagree.");
  if (v.resultStatus !== "actual_estimate" && [v.baselineActualMg, v.reportedActualMg, v.differenceMg].some((x) => x !== null)) issue("Unavailable amounts must be null.");
  if (v.resultStatus === "actual_estimate" && (v.baselineActualMg === null || v.reportedActualMg === null || v.differenceMg === null || v.actualSnapshot === null || v.reasonCode !== null)) issue("Actual estimates require factors and all amounts.");
  if ((v.publicRevision === 1) !== (v.previousResultHash === ZERO_HASH)) issue("The first public revision alone has a zero previous hash.");
  if (v.reportSource === "cancellation" && (v.publicRevision !== 1 || v.privateResultRevisionNumber !== 1 || v.reportedKind !== "did_not_run" || v.resultStatus !== "did_not_run" || v.actualSnapshot !== null || v.reasonCode !== "cancelled_before_start")) issue("Invalid terminal cancellation.");
});
export const methodDescriptorSchema = z.strictObject({
  schemaVersion: z.literal(1), methodVersion, algorithm: z.string().min(1).max(100),
  constants: z.strictObject({
    geography: z.string().max(40), timezone: z.string().max(80), intervalSeconds: unsigned, intervalMinutes: unsigned,
    minimumEnergyWh: unsigned, maximumEnergyWh: unsigned, maximumProfileBins: unsigned, durationsMinutes: z.array(unsigned).max(6),
    maximumBlocks: unsigned, horizonSeconds: unsigned, operationalBufferSeconds: unsigned, comparisonLifetimeSeconds: unsigned,
    maximumForecastAgeSeconds: unsigned, resultStartExtensionSeconds: unsigned, maximumAlternatives: unsigned,
  }),
  rules: z.strictObject({ profile: boundedText, forecast: boundedText, actual: boundedText, selection: boundedText, evidence: boundedText, cancellation: boundedText }),
});
export const chainReferencesSchema = z.strictObject({ chainId: z.literal(PROOF_CHAIN_ID), contractAddress: addressSchema, planTransactionHash: nonzeroHashSchema, resultTransactionHashes: z.array(nonzeroHashSchema).max(100) });
export const proofBundleSchema = z.strictObject({ schemaVersion: z.literal(1), plan: planManifestSchema, results: z.array(resultManifestSchema).max(100), method: methodDescriptorSchema, chainReferences: chainReferencesSchema.nullable() });
export type PlanManifestV1 = z.infer<typeof planManifestSchema>;
export type ResultManifestV1 = z.infer<typeof resultManifestSchema>;
export type ProofBundleV1 = z.infer<typeof proofBundleSchema>;
