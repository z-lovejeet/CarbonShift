import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/schema";
import { CONSENT_VERSION, operationSchema, publicationAckSchema, publicationPreviewSchema, publicationStateSchema } from "@/contracts/publication";
import { canonicalJson, hashPlan, hashResult, planManifestSchema, resultManifestSchema } from "@/domain/proof";
import { gridSnapshotSchema } from "@/domain/schemas";
import { databaseError } from "@/server/plans/repository";
import { createProofIdentity } from "@/server/proof/identity";
import { ApiError } from "@/server/http/errors";

const utc = (value: string) => new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z");
export function operationView(row: { id: string; kind: string; status: string; expected_hash: string; transaction_hash: string | null; block_number: number | null; checked_at: string | null; failure_code: string | null }) {
  return operationSchema.parse({ id: row.id, kind: row.kind, status: row.status, manifestHash: row.expected_hash, transactionHash: row.transaction_hash, blockNumber: row.block_number, checkedAtUtc: row.checked_at ? utc(row.checked_at) : null, failureCode: row.failure_code });
}
function previewView(value: unknown) {
  const row = z.object({ id: z.uuid(), manifest: z.union([planManifestSchema, resultManifestSchema]), manifest_hash: z.string(), expires_at: z.string(), consent_version: z.literal(CONSENT_VERSION) }).parse(value);
  const hash = row.manifest.type === "plan" ? hashPlan(row.manifest) : hashResult(row.manifest);
  if (hash !== row.manifest_hash) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The publication preview could not be validated.");
  return publicationPreviewSchema.parse({ id: row.id, manifest: row.manifest, manifestHash: hash, expiresAtUtc: utc(row.expires_at), consentVersion: row.consent_version });
}
export function createPublicationRepository(reader: SupabaseClient<Database>, writer: SupabaseClient<Database>, owner: string) {
  return {
    async identity(planId: string, contract: string) {
      const fresh = createProofIdentity();
      const result = await writer.rpc("cs_publication_identity", { p_owner: owner, p_plan: planId, p_receipt: fresh.receiptId, p_nonce: fresh.nonce, p_contract: contract });
      databaseError(result.error);
      return z.strictObject({ receiptId: planManifestSchema.shape.receiptId, nonce: planManifestSchema.shape.nonce, contractAddress: planManifestSchema.shape.contractAddress }).parse(result.data);
    },
    async preview(planId: string, version: number, resultId: string | null, manifest: unknown) {
      const parsed = resultId ? resultManifestSchema.parse(manifest) : planManifestSchema.parse(manifest);
      const result = await writer.rpc("cs_publication_preview", { p_owner: owner, p_plan: planId, p_version: version, p_result: resultId, p_manifest: canonicalJson(parsed), p_hash: resultId ? hashResult(parsed) : hashPlan(parsed) });
      databaseError(result.error); return previewView(result.data);
    },
    async reviewedPreview(planId: string, previewId: string) {
      const result = await writer.from("publication_previews").select("id,manifest,manifest_hash,expires_at,consent_version").eq("id", previewId).eq("plan_id", planId).eq("owner_id", owner).maybeSingle(); databaseError(result.error);
      if (!result.data) throw new ApiError("PREVIEW_CHANGED", 409, "Review a fresh publication preview before consenting.");
      return previewView(result.data);
    },
    async consent(planId: string, input: { previewId: string; manifestHash: string; consentVersion: string }, key: string, digest: string, sequence: number | null) {
      const result = await writer.rpc("cs_publication_consent", { p_owner: owner, p_plan: planId, p_preview: input.previewId, p_hash: input.manifestHash, p_consent: input.consentVersion, p_key: key, p_digest: digest, p_revision: sequence });
      databaseError(result.error); return publicationAckSchema.parse(result.data);
    },
    async actualSnapshot(id: string | null) {
      if (id === null) return null;
      const result = await reader.from("grid_snapshots").select("snapshot").eq("id", id).maybeSingle(); databaseError(result.error);
      if (!result.data) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The saved actual factors are unavailable.");
      return gridSnapshotSchema.parse(result.data.snapshot);
    },
    async state(planId: string) {
      const response = await reader.from("publications").select("id,receipt_id,manifest,manifest_hash").eq("plan_id", planId).eq("owner_id", owner).maybeSingle(); databaseError(response.error);
      const pub = response.data; if (!pub) return publicationStateSchema.parse({ publication: null });
      const [results, operations] = await Promise.all([
        reader.from("published_results").select("id,manifest,manifest_hash,public_sequence").eq("publication_id", pub.id).order("public_sequence"),
        reader.from("ledger_operations").select("id,kind,status,expected_hash,transaction_hash,block_number,checked_at,failure_code,result_id").eq("publication_id", pub.id),
      ]);
      databaseError(results.error); databaseError(operations.error);
      const planOp = operations.data?.find((op) => op.kind === "plan");
      if (!planOp) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The publication status is unavailable.");
      const state = publicationStateSchema.parse({ publication: { receiptId: pub.receipt_id, manifestHash: pub.manifest_hash, manifest: pub.manifest, operation: operationView(planOp),
        results: (results.data ?? []).map((r) => {
          const op = operations.data?.find((op) => op.result_id === r.id); if (!op) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The result publication status is unavailable.");
          return { manifest: r.manifest, manifestHash: r.manifest_hash, operation: operationView(op) };
        }) } });
      if (hashPlan(state.publication!.manifest) !== state.publication!.manifestHash || state.publication!.results.some((r) => hashResult(r.manifest) !== r.manifestHash)) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The public copy could not be validated.");
      return state;
    },
    async operation(id: string) {
      const response = await reader.from("ledger_operations").select("id,publication_id,kind,status,expected_hash,transaction_hash,block_number,checked_at,failure_code").eq("id", id).maybeSingle(); databaseError(response.error);
      if (!response.data) throw new ApiError("NOT_FOUND", 404, "This operation was not found.");
      const owned = await reader.from("publications").select("id").eq("id", response.data.publication_id).eq("owner_id", owner).maybeSingle(); databaseError(owned.error);
      if (!owned.data) throw new ApiError("NOT_FOUND", 404, "This operation was not found.");
      return operationView(response.data);
    },
  };
}
export type PublicationRepository = ReturnType<typeof createPublicationRepository>;
