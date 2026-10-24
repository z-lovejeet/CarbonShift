import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/server/db/schema";
import { ApiError } from "@/server/http/errors";
import type { Budget } from "@/server/limits/budgets";
import type { AiProvider, AiRole, ModelId } from "@/config/ai-registry";
import type { ExplanationSelection } from "@/contracts/ai";
import { inputFingerprint, type AiBinding } from "./identity";
import type { AiPolicy } from "@/config/ai-policy";
import { canonicalJson, digest, subject } from "@/server/limits/budgets";

export type Usage = { input_tokens?: number; output_tokens?: number; total_tokens?: number };
export type Outcome = "succeeded" | "transient" | "rate_limited" | "invalid" | "refused" | "configuration" | "unknown";
export interface AiStore {
  begin(input: { owner: string | null; actor: string; role: AiRole; key: string; fingerprint: string; policyDigest: string; seconds: number; budgets: Budget[] }): Promise<{ id: string; deadline: string }>;
  reserve(input: { task: string; provider: AiProvider; model: ModelId; requestId: string; prompt: string; budgets: Budget[]; scopes: string[] }): Promise<{ id: string; attempt: number }>;
  finishAttempt(id: string, outcome: Outcome, latency: number, usage: Usage, scopes: string[], retryAfter?: number): Promise<void>;
  finishTask(id: string, success: boolean): Promise<void>;
}
const failure = () => new ApiError("AI_UNAVAILABLE", 503, "AI is unavailable. Your manual fields are ready to use.", true);
const resultShape = z.object({ code: z.string().optional(), id: z.uuid().optional(), deadline: z.string().datetime({ offset: true }).optional(), attempt: z.number().int().optional(), retryAfter: z.number().int().min(1).max(172800).optional() });
function result(data: unknown) {
  const parsed = resultShape.safeParse(data);
  if (!parsed.success) throw failure();
  const value = parsed.data;
  if (value.code === "AI_RATE_LIMITED") throw new ApiError(value.code, 429, "AI is busy or its allowance is used. Continue with the manual fields.", true, value.retryAfter ?? 60);
  if (["AI_TASK_CONFLICT", "AI_TASK_IN_PROGRESS", "AI_TASK_FINISHED"].includes(value.code ?? "")) throw new ApiError(value.code!, 409, value.code === "AI_TASK_CONFLICT" ? "This AI request key was used for different input." : "This request has already started or finished. Use the manual fields, or deliberately start a new request.");
  if (!value.id) throw failure();
  return value;
}
export function createAiStore(client: SupabaseClient<Database>): AiStore {
  return {
    async begin(input) {
      const r = await client.rpc("cs_ai_begin_task", { p_owner: input.owner!, p_actor: input.actor, p_role: input.role, p_key: input.key, p_fingerprint: input.fingerprint,
        p_policy: input.policyDigest, p_seconds: input.seconds, p_buckets: input.budgets as unknown as Json });
      if (r.error) throw failure(); const value = result(r.data); if (!value.deadline) throw failure(); return { id: value.id!, deadline: value.deadline };
    },
    async reserve(input) {
      const r = await client.rpc("cs_ai_reserve_attempt", { p_task: input.task, p_provider: input.provider, p_model: input.model, p_request: input.requestId, p_prompt: input.prompt,
        p_buckets: input.budgets as unknown as Json, p_scopes: input.scopes });
      if (r.error) throw failure(); const value = result(r.data); if (!value.attempt) throw failure(); return { id: value.id!, attempt: value.attempt };
    },
    async finishAttempt(id, outcome, latency, usage, scopes, retryAfter = 60) {
      const r = await client.rpc("cs_ai_finish_attempt", { p_run: id, p_outcome: outcome, p_latency: latency, p_usage: usage, p_scopes: scopes, p_retry: retryAfter }); if (r.error) throw failure();
    },
    async finishTask(id, success) { const r = await client.rpc("cs_ai_finish_task", { p_task: id, p_success: success }); if (r.error) throw failure(); },
  };
}
export function createExplanationCache(client: SupabaseClient<Database>, owner: string, hmac: string) {
  return {
    async bindKey(key: string, input: unknown, binding: AiBinding, policy: AiPolicy) {
      const r = await client.rpc("cs_ai_cache_key", { p_owner: owner, p_actor: subject(hmac, "ai-actor", owner), p_key: key,
        p_fingerprint: inputFingerprint(hmac, "explanation", input, binding), p_policy: digest(canonicalJson(policy)) });
      if (r.error) throw failure(); result(r.data);
    },
    async read(comparisonId: string, key: string): Promise<unknown | null> {
      const r = await client.from("ai_explanation_cache").select("selection,expires_at").eq("owner_id", owner).eq("comparison_id", comparisonId).eq("cache_key", key).maybeSingle();
      if (r.error || !r.data || Date.parse(r.data.expires_at) <= Date.now()) return null;
      return r.data.selection;
    },
    async write(comparisonId: string, key: string, selection: ExplanationSelection) {
      const created = new Date(), expires = new Date(created.getTime() + 86400000);
      const r = await client.from("ai_explanation_cache").upsert({ owner_id: owner, comparison_id: comparisonId, cache_key: key, selection, created_at: created.toISOString(), expires_at: expires.toISOString() });
      if (r.error) throw failure();
    },
  };
}
