import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/database.types";
import { comparisonSchema, gridSnapshotSchema } from "@/domain/schemas";
import type { GridSnapshotRecord } from "@/server/grid/snapshot";
import { hashGridSnapshot } from "@/server/grid/snapshot";
import { ApiError } from "@/server/http/errors";
import { planSchema, cursorSchema, comparisonViewSchema } from "./contracts";
import { reportDocumentSchema, resultRevisionSchema } from "@/contracts/lifecycle";

export function databaseError(error: { message: string } | null) {
  if (!error) return;
  const failures: Record<string, [number, string]> = {
    PLAN_CANCELLED: [409, "This plan is cancelled. Create a new plan to run again."], INVALID_REPORT: [422, "Check the reported time and current plan state."],
    NOT_FOUND: [404, "This plan or comparison was not found."], COMPARISON_EXPIRED: [409, "Refresh and review the comparison before saving."],
    VERSION_CONFLICT: [409, "This comparison changed. Refresh and review it again."], IDEMPOTENCY_CONFLICT: [409, "This retry key was already used for a different request."],
  };
  const known = failures[error.message];
  if (known) throw new ApiError(error.message, known[0], known[1]);
  throw new ApiError("DATABASE_UNAVAILABLE", 503, "Your changes could not be confirmed. Retry using the same request key.", true);
}
const storedPlanSchema = z.object({ id: z.uuid(), owner_id: z.uuid(), comparison_id: z.uuid(), mode: z.literal("live"), status: z.enum(["accepted", "cancelled"]), version: z.number().int().positive(), accepted_at: z.string().datetime({ offset: true }), accepted_payload: comparisonSchema });
const canonicalUtc = (value: string) => new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z");

