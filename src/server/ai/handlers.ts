import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { constraintsRequestSchema, explanationRequestSchema, type ExplanationSelection } from "@/contracts/ai";
import { londonTime } from "@/domain/time";
import type { AiPolicy } from "@/config/ai-policy";
import type { ComparisonView } from "@/contracts/planning";
import { ApiError, publicFailure } from "@/server/http/errors";
import { assertSameOrigin, readJson } from "@/server/http/request";
import { canonicalJson, digest } from "@/server/limits/budgets";
import { explanationFacts, explanationSentences, templateSelection, validateExplanation, validateSuggestion } from "./validation";
import { runAiTask } from "./router";
import { PROMPT_VERSION } from "./prompts";
import type { AiBinding } from "./identity";

type Cache = { read: (id: string, key: string) => Promise<unknown | null>; write: (id: string, key: string, value: ExplanationSelection) => Promise<void>;
  bindKey: (key: string, input: unknown, binding: AiBinding, policy: AiPolicy) => Promise<void> };
type Runtime = { policy: AiPolicy; dependencies: Parameters<typeof runAiTask>[1] };
type Dependencies = {
  authenticate: () => Promise<{ userId: string; comparison: (id: string) => Promise<ComparisonView>; cache: Cache }>;
  origin: () => string; ingress: (userId: string) => Promise<void>; now: () => string; runtime: () => Runtime | null;
};
export function createAiHandlers(dependencies: Dependencies) {
  async function execute(request: Request, action: (member: Awaited<ReturnType<Dependencies["authenticate"]>>, requestId: string) => Promise<unknown>) {
    const requestId = randomUUID();
    try {
      assertSameOrigin(request, dependencies.origin());
      const member = await dependencies.authenticate(); await dependencies.ingress(member.userId);
      const data = await action(member, requestId);
      return Response.json({ data, requestId }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
    } catch (error) { return publicFailure(error, requestId); }
  }
  function key(request: Request) {
    const result = z.uuid().safeParse(request.headers.get("AI-Task-Key"));
    if (!result.success) throw new ApiError("INVALID_AI_TASK_KEY", 422, "Start this AI action with a valid request key.");
    return result.data;
  }
  function body<T>(schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value); if (!parsed.success) throw new ApiError("INVALID_INPUT", 422, "Check the AI request and consent. Your manual fields are kept here."); return parsed.data;
  }
  return {
    constraints: (request: Request) => execute(request, async (member, requestId) => {
      const input = body(constraintsRequestSchema, await readJson(request)), taskKey = key(request);
      const referenceDate = londonTime(dependencies.now()).date;
      if (input.localReferenceDate !== referenceDate) throw new ApiError("AI_REFERENCE_DATE_CHANGED", 409, "The London reference date changed. Review the text and start a new request.");
      const runtime = dependencies.runtime();
      if (!runtime) throw new ApiError("AI_UNAVAILABLE", 503, "AI is unavailable. Continue with the manual fields.");
      return runAiTask({ owner: member.userId, actor: member.userId, role: "constraints", key: taskKey, requestId, signal: request.signal, policy: runtime.policy,
        input: { text: input.text, referenceDate, timezone: input.timezone }, validate: (value) => validateSuggestion(value, input.text) }, runtime.dependencies);
    }),
    explanation: (request: Request, id: string) => execute(request, async (member, requestId) => {
      body(explanationRequestSchema, await readJson(request)); const taskKey = key(request);
      if (!z.uuid().safeParse(id).success) throw new ApiError("NOT_FOUND", 404, "This comparison was not found.");
      const { comparison } = await member.comparison(id), facts = explanationFacts(comparison), runtime = dependencies.runtime();
      const fallback = templateSelection(facts);
      if (!runtime) return { selection: fallback, sentences: explanationSentences(fallback, comparison), source: "template" };
      const cacheKey = digest(canonicalJson({ comparison: id, version: comparison.version, prompt: PROMPT_VERSION.explanation, schema: 1, policy: runtime.policy }));
      const cached = await member.cache.read(id, cacheKey);
      const binding = { comparisonId: id, comparisonVersion: comparison.version };
      if (cached) {
        let selection: ExplanationSelection | null = null;
        try { selection = validateExplanation(cached, facts); }
        catch { /* Invalid cache data must be grounded again or ignored. */ }
        if (selection) {
          await member.cache.bindKey(taskKey, facts, binding, runtime.policy);
          return { selection, sentences: explanationSentences(selection, comparison), source: "cache" };
        }
      }
      const selection = await runAiTask({ owner: member.userId, actor: member.userId, role: "explanation", key: taskKey, requestId, signal: request.signal, policy: runtime.policy, input: facts, binding,
        validate: (value) => validateExplanation(value, facts) }, runtime.dependencies);
      // A failed cache write must not invalidate a checked answer or cause another call.
      await member.cache.write(id, cacheKey, selection).catch(() => {});
      return { selection, sentences: explanationSentences(selection, comparison), source: "ai" };
    }),
  };
}
