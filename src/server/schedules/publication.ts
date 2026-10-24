import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireMember } from "@/server/auth/session";
import { createServiceClient, databaseConfiguration } from "@/server/db/clients";
import { ApiError, publicFailure } from "@/server/http/errors";
import { assertSameOrigin, readJson } from "@/server/http/request";
import { mutationIngress } from "@/server/limits/ingress";
import { canonicalJson, digest } from "@/server/limits/budgets";
import { getWebEnvironment } from "@/server/env";
import { databaseError } from "@/server/plans/repository";
import { createScheduleRepository } from "./repository";
import { createProofIdentity } from "@/server/proof/identity";
import { buildActivityPlan, buildActivityResult, newPublicNonce } from "@/server/proof/activity-builders";
import { canonicalV2, hashPlanV2, hashResultV2 } from "@/domain/proof/v2/canonical";
import { planV2Schema, resultV2Schema } from "@/domain/proof/v2/schemas";
import { verifyBundleV2 } from "@/domain/proof/v2/verifier";
import { METHOD_V2_DESCRIPTOR } from "@/domain/proof/v2/canonical";
import { parseDomain } from "@/domain/errors";
import { ZERO_HASH } from "@/domain/proof/schemas";
import { schedulePreviewSchema, scheduleConsentSchema, schedulePublicationStateSchema } from "@/contracts/schedule-publication";
import { publicationAckSchema } from "@/contracts/publication";
import { operationView } from "@/server/publication/repository";
import { loadPublicReceipt } from "@/server/publication/public-reader";
import { exportVersionedBundle } from "@/domain/proof/versions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/server/db/schema";
const utc = (text: string) => new Date(text).toISOString().replace(/\.\d{3}Z$/, "Z");
export async function schedulePublicationState(client: SupabaseClient<Database>, owner: string, id: string) {
  const response = await client.from("publications").select("id,receipt_id,manifest,manifest_hash").eq("owner_id", owner).eq("schedule_id", id).maybeSingle(); databaseError(response.error);
  if (!response.data) return schedulePublicationStateSchema.parse({ publication: null });
  const pub = response.data, [results, operations] = await Promise.all([client.from("published_results").select("id,manifest,manifest_hash").eq("publication_id", pub.id).order("public_sequence"), client.from("ledger_operations").select("*").eq("publication_id", pub.id)]); databaseError(results.error); databaseError(operations.error);
  const planOp = operations.data?.find((op) => op.kind === "plan"); if (!planOp) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The publication status is unavailable.");
  const state = schedulePublicationStateSchema.parse({ publication: { receiptId: pub.receipt_id, manifest: pub.manifest, manifestHash: pub.manifest_hash, operation: operationView(planOp), results: results.data?.map((r) => { const op = operations.data?.find((o) => o.result_id === r.id); if (!op) throw new ApiError("DATABASE_UNAVAILABLE", 503, "Result status is unavailable."); return { manifest: r.manifest, manifestHash: r.manifest_hash, operation: operationView(op) }; }) ?? [] } });
  if (hashPlanV2(state.publication!.manifest) !== pub.manifest_hash || state.publication!.results.some((r) => hashResultV2(r.manifest) !== r.manifestHash)) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The public copy could not be validated."); return state;
}
export async function schedulePublication(request: Request, id: string, action: "state" | "preview" | "consent" | "bundle") {
  const requestId = randomUUID(), headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  try {
    const config = databaseConfiguration(); if (request.method === "POST") assertSameOrigin(request, config.origin);
    const member = await requireMember(), writer = createServiceClient(); await mutationIngress(member.userId);
    if (!z.uuid().safeParse(id).success) throw new ApiError("NOT_FOUND", 404, "This schedule was not found.");
    const repository = createScheduleRepository(member.client, writer, member.userId), plan = await repository.detail(id);
    const state = await schedulePublicationState(member.client, member.userId, id);
    if (action === "state") return Response.json({ data: state, requestId }, { headers });
    if (action === "bundle") {
      if (!state.publication) throw new ApiError("NOT_FOUND", 404, "No consented receipt exists.");
      return new Response(exportVersionedBundle((await loadPublicReceipt(state.publication.receiptId)).bundle), { headers: { ...headers, "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="carbonshift-household-proof.json"' } });
    }
    const env = getWebEnvironment(); if (!env.ledger.enabled || !env.ledger.householdEnabled) throw new ApiError("PUBLICATION_UNAVAILABLE", 503, "Expanded receipts are not enabled yet. Your private schedule is saved.");
    if (action === "consent") {
      const input = parseDomain(scheduleConsentSchema, await readJson(request)), key = z.uuid().safeParse(request.headers.get("Idempotency-Key")); if (!key.success) throw new ApiError("INVALID_INPUT", 422, "Use a valid publication retry key.");
      const reviewed = await writer.from("schedule_publication_previews").select("manifest").eq("id", input.previewId).eq("schedule_id", id).eq("owner_id", member.userId).maybeSingle(); databaseError(reviewed.error);
      if (!reviewed.data || !(reviewed.data.manifest && typeof reviewed.data.manifest === "object" && "contractAddress" in reviewed.data.manifest) || reviewed.data.manifest.contractAddress !== env.ledger.contractAddress!.toLowerCase()) throw new ApiError("PREVIEW_CHANGED", 409, "Review a fresh preview before consenting.");
      const result = await writer.rpc("cs_schedule_publication_consent", { p_owner: member.userId, p_schedule: id, p_preview: input.previewId, p_hash: input.manifestHash, p_key: key.data, p_digest: digest(canonicalJson({ id, input })) }); databaseError(result.error);
      return Response.json({ data: publicationAckSchema.parse(result.data), requestId }, { headers });
    }
    const input = parseDomain(z.strictObject({ kind: z.enum(["plan", "result"]), correctionExplanation: z.string().trim().max(500).default("") }), await readJson(request));
    let manifest, vector: Json = null;
    if (input.kind === "plan") {
      const fresh = createProofIdentity(), identity = await writer.rpc("cs_schedule_receipt_identity", { p_owner: member.userId, p_schedule: id, p_receipt: fresh.receiptId, p_nonce: fresh.nonce, p_contract: env.ledger.contractAddress!.toLowerCase() }); databaseError(identity.error);
      const parsed = z.strictObject({ receiptId: planV2Schema.shape.receiptId, nonce: planV2Schema.shape.nonce, contractAddress: planV2Schema.shape.contractAddress }).parse(identity.data); manifest = buildActivityPlan(plan, parsed);
    } else {
      const pub = state.publication; if (!pub || pub.operation.status !== "confirmed" || pub.results.some((r) => r.operation.status !== "confirmed")) throw new ApiError("PUBLICATION_NOT_ALLOWED", 409, "Wait for the preceding publication to confirm.");
      if (pub.results.length && !input.correctionExplanation) throw new ApiError("INVALID_INPUT", 422, "Provide the explanation you want to disclose with this correction.");
      const history = await repository.history(id); vector = plan.comparison.input.tasks.map((t) => ({ taskId: t.activity.id, reportSequence: history.reports.filter((r) => r.taskId === t.activity.id).at(-1)?.sequence ?? 0, resultSequence: history.results.filter((r) => r.taskId === t.activity.id).at(-1)?.sequence ?? 0 }));
      manifest = buildActivityResult(plan, history, pub.manifest, { nonce: newPublicNonce(), publicRevision: pub.results.length + 1, previousResultHash: pub.results.at(-1)?.manifestHash ?? ZERO_HASH, correctionExplanation: input.correctionExplanation });
    }
    const pubPlan = manifest.type === "plan" ? manifest : state.publication!.manifest, pubResults = manifest.type === "result" ? [...state.publication!.results.map((r) => r.manifest), manifest] : [];
    const checked = verifyBundleV2({ schemaVersion: 2, plan: pubPlan, results: pubResults, method: METHOD_V2_DESCRIPTOR, chainReferences: null });
    if ([checked.checks.schema, checked.checks.method, checked.checks.calculation].some((c) => c.state !== "match") || checked.checks.resultHistory.state === "mismatch") throw new ApiError("INVALID_PROOF", 503, "This receipt could not be reproduced. Keep the private schedule and retry after review.");
    const hash = manifest.type === "plan" ? hashPlanV2(manifest) : hashResultV2(manifest);
    const response = await writer.rpc("cs_schedule_publication_preview", { p_owner: member.userId, p_schedule: id, p_text: canonicalV2(manifest), p_hash: hash, p_vector: vector }); databaseError(response.error);
    const row = z.object({ id: z.uuid(), manifest: z.union([planV2Schema, resultV2Schema]), manifest_hash: z.string(), expires_at: z.string(), consent_version: z.literal("public-proof-v2") }).parse(response.data);
    return Response.json({ data: schedulePreviewSchema.parse({ id: row.id, manifest: row.manifest, manifestHash: row.manifest_hash, expiresAtUtc: utc(row.expires_at), consentVersion: row.consent_version }), requestId }, { headers });
  } catch (e) { return publicFailure(e, requestId); }
}