export function createPlanRepository(reader: SupabaseClient<Database>, writer: SupabaseClient<Database>, userId: string) {
  z.uuid().parse(userId);
  async function savedSnapshot(id: string, hash: string) {
    const snapshot = await reader.from("grid_snapshots").select("snapshot,digest").eq("id", id).maybeSingle();
    databaseError(snapshot.error);
    if (!snapshot.data) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The saved forecast is unavailable.", true);
    const normalized = gridSnapshotSchema.parse(snapshot.data.snapshot);
    if (snapshot.data.digest !== hash || hashGridSnapshot(normalized) !== snapshot.data.digest) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The saved forecast could not be validated.", true);
    return normalized;
  }
  async function hydrate(id: string) {
    const response = await reader.rpc("cs_read_private_plan", { p_plan: id });
    databaseError(response.error);
    if (!response.data) throw new ApiError("NOT_FOUND", 404, "This plan was not found.");
    const stored = z.object({ plan: storedPlanSchema, forecastSnapshot: gridSnapshotSchema, forecastHash: z.string(), reports: z.array(reportDocumentSchema), revisions: z.array(resultRevisionSchema) }).parse(response.data);
    const { plan: row, reports, revisions } = stored;
    if (row.owner_id !== userId || row.id !== id) throw new ApiError("NOT_FOUND", 404, "This plan was not found.");
    if (stored.forecastHash !== row.accepted_payload.forecastSnapshotHash || hashGridSnapshot(stored.forecastSnapshot) !== stored.forecastHash) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The saved forecast could not be validated.");
    if (reports.some((report, index) => report.planId !== row.id || report.sequence !== index + 1 || report.correctsReportId !== (reports[index - 1]?.id ?? null)) || revisions.some((revision, index) => revision.planId !== row.id || revision.sequence !== index + 1 || !reports.some((report) => report.id === revision.reportId))) throw new ApiError("DATABASE_UNAVAILABLE", 503, "Your history could not be validated.");
    const latestReport = reports.at(-1) ?? null, latestResult = revisions.at(-1) ?? null;
    if ((latestReport === null) !== (latestResult === null) || latestResult && latestResult.reportId !== latestReport?.id) throw new ApiError("DATABASE_UNAVAILABLE", 503, "Your history could not be validated.");
    return planSchema.parse({ schemaVersion: 1, id: row.id, version: row.version, comparisonId: row.comparison_id, mode: row.mode, status: row.status,
      acceptedAtUtc: canonicalUtc(row.accepted_at), comparison: row.accepted_payload, forecastSnapshot: stored.forecastSnapshot,
      completion: latestReport?.kind ?? "not_reported", publication: "private", latestReport, latestResult, reports, revisions });
  }
  return {
    async comparison(id: string) {
      const result = await reader.from("comparisons").select("id,owner_id,version,payload").eq("id", id).eq("owner_id", userId).maybeSingle();
      databaseError(result.error);
      if (!result.data || result.data.owner_id !== userId) throw new ApiError("NOT_FOUND", 404, "This comparison was not found.");
      const payload = comparisonSchema.parse(result.data.payload);
      const forecastSnapshot = await savedSnapshot(payload.forecastSnapshotId, payload.forecastSnapshotHash);
      return comparisonViewSchema.parse({ comparison: { ...payload, schemaVersion: 1, id: result.data.id, version: result.data.version }, forecastSnapshot });
    },
    async reserveComparisonQuota(subject: string) {
      const result = await writer.rpc("cs_comparison_quota", { p_subject: subject });
      databaseError(result.error);
      if (result.data !== true) throw new ApiError("RATE_LIMITED", 429, "You have compared several times recently. Try again in a minute.", true);
    },
    async saveComparison(id: string, record: GridSnapshotRecord, input: unknown) {
      const comparison = comparisonSchema.parse(input);
      if (hashGridSnapshot(record.snapshot) !== record.hash || record.id !== comparison.forecastSnapshotId || record.hash !== comparison.forecastSnapshotHash) throw new ApiError("INVALID_SNAPSHOT", 503, "The forecast could not be validated.");
      const result = await writer.rpc("cs_create_comparison", { p_owner: userId, p_id: id, p_snapshot_id: record.id, p_snapshot_text: JSON.stringify(record.snapshot), p_snapshot_hash: record.hash, p_payload: comparison });
      databaseError(result.error);
      if (result.data !== id) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The comparison could not be saved.", true);
    },
    async accept(comparisonId: string, version: number, key: string, digest: string) {
      // Owner lookup on the user-scoped client precedes the elevated transaction.
      const owned = await reader.from("comparisons").select("id").eq("id", comparisonId).eq("owner_id", userId).maybeSingle();
      databaseError(owned.error);
      if (!owned.data) throw new ApiError("NOT_FOUND", 404, "This comparison was not found.");
      const result = await writer.rpc("cs_accept_plan", { p_owner: userId, p_comparison: comparisonId, p_version: version, p_key: key, p_request_digest: digest });
      databaseError(result.error);
      return hydrate(z.object({ id: z.uuid() }).parse(result.data).id);
    },
    detail: hydrate,
    async page(limit: number, encodedCursor?: string) {
      let cursor: { acceptedAtUtc: string; id: string } | undefined;
      if (encodedCursor) {
        let decoded: unknown;
        try { decoded = JSON.parse(Buffer.from(encodedCursor, "base64url").toString("utf8")); } catch { throw new ApiError("INVALID_CURSOR", 422, "Use a valid page cursor."); }
        const parsed = cursorSchema.safeParse(decoded);
        if (!parsed.success) throw new ApiError("INVALID_CURSOR", 422, "Use a valid page cursor.");
        cursor = parsed.data;
      }
      const result = await reader.rpc("cs_read_private_plan_page", { p_limit: limit, ...(cursor ? { p_before_time: cursor.acceptedAtUtc, p_before_id: cursor.id } : {}) });
      databaseError(result.error);
      if (!Array.isArray(result.data)) throw new ApiError("DATABASE_UNAVAILABLE", 503, "Your plans could not be loaded.", true);
      const rows = result.data.slice(0, limit).map((input) => storedPlanSchema.extend({ completion: z.enum(["not_reported", "ran", "did_not_run"]) }).parse(input));
      if (rows.some((row) => row.owner_id !== userId)) throw new ApiError("DATABASE_UNAVAILABLE", 503, "Your plans could not be validated.");
      const items = rows.map((row) => ({ schemaVersion: 1 as const, id: row.id, version: row.version, comparisonId: row.comparison_id, mode: row.mode, status: row.status,
        acceptedAtUtc: canonicalUtc(row.accepted_at), baseline: row.accepted_payload.baseline, selected: row.accepted_payload.selected, differenceMg: row.accepted_payload.differenceMg, completion: row.completion, publication: "private" as const }));
      const last = items.at(-1);
      return { items, nextCursor: result.data.length > limit && last ? Buffer.from(JSON.stringify({ acceptedAtUtc: last.acceptedAtUtc, id: last.id })).toString("base64url") : null };
    },
  };
}
export type PlanRepository = ReturnType<typeof createPlanRepository>;
