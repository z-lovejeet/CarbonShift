import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireMember } from "@/server/auth/session";
import { createServiceClient, databaseConfiguration } from "@/server/db/clients";
import { ApiError, publicFailure } from "@/server/http/errors";
import { assertSameOrigin, readJson } from "@/server/http/request";
import { mutationIngress } from "@/server/limits/ingress";
import { canonicalJson, digest, subject } from "@/server/limits/budgets";
import { getWebEnvironment } from "@/server/env";
import { candidates } from "@/config/ai-policy";
import { createScheduleRepository } from "./repository";
import { scheduleFacts, validateScheduleExplanation, scheduleSentences } from "@/server/ai/schedule-explanation";
import { inputFingerprint } from "@/server/ai/identity";
import { runAiTask } from "@/server/ai/router";
import { createAiStore } from "@/server/ai/store";
import { createProviderAdapters } from "@/server/ai/providers";
export async function explainSchedule(request: Request, id: string) {
  const requestId = randomUUID();
  try {
    const config = databaseConfiguration(); assertSameOrigin(request, config.origin);
    const member = await requireMember(), writer = createServiceClient(); await mutationIngress(member.userId);
    if (!z.uuid().safeParse(id).success) throw new ApiError("NOT_FOUND", 404, "This schedule was not found.");
    if (!z.strictObject({ aiConsent: z.literal(true) }).safeParse(await readJson(request)).success) throw new ApiError("INVALID_INPUT", 422, "Confirm consent before requesting assistance.");
    const key = z.uuid().safeParse(request.headers.get("AI-Task-Key")); if (!key.success) throw new ApiError("INVALID_INPUT", 422, "Use a valid assistance request key.");
    const plan = await createScheduleRepository(member.client, writer, member.userId).detail(id), facts = scheduleFacts(plan), env = getWebEnvironment();
    let selection = { schemaVersion: 2 as const, codes: facts.eligibleCodes }, source: "template" | "ai" | "cache" = "template";
    if (env.ai.enabled && candidates(env.ai.policy, "explanation", false, "schedule-explanation-v2").length) {
      const cacheKey = digest(canonicalJson({ id, option: plan.optionIndex, facts, variant: "schedule-explanation-v2", prompt: "schedule-explanation-v2.3", policy: env.ai.policy }));
      const cached = await member.client.from("schedule_explanation_cache").select("selection,expires_at").eq("owner_id", member.userId).eq("schedule_id", id).eq("cache_key", cacheKey).maybeSingle();
      if (cached.data && Date.parse(cached.data.expires_at) > Date.now()) {
        try { selection = validateScheduleExplanation(cached.data.selection, facts); source = "cache"; } catch { /* Ignore unvalidated cache entries. */ }
      }
      if (source === "cache") {
        const bound = await writer.rpc("cs_ai_cache_key", { p_owner: member.userId, p_actor: subject(config.hmac, "ai-actor", member.userId), p_key: key.data, p_fingerprint: inputFingerprint(config.hmac, "explanation", facts, { comparisonId: id, comparisonVersion: 1 }, "schedule-explanation-v2"), p_policy: digest(canonicalJson(env.ai.policy)) });
        if (bound.data && typeof bound.data === "object" && "code" in bound.data) throw new ApiError("AI_TASK_CONFLICT", 409, "This assistance key was already used. Start a deliberate new request.");
        if (bound.error) throw new ApiError("AI_UNAVAILABLE", 503, "Assistance is unavailable. The report remains available.");
      } else {
        try {
          selection = await runAiTask({ owner: member.userId, actor: member.userId, key: key.data, role: "explanation", variant: "schedule-explanation-v2", requestId, signal: request.signal, policy: env.ai.policy, input: facts, binding: { comparisonId: id, comparisonVersion: 1 }, validate: (raw) => validateScheduleExplanation(raw, facts) }, { hmac: config.hmac, store: createAiStore(writer), adapters: createProviderAdapters(env.ai) }); source = "ai";
          await writer.from("schedule_explanation_cache").upsert({ owner_id: member.userId, schedule_id: id, cache_key: cacheKey, selection, expires_at: new Date(Date.now() + 86400000).toISOString() });
        } catch (error) { if (error instanceof ApiError && error.status === 409) throw error; /* A complete deterministic explanation is always available. */ }
      }
    }
    return Response.json({ data: { schemaVersion: 2, codes: selection.codes, sentences: scheduleSentences(selection.codes), source }, requestId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return publicFailure(e, requestId); }
}
