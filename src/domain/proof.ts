/** Browser-safe proof entry point; chain observations must come from independently trusted reads. */
export { planManifestSchema, resultManifestSchema, proofBundleSchema, ZERO_HASH, PROOF_CHAIN_ID } from "./proof/schemas";
export type { PlanManifestV1, ResultManifestV1, ProofBundleV1 } from "./proof/schemas";
export { METHOD_DESCRIPTOR, SUPPORTED_METHOD_HASH } from "./proof/method-descriptor";
export { canonicalJson, hashPlan, hashResult, hashMethod, exportProofBundle, importProofBundle, MAX_BUNDLE_BYTES } from "./proof/canonical";
export { chainObservationSchema } from "./proof/observations";
export type { ChainObservation, VerificationContext } from "./proof/observations";
export { verifyProofBundle } from "./proof/verifier";
export type { VerificationReport, VerificationChecks, ProofCheck } from "./proof/verifier";
