import "server-only";
import { buildPlanManifest, buildResultManifest } from "@/server/proof/builders";
import { createProofIdentity } from "@/server/proof/identity";
import { hashResult, ZERO_HASH, METHOD_DESCRIPTOR, proofBundleSchema } from "@/domain/proof";
import { ApiError } from "@/server/http/errors";
import type { PlanRepository } from "@/server/plans/repository";
import type { PublicationRepository } from "./repository";

export function createPublicationService(plans: Pick<PlanRepository, "detail">, repository: PublicationRepository, contract: () => string) {
  return {
    async preview(planId: string, sequence?: number, correctionExplanation = "") {
      const plan = await plans.detail(planId);
      const address = contract().toLowerCase();
      if (sequence === undefined) {
        const identity = await repository.identity(planId, address);
        return repository.preview(planId, plan.version, null, buildPlanManifest(plan, identity));
      }
      const state = await repository.state(planId), pub = state.publication;
      if (!pub || pub.operation.status !== "confirmed" || pub.results.some((r) => r.operation.status !== "confirmed")) throw new ApiError("PUBLICATION_NOT_ALLOWED", 409, "Wait for the preceding publication to be confirmed.");
      if (pub.manifest.contractAddress !== address) throw new ApiError("PREVIEW_CHANGED", 409, "The ledger configuration changed. Reload before continuing.");
      const revision = plan.revisions.find((r) => r.sequence === sequence), report = plan.reports.find((r) => r.id === revision?.reportId);
      if (!revision || !report) throw new ApiError("NOT_FOUND", 404, "This result was not found.");
      if (pub.results.length && !correctionExplanation.trim()) throw new ApiError("INVALID_INPUT", 422, "Provide the explanation you want to disclose with this public correction.");
      const previous = pub.results.at(-1);
      const manifest = buildResultManifest(plan, pub.manifest, report, revision, await repository.actualSnapshot(revision.actualSnapshotId), {
        nonce: createProofIdentity().nonce, publicRevision: pub.results.length + 1, previousResultHash: previous ? hashResult(previous.manifest) : ZERO_HASH, correctionExplanation,
      });
      return repository.preview(planId, plan.version, revision.id, manifest);
    },
    async consent(planId: string, input: { previewId: string; manifestHash: string; consentVersion: string }, key: string, digest: string, sequence: number | null = null) {
      await plans.detail(planId);
      const preview = await repository.reviewedPreview(planId, input.previewId);
      if (preview.manifestHash !== input.manifestHash || preview.manifest.contractAddress !== contract().toLowerCase()) throw new ApiError("PREVIEW_CHANGED", 409, "The preview or ledger context changed. Review again before consenting.");
      return repository.consent(planId, input, key, digest, sequence);
    },
    async state(planId: string) { await plans.detail(planId); return repository.state(planId); },
    async bundle(planId: string) {
      await plans.detail(planId); const state = await repository.state(planId), pub = state.publication;
      if (!pub) throw new ApiError("NOT_FOUND", 404, "No consented publication exists for this plan.");
      // Preserve every consented copy. Partial/uncertain delivery has no complete chain reference set.
      const results = pub.results;
      return proofBundleSchema.parse({ schemaVersion: 1, plan: pub.manifest, results: results.map((r) => r.manifest), method: METHOD_DESCRIPTOR,
        chainReferences: pub.operation.status === "confirmed" && pub.operation.transactionHash && results.every((r) => r.operation.status === "confirmed" && r.operation.transactionHash !== null) ? {
          chainId: pub.manifest.chainId, contractAddress: pub.manifest.contractAddress, planTransactionHash: pub.operation.transactionHash,
          resultTransactionHashes: results.map((r) => r.operation.transactionHash),
        } : null });
    },
  };
}
