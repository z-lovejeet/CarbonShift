import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../src/server/db/database.types";
import { AI_MODEL_IDS } from "../src/config/ai-registry";
import { suggestionShape } from "../src/contracts/ai";
import { evaluationConfiguration } from "../src/server/ai/evaluation";
import { createProviderAdapters } from "../src/server/ai/providers";
import { createAiStore } from "../src/server/ai/store";
import { runAiTask } from "../src/server/ai/router";
import { validateExplanation, validateSuggestion, type ExplanationFacts } from "../src/server/ai/validation";
import { subject } from "../src/server/limits/budgets";
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--model" || args[2] !== "--role") throw new Error("Use --model exact-model-id --role constraints|explanation. One request maximum.");
const model = z.enum(AI_MODEL_IDS).parse(args[1]), role = z.enum(["constraints", "explanation"]).parse(args[3]);
try {
  const config = evaluationConfiguration({ ...parse(await readFile(".env.local", "utf8")), ...process.env }, model, role);
  const client = createClient<Database>(config.databaseUrl, config.databaseSecret, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(8000) }) } });
  const limits: Record<string, string> = {};
  const transportChecks: { status: number | null; networkFailure: boolean }[] = [];
  const observingFetch: typeof fetch = async (url, init) => {
    let response: Response;
    try { response = await fetch(url, init); }
    catch (error) { transportChecks.push({ status: null, networkFailure: true }); throw error; }
    transportChecks.push({ status: response.status, networkFailure: false });
    for (const name of ["x-ratelimit-limit-requests", "x-ratelimit-limit-tokens", "x-ratelimit-remaining-requests", "x-ratelimit-remaining-tokens", "x-ratelimit-reset-requests", "x-ratelimit-reset-tokens"]) {
      const value = response.headers.get(name); if (value && /^[0-9a-z. -]{1,80}$/i.test(value)) limits[name] = value;
    }
    return response;
  };
  const adapters = createProviderAdapters(config, observingFetch);
  const facts: ExplanationFacts = { classification: "lower_forecast", deadlineMet: true, blocksAvoided: false, energyBasis: "user_estimate", geography: "GB_national",
    eligibleReasonCodes: ["LOWER_FORECAST_ESTIMATE", "DEADLINE_MET"], eligibleLimitationCodes: ["ASSUMED_ENERGY", "NATIONAL_SIGNAL", "SELF_REPORTED"], requiredLimitationCodes: ["ASSUMED_ENERGY", "NATIONAL_SIGNAL"] };
  const text = "The washing cycle lasts 60 minutes. On 2026-10-24 it may start at 08:00 and must finish by 12:00.";
  let validationChecks: { schemaValid: boolean; spanBoundsValid: boolean | null; populatedFieldsSupported: boolean | null } | null = null;
  const key = randomUUID(), actor = "operator-smoke", began = performance.now(); let success = false, errorCode: string | null = null;
  try {
    await runAiTask({ owner: null, actor, key, role, model, policy: config.policy, evaluation: true,
      input: role === "explanation" ? facts : { text, referenceDate: "2026-10-23", timezone: "Europe/London" },
      validate: (v) => {
        if (role === "explanation") return validateExplanation(v, facts);
        const parsed = suggestionShape.safeParse(v);
        validationChecks = { schemaValid: parsed.success, spanBoundsValid: parsed.success ? parsed.data.sourceSpans.every((s) => s.start < s.end && s.end <= text.length && /[\p{L}\p{N}]/u.test(text.slice(s.start, s.end))) : null,
          populatedFieldsSupported: parsed.success ? ["earliestLocal", "deadlineLocal", "baselineLocal", "durationMinutes", "blockedLocal"].every((field) => {
            const value = Reflect.get(parsed.data, field); const populated = value !== null && (Array.isArray(value) ? value.length > 0 : typeof value === "object" ? Object.values(value).some(Boolean) : true);
            return !populated || parsed.data.sourceSpans.some((s) => s.field === field);
          }) : null };
        return validateSuggestion(v, text);
      } }, { hmac: config.hmac, store: createAiStore(client), adapters });
    success = true;
  } catch (error) { errorCode = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "AI_UNAVAILABLE"; }
  const task = await client.from("ai_tasks").select("id").eq("actor_hash", subject(config.hmac, "ai-actor", actor)).eq("role", role).eq("client_key", key).maybeSingle();
  const runs = task.data ? await client.from("ai_runs").select("provider,model,state,latency_ms,input_tokens,output_tokens,total_tokens,prompt_version,policy_digest").eq("task_id", task.data.id) : null;
  const report = { checkedAtUtc: new Date().toISOString(), model, role, maximumRequests: 1, success, errorCode, latencyMs: Math.round(performance.now() - began), quotaHeaders: limits, transportChecks, validationChecks,
    attempts: runs?.data ?? [], accountTier: "builder-confirmed-free", quotaSource: "builder-supplied Free Plan table; response headers checked where provided", roleQualityQualified: false, webAiEnabled: false, billedCost: null };
  const path = `research/phase-6/smoke-${model.replaceAll("/", "-")}-${role}-${key}.json`;
  await writeFile(path, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 }); console.log(JSON.stringify(report, null, 2));
  if (!success) process.exitCode = 1;
} catch { console.error("Smoke stopped before dispatch: verified free policy/credentials/admission are required. Values omitted."); process.exitCode = 1; }
