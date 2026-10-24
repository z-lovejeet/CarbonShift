import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/schema";
import { scheduleHistorySchema } from "@/contracts/schedule-lifecycle";
import { scheduleComparisonSchema, scheduleDocumentSchema, type ScheduleComparison } from "@/contracts/schedules";
import { hashGridSnapshot } from "@/server/grid/snapshot";
import { databaseError } from "@/server/plans/repository";
import { canonicalJson } from "@/server/limits/budgets";
import { ApiError } from "@/server/http/errors";
const rowSchema = z.object({ id: z.uuid(), owner_id: z.uuid(), accepted_at: z.string().datetime({ offset: true }), accepted_payload: scheduleComparisonSchema, option_index: z.number().int().min(0).max(3) });
const cursorSchema = z.strictObject({ time: z.string().datetime({ offset: true }), id: z.uuid() });
export function createScheduleRepository(reader: SupabaseClient<Database>, writer: SupabaseClient<Database>, owner: string) {
  function hydrate(value: unknown) {
    const row = rowSchema.parse(value);
    if (row.owner_id !== owner) throw new ApiError("NOT_FOUND", 404, "This schedule was not found.");
    if (hashGridSnapshot(row.accepted_payload.grid.snapshot) !== row.accepted_payload.grid.hash || row.option_index > row.accepted_payload.solution.alternatives.length) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The saved schedule could not be validated.");
    return scheduleDocumentSchema.parse({ schemaVersion: 2, id: row.id, acceptedAtUtc: new Date(row.accepted_at).toISOString().replace(/\.\d{3}Z$/, "Z"), comparison: row.accepted_payload, optionIndex: row.option_index });
  }
  async function statuses(ids: string[]) {
    if (!ids.length) return new Map<string, string>();
    const response = await reader.from("publications").select("schedule_id,ledger_operations(kind,status)").eq("owner_id", owner).in("schedule_id", ids); databaseError(response.error);
    const rows = z.array(z.object({ schedule_id: z.uuid(), ledger_operations: z.array(z.object({ kind: z.string(), status: z.string() })) })).parse(response.data);
    const values = new Map<string, string>();
    for (const row of rows) { const operation = row.ledger_operations.find((o) => o.kind === "plan"); if (!operation) throw new ApiError("DATABASE_UNAVAILABLE", 503, "Publication status could not be loaded."); values.set(row.schedule_id, operation.status); }
    return values;
  }
  async function detail(id: string) {
    const row = await reader.from("schedules").select("*").eq("id", z.uuid().parse(id)).eq("owner_id", owner).maybeSingle(); databaseError(row.error);
    if (!row.data) throw new ApiError("NOT_FOUND", 404, "This schedule was not found.");
    const tasks = await reader.from("schedule_tasks").select("task_id,payload").eq("schedule_id", id).eq("owner_id", owner); databaseError(tasks.error);
    const plan = hydrate(row.data);
    if (!tasks.data || tasks.data.length !== plan.comparison.input.tasks.length || tasks.data.some((t) => !plan.comparison.input.tasks.some((input) => input.activity.id === t.task_id && canonicalJson(input) === canonicalJson(z.object({ input: z.unknown() }).parse(t.payload).input)))) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The complete task set could not be validated.");
    const publication = await statuses([id]);
    return scheduleDocumentSchema.parse({ ...plan, publicationStatus: publication.get(id) ?? "private" });
  }
  return {
    detail,
    async history(id: string) {
      const response = await reader.rpc("cs_schedule_history", { p_schedule: id }); databaseError(response.error);
      if (!response.data) throw new ApiError("NOT_FOUND", 404, "This schedule was not found.");
      const history = scheduleHistorySchema.parse(response.data);
      for (const taskId of new Set(history.reports.map((r) => r.taskId))) {
        const reports = history.reports.filter((r) => r.taskId === taskId), results = history.results.filter((r) => r.taskId === taskId);
        if (reports.some((r, i) => r.scheduleId !== id || r.sequence !== i + 1 || r.previousReportId !== (reports[i - 1]?.id ?? null)) || results.some((r, i) => r.scheduleId !== id || r.sequence !== i + 1 || !reports.some((report) => report.id === r.reportId)) || results.at(-1)?.reportId !== reports.at(-1)?.id) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The task history could not be validated.");
      }
      return history;
    },
    async saveComparison(value: ScheduleComparison) {
      const payload = scheduleComparisonSchema.parse(value);
      if (hashGridSnapshot(payload.grid.snapshot) !== payload.grid.hash) throw new ApiError("INVALID_SNAPSHOT", 503, "The grid record could not be validated.");
      const profiles = payload.activities.flatMap((a) => a.reference ? [a.reference] : []);
      if (profiles.length) {
        const mirrored = await writer.from("activity_profile_versions").upsert(profiles.map((p) => ({ id: p.id, version: p.version, payload: p })), { onConflict: "id,version", ignoreDuplicates: true }); databaseError(mirrored.error);
        for (const profile of profiles) { const stored = await writer.from("activity_profile_versions").select("payload").eq("id", profile.id).eq("version", profile.version).single(); databaseError(stored.error); if (canonicalJson(stored.data?.payload) !== canonicalJson(profile)) throw new ApiError("INVALID_PROFILE", 503, "The reference profile version could not be validated."); }
      }
      const saved = await writer.rpc("cs_create_schedule_comparison", { p_owner: owner, p_payload: payload }); databaseError(saved.error);
      if (saved.data !== payload.id) throw new ApiError("DATABASE_UNAVAILABLE", 503, "The comparison could not be saved.");
    },
    async accept(comparisonId: string, optionIndex: number, key: string, digest: string) {
      const owned = await reader.from("schedule_comparisons").select("id").eq("id", comparisonId).eq("owner_id", owner).maybeSingle(); databaseError(owned.error);
      if (!owned.data) throw new ApiError("NOT_FOUND", 404, "This comparison was not found.");
      const saved = await writer.rpc("cs_accept_schedule", { p_owner: owner, p_comparison: comparisonId, p_option: optionIndex, p_key: key, p_digest: digest }); databaseError(saved.error);
      return detail(z.uuid().parse(saved.data));
    },
    async page(limit = 20, encoded?: string) {
      let query = reader.from("schedules").select("*").eq("owner_id", owner).order("accepted_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
      if (encoded) {
        let cursor: z.infer<typeof cursorSchema>;
        try { cursor = cursorSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))); } catch { throw new ApiError("INVALID_CURSOR", 422, "Use a valid page cursor."); }
        query = query.or(`accepted_at.lt.${cursor.time},and(accepted_at.eq.${cursor.time},id.lt.${cursor.id})`);
      }
      const result = await query; databaseError(result.error);
      const rows = result.data ?? [], last = rows[limit - 1], publication = await statuses(rows.slice(0, limit).map((row) => row.id));
      const items = rows.slice(0, limit).map((row) => scheduleDocumentSchema.parse({ ...hydrate(row), publicationStatus: publication.get(row.id) ?? "private" }));
      return { items, nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ time: last.accepted_at, id: last.id })).toString("base64url") : null };
    },
  };
}
