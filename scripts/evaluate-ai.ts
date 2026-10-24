import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../src/server/db/schema";
import { AI_MODEL_IDS, type ModelId } from "../src/config/ai-registry";
import { evaluationConfiguration, evaluationDatasetSchema, scoreSuggestion, percentile } from "../src/server/ai/evaluation";
import { createAiStore } from "../src/server/ai/store";
import { createProviderAdapters } from "../src/server/ai/providers";
import { runAiTask } from "../src/server/ai/router";
import { validateSuggestion } from "../src/server/ai/validation";
import { suggestionShape } from "../src/contracts/ai";
import { subject } from "../src/server/limits/budgets";
import { PROMPT_VERSION } from "../src/server/ai/prompts";
import { setTimeout as wait } from "node:timers/promises";

const args = process.argv.slice(2), allowed = new Set(["--model", "--dataset", "--max-requests", "--review", "--case", "--start-at", "--interval-ms", "--live"]);
for (let i = 0; i < args.length; i++) { if (!allowed.has(args[i]!)) throw new Error("Unknown evaluation option"); if (args[i] !== "--live") i++; }
const option = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const model = z.enum(AI_MODEL_IDS).parse(option("--model")) as ModelId;
const split = z.enum(["development", "holdout"]).parse(option("--dataset") ?? "development");
const maximum = z.coerce.number().int().min(1).max(60).parse(option("--max-requests") ?? 1);
const intervalMs = z.coerce.number().int().min(0).max(60000).parse(option("--interval-ms") ?? 0);
const bytes = await readFile(`src/fixtures/ai/${split}-v1.json`), dataset = evaluationDatasetSchema.parse(JSON.parse(bytes.toString()));
const sha256 = createHash("sha256").update(bytes).digest("hex");
const startAt = option("--start-at") ? dataset.cases.findIndex((c) => c.id === option("--start-at")) : 0;
if (startAt < 0) throw new Error("Unknown start case");
const selected = dataset.cases.slice(startAt).filter((c) => !option("--case") || c.id === option("--case")).slice(0, maximum);
if (!selected.length) throw new Error("No matching authored case");
if (!args.includes("--live")) {
  console.log(JSON.stringify({ mode: "dry-run", model, split, maximumRequests: maximum, intervalMs, selectedCaseIds: selected.map((c) => c.id), datasetSha256: sha256, liveRequests: 0, requires: ["matching human-review receipt", "verified account quotas and free access", "enabled evaluation candidate", "applied admission migration"] }, null, 2));
} else {
  try {
    const reviewPath = option("--review"); if (!reviewPath) throw new Error("Human label review is required");
    const review = z.strictObject({ datasetSha256: z.literal(sha256), reviewedBy: z.string().trim().min(1).max(100), reviewedAtUtc: z.string().datetime() }).parse(JSON.parse(await readFile(reviewPath, "utf8")));
    const source = { ...parse(await readFile(".env.local", "utf8")), ...process.env }, config = evaluationConfiguration(source, model, "constraints");
    const client = createClient<Database>(config.databaseUrl, config.databaseSecret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (url, init) => fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(8000) }) } });
    const dependencies = { hmac: config.hmac, store: createAiStore(client), adapters: createProviderAdapters(config) };
    const runId = randomUUID(), actor = "operator-evaluation", outcomes = [];
    await mkdir("research/phase-6/results", { recursive: true });
    const startedAtUtc = new Date().toISOString();
    for (const item of selected) {
      if (outcomes.length && intervalMs) await wait(intervalMs);
      const key = randomUUID(), began = performance.now(); let suggestion = null, errorCode: string | null = null;
      let validationFlags: { schemaValid: boolean; schemaIssues: { code: string; path: string }[]; sourceBoundsValid: boolean | null; populatedFieldsSupported: boolean | null } | null = null;
      try {
        suggestion = await runAiTask({ owner: null, actor, key, role: "constraints", policy: config.policy, model, evaluation: true,
          input: { text: item.text, referenceDate: item.localReferenceDate, timezone: item.timezone }, validate: (value) => {
            const parsed = suggestionShape.safeParse(value);
            const fields = new Set(["schemaVersion", "earliestLocal", "deadlineLocal", "baselineLocal", "durationMinutes", "blockedLocal", "questions", "sourceSpans", "unsupportedRequests", "date", "time", "offsetChoice", "startDate", "startTime", "endDate", "endTime", "field", "code", "messageKey", "start", "end"]);
            validationFlags = { schemaValid: parsed.success, schemaIssues: parsed.success ? [] : parsed.error.issues.slice(0, 20).map((issue) => ({ code: issue.code, path: issue.path.map((p) => typeof p === "number" ? "[]" : fields.has(String(p)) ? p : "other").join(".") })), sourceBoundsValid: parsed.success ? parsed.data.sourceSpans.every((s) => s.start < s.end && s.end <= item.text.length && /[\p{L}\p{N}]/u.test(item.text.slice(s.start, s.end))) : null,
              populatedFieldsSupported: parsed.success ? ["earliestLocal", "deadlineLocal", "baselineLocal", "durationMinutes", "blockedLocal"].every((field) => {
                const v = Reflect.get(parsed.data, field); const populated = v !== null && (Array.isArray(v) ? v.length > 0 : typeof v === "object" ? Object.values(v).some(Boolean) : true);
                return !populated || parsed.data.sourceSpans.some((s) => s.field === field);
              }) : null };
            return validateSuggestion(value, item.text);
          } }, dependencies);
      } catch (error) { errorCode = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "AI_UNAVAILABLE"; }
      const score = scoreSuggestion(item, suggestion);
      const task = await client.from("ai_tasks").select("id").eq("actor_hash", subject(config.hmac, "ai-actor", actor)).eq("role", "constraints").eq("client_key", key).maybeSingle();
      const runs = task.data ? await client.from("ai_runs").select("provider,model,state,latency_ms,input_tokens,output_tokens,total_tokens,prompt_version,policy_digest").eq("task_id", task.data.id) : null;
      outcomes.push({ caseId: item.id, errorCode, validationFlags, latencyMs: Math.round(performance.now() - began), ...score, attempts: runs?.data ?? [], manualCorrectionObserved: null });
      // Persist after each case so quota-day staging never loses completed evidence.
      await writeFile(`research/phase-6/results/${runId}.json`, JSON.stringify({ schemaVersion: 1, runId, model, role: "constraints", promptVersion: PROMPT_VERSION.constraints, datasetVersion: dataset.datasetVersion, datasetSha256: sha256,
        reviewedBy: review.reviewedBy, reviewedAtUtc: review.reviewedAtUtc, startedAtUtc, updatedAtUtc: new Date().toISOString(), maximumRequests: maximum, intervalMs,
        accountTier: "builder-reported-free", billedCost: null, automaticPromotion: false, scope: "validated pipeline; authored examples; no field-user benefit claim", outcomes,
        metrics: { fieldAccuracy: outcomes.reduce((n, r) => n + r.correctFields, 0) / outcomes.reduce((n, r) => n + r.fields, 0), criticalAccuracy: outcomes.filter((r) => r.criticalCorrect).length / outcomes.length,
          ambiguityRecall: outcomes.some((r) => r.requiredQuestions) ? outcomes.reduce((n, r) => n + r.detectedQuestions, 0) / outcomes.reduce((n, r) => n + r.requiredQuestions, 0) : null,
          falseAmbiguityRate: outcomes.some((r) => r.negativeQuestions) ? outcomes.reduce((n, r) => n + r.falseQuestions, 0) / outcomes.reduce((n, r) => n + r.negativeQuestions, 0) : null,
          p50LatencyMs: percentile(outcomes.map((r) => r.latencyMs), .5), p95LatencyMs: percentile(outcomes.map((r) => r.latencyMs), .95) } }, null, 2) + "\n", { mode: 0o600 });
      console.log(JSON.stringify({ caseId: item.id, checked: suggestion !== null, errorCode, criticalCorrect: score.criticalCorrect }));
      if (errorCode) { process.exitCode = 1; break; } // Explicit rerun only; never spend through a failure or reset.
    }
    console.log(`Evaluation evidence: research/phase-6/results/${runId}.json. No model was promoted.`);
  } catch { console.error("Live evaluation stopped: check reviewed labels, verified free policy/credentials and admission availability. Values and provider errors omitted."); process.exitCode = 1; }
}
