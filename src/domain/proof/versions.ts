import { z } from "zod";
import { planManifestSchema, resultManifestSchema, proofBundleSchema } from "./schemas";
import { planV2Schema, resultV2Schema, bundleV2Schema } from "./v2/schemas";
import { hashPlan, hashResult, exportProofBundle, parseProofJson } from "./canonical";
import { hashPlanV2, hashResultV2, exportBundleV2 } from "./v2/canonical";
import { verifyProofBundle } from "./verifier";
import { verifyBundleV2 } from "./v2/verifier";
import type { VerificationContext } from "./observations";
export const anyPlanSchema = z.union([planManifestSchema, planV2Schema]);
export const anyResultSchema = z.union([resultManifestSchema, resultV2Schema]);
export const anyBundleSchema = z.union([proofBundleSchema, bundleV2Schema]);
export const versionedPlanHash = (input: unknown) => { const p = anyPlanSchema.parse(input); return p.schemaVersion === 1 ? hashPlan(p) : hashPlanV2(p); };
export const versionedResultHash = (input: unknown) => { const p = anyResultSchema.parse(input); return p.schemaVersion === 1 ? hashResult(p) : hashResultV2(p); };
export const exportVersionedBundle = (input: unknown) => { const p = anyBundleSchema.parse(input); return p.schemaVersion === 1 ? exportProofBundle(p) : exportBundleV2(p); };
export function importVersionedBundle(text: string) { const value = parseProofJson(text, 1024 * 1024), bundle = anyBundleSchema.parse(value); if (bundle.schemaVersion === 1 && new TextEncoder().encode(text).length > 256 * 1024) throw new Error("Version-1 bundle exceeds 256 KiB."); return bundle; }
export function verifyVersionedBundle(input: unknown, context?: VerificationContext) { let value = input; try { if (typeof input === "string") value = importVersionedBundle(input); } catch { return verifyProofBundle(input, context); } return value && typeof value === "object" && "schemaVersion" in value && value.schemaVersion === 2 ? verifyBundleV2(value, context) : verifyProofBundle(value, context); }
