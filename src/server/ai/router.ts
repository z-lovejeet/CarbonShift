import "server-only";
import { randomUUID } from "node:crypto";
import { candidates, type AiPolicy } from "@/config/ai-policy";
import { AI_REGISTRY, type AiProvider, type AiRole, type ModelId } from "@/config/ai-registry";
import { ApiError } from "@/server/http/errors";
import { canonicalJson, digest, memberBudgets, providerBudgets, subject, tokenReservation } from "@/server/limits/budgets";
import { PROMPT_VERSION, responseSchema, SYSTEM_PROMPTS } from "./prompts";
import { ProviderFailure, type ProviderAdapter } from "./providers";
import type { AiStore, Usage } from "./store";
import { inputFingerprint, type AiBinding } from "./identity";

type Dependencies = { store: AiStore; adapters: Record<AiProvider, ProviderAdapter>; hmac: string; now?: () => number };
type TaskInput<T> = { owner: string | null; actor: string; key: string; role: AiRole; policy: AiPolicy; input: unknown; binding?: AiBinding; validate: (value: unknown) => T; evaluation?: boolean; model?: ModelId; requestId?: string; signal?: AbortSignal };
export async function runAiTask<T>(task: TaskInput<T>, dependencies: Dependencies): Promise<T> {
  const now = dependencies.now ?? Date.now;
  const iso = () => new Date(now()).toISOString();
  const policy = structuredClone(task.policy);
  const policyDigest = digest(canonicalJson(policy));
  const actor = subject(dependencies.hmac, "ai-actor", task.actor);
  const role = task.role;
  const input = canonicalJson(role === "constraints" && task.input && typeof task.input === "object" && "text" in task.input && typeof task.input.text === "string"
    ? { ...task.input, textUtf16Length: task.input.text.length } : task.input);
  const models = candidates(policy, role, task.evaluation).filter((m) => !task.model || m.id === task.model);
  if (!models.length) throw new ApiError("AI_UNAVAILABLE", 503, "AI is unavailable. Continue with the manual fields.");
  const seconds = role === "constraints" ? 22 : 12, primaryMs = role === "constraints" ? 12000 : 6000;
  const begun = await dependencies.store.begin({ owner: task.owner, actor, key: task.key, role,
    fingerprint: inputFingerprint(dependencies.hmac, role, task.input, task.binding),
    policyDigest, seconds, budgets: task.evaluation ? [] : memberBudgets(actor, iso()) });
  const deadline = Math.min(Date.parse(begun.deadline), now() + seconds * 1000);
  const schema = responseSchema(role), outputCap = role === "constraints" ? 2048 : 1024;
  const tokens = tokenReservation(SYSTEM_PROMPTS[role] + input, JSON.stringify(schema), outputCap);
  let attempts = 0, lastProvider: AiProvider | null = null, minRetry = Infinity;
  const remaining = [...models];
  try {
    while (remaining.length && attempts < (task.evaluation ? 1 : 2) && now() < deadline - 100 && !task.signal?.aborted) {
      // After an actual Gemini failure, prefer the other provider over sibling models.
      const index: number = lastProvider === "gemini" ? Math.max(0, remaining.findIndex((m) => AI_REGISTRY[m.id].provider === "groq")) : 0;
      const model: AiPolicy["models"][number] = remaining.splice(index, 1)[0]!;
      const provider: AiProvider = AI_REGISTRY[model.id].provider;
      const scopes = [digest(`ai-circuit:provider:${provider}`), digest(`ai-circuit:model:${model.id}`)];
      let reservation: { id: string; attempt: number };
      try { reservation = await dependencies.store.reserve({ task: begun.id, provider, model: model.id, requestId: task.requestId ?? randomUUID(), prompt: PROMPT_VERSION[role], scopes,
        budgets: providerBudgets(policy, model, tokens, iso()) }); }
      catch (error) { if (error instanceof ApiError && error.code === "AI_RATE_LIMITED") { minRetry = Math.min(minRetry, error.retryAfterSeconds ?? 60); continue; } throw error; }
      attempts++; lastProvider = provider;
      if (now() >= deadline - 100 || task.signal?.aborted) {
        await dependencies.store.finishAttempt(reservation.id, "unknown", 0, {}, scopes);
        break;
      }
      const started = now(), controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
      let cancel: (() => void) | undefined;
      let usage: Usage = {};
      try {
        const response = await Promise.race([
          dependencies.adapters[provider]({ role, model: model.id, system: SYSTEM_PROMPTS[role], input, schema, outputCap, signal: controller.signal }),
          new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ProviderFailure("transient")); }, Math.max(1, Math.min(attempts === 1 ? primaryMs : deadline - now(), deadline - now()))); }),
          new Promise<never>((_, reject) => { cancel = () => { controller.abort(); reject(new ProviderFailure("unknown")); }; task.signal?.addEventListener("abort", cancel, { once: true }); if (task.signal?.aborted) cancel(); }),
        ]);
        usage = response.usage;
        let value: T;
        try { value = task.validate(response.value); } catch { throw new ProviderFailure("invalid", 60, usage); }
        await dependencies.store.finishAttempt(reservation.id, "succeeded", Math.max(0, Math.round(now() - started)), usage, scopes);
        await dependencies.store.finishTask(begun.id, true);
        return value;
      } catch (error) {
        const failure = error instanceof ProviderFailure ? error : new ProviderFailure("unknown");
        await dependencies.store.finishAttempt(reservation.id, failure.outcome, Math.max(0, Math.round(now() - started)), failure.usage.total_tokens === undefined ? usage : failure.usage, scopes, failure.retryAfter);
        if (["configuration", "refused", "unknown"].includes(failure.outcome)) break;
      } finally { if (timer) clearTimeout(timer); if (cancel) task.signal?.removeEventListener("abort", cancel); controller.abort(); }
    }
    if (attempts === 0 && Number.isFinite(minRetry)) throw new ApiError("AI_RATE_LIMITED", 429, "AI has reached its available allowance. Continue with the manual fields.", true, minRetry);
    throw new ApiError("AI_UNAVAILABLE", 503, "AI could not provide a checked answer. Continue with the manual fields.", true);
  } finally {
    // No raw input or model result is persisted, including for duplicate-key recovery.
    await dependencies.store.finishTask(begun.id, false);
  }
}
