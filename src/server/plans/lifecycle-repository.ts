import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/database.types";
import { lifecycleAckSchema, type ReportDocument, type ResultRevision } from "@/contracts/lifecycle";
import type { GridSnapshotRecord } from "@/server/grid/snapshot";
import { databaseError, type PlanRepository } from "./repository";

export type LifecycleAction = "report" | "cancel" | "refresh" | "delete";
export type LifecycleWrite = { planId: string; action: LifecycleAction; key: string; digest: string; expectedVersion: number;
  report: ReportDocument | null; revision: ResultRevision | null; semantic: string | null; snapshot: GridSnapshotRecord | null };
export function createLifecycleRepository(plans: Pick<PlanRepository, "detail">, writer: SupabaseClient<Database>, userId: string) {
  return {
    detail: plans.detail,
    async replay(planId: string, action: LifecycleAction, key: string, digest: string) {
      const result = await writer.rpc("cs_lifecycle_replay", { p_owner: userId, p_plan: planId, p_action: action, p_key: key, p_digest: digest });
      databaseError(result.error);
      return result.data === null ? null : lifecycleAckSchema.parse(result.data);
    },
    async commit(value: LifecycleWrite) {
      const result = await writer.rpc("cs_lifecycle_commit", { p_owner: userId, p_plan: value.planId, p_action: value.action, p_key: value.key, p_digest: value.digest,
        p_expected_version: value.expectedVersion, p_report: value.report, p_result: value.revision, p_semantic: value.semantic ?? "",
        p_snapshot_text: value.snapshot ? JSON.stringify(value.snapshot.snapshot) : "", p_snapshot_hash: value.snapshot?.hash ?? "" });
      databaseError(result.error);
      return lifecycleAckSchema.parse(result.data);
    },
  };
}
export type LifecycleRepository = ReturnType<typeof createLifecycleRepository>;
