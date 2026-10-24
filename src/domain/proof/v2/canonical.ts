import canonicalize from "canonicalize";
import { sha256 } from "@noble/hashes/sha2.js";
import { assertProofJson, parseProofJson } from "../canonical";
import { planV2Schema, resultV2Schema, methodV2Schema, bundleV2Schema } from "./schemas";
import { ACTIVITY_METHOD } from "@/domain/activities/method";
export const MAX_V2_BUNDLE_BYTES = 1024 * 1024;
export const METHOD_V2_DESCRIPTOR = { schemaVersion: 2 as const, methodVersion: ACTIVITY_METHOD.version, algorithm: "exact-segment-integration-and-bounded-joint-search", constants: ACTIVITY_METHOD };
export function canonicalV2(input: unknown) { assertProofJson(input); const text = canonicalize(input); if (text === undefined || new TextEncoder().encode(text).length > MAX_V2_BUNDLE_BYTES) throw new Error("Proof exceeds 1 MiB."); return text; }
function hash(kind: "plan" | "result" | "method", input: unknown) { return `0x${Array.from(sha256(new TextEncoder().encode(`CarbonShift:${kind}:v2\n${canonicalV2(input)}`)), (v) => v.toString(16).padStart(2, "0")).join("")}`; }
export const hashPlanV2 = (input: unknown) => hash("plan", planV2Schema.parse(input));
export const hashResultV2 = (input: unknown) => hash("result", resultV2Schema.parse(input));
export const hashMethodV2 = (input: unknown) => hash("method", methodV2Schema.parse(input));
export const METHOD_V2_HASH = hashMethodV2(METHOD_V2_DESCRIPTOR);
export const exportBundleV2 = (input: unknown) => canonicalV2(bundleV2Schema.parse(input));
export const importBundleV2 = (text: string) => bundleV2Schema.parse(parseProofJson(text, MAX_V2_BUNDLE_BYTES));
