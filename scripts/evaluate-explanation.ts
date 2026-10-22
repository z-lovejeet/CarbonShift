import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../src/server/db/database.types";
import { AI_MODEL_IDS } from "../src/config/ai-registry";
import { evaluationConfiguration } from "../src/server/ai/evaluation";
import { runAiTask } from "../src/server/ai/router";
import { createAiStore } from "../src/server/ai/store";
import { createProviderAdapters } from "../src/server/ai/providers";
import { validateExplanation, templateSelection, type ExplanationFacts } from "../src/server/ai/validation";
import examples from "../src/fixtures/ai/explanation-v1.json" with { type: "json" };
import { subject } from "../src/server/limits/budgets";
import { setTimeout as wait } from "node:timers/promises";
const args = process.argv.slice(2), allowed = new Set(["--model", "--max-requests", "--case", "--review", "--interval-ms", "--live"]);
for (let i = 0; i < args.length; i++) { if (!allowed.has(args[i]!)) throw new Error("Unknown evaluation option"); if (args[i] !== "--live") i++; }
const option = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const model = z.enum(AI_MODEL_IDS).parse(option("--model")), maximum = z.coerce.number().int().min(1).max(4).parse(option("--max-requests") ?? 1);
const intervalMs = z.coerce.number().int().min(0).max(60000).parse(option("--interval-ms") ?? 0);
const cases = examples.cases.filter((c) => !option("--case") || c.id === option("--case")).slice(0, maximum);
if (!cases.length) throw new Error("No matching authored explanation case");
const sha256 = createHash("sha256").update(await readFile("src/fixtures/ai/explanation-v1.json")).digest("hex");
if (!args.includes("--live")) console.log(JSON.stringify({ mode: "dry-run", role: "explanation", model, maximumRequests: maximum, datasetSha256: sha256, selectedCaseIds: cases.map((c) => c.id), liveRequests: 0 }, null, 2));
else {
  try {
    const reviewPath = option("--review"); if (!reviewPath) throw new Error();
    const review = z.strictObject({ datasetSha256: z.literal(sha256), reviewedBy: z.string().trim().min(1).max(100), reviewedAtUtc: z.string().datetime() }).parse(JSON.parse(await readFile(reviewPath, "utf8")));
    const config = evaluationConfiguration({ ...parse(await readFile(".env.local", "utf8")), ...process.env }, model, "explanation");
    const client = createClient<Database>(config.databaseUrl, config.databaseSecret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (url, init) => fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(8000) }) } });
    const deps = { hmac: config.hmac, store: createAiStore(client), adapters: createProviderAdapters(config) }, runId = randomUUID();
    const results = []; await mkdir("research/phase-6/results", { recursive: true });
    for (const c of cases) {
      if (results.length && intervalMs) await wait(intervalMs);
      const { id, ...facts } = c; const input = facts as ExplanationFacts; const began = performance.now();
      const key = randomUUID(), actor = "operator-evaluation";
      let selection = null, errorCode = null;
      try { selection = await runAiTask({ owner: null, actor, role: "explanation", key, evaluation: true, model, policy: config.policy, input,
        validate: (v) => validateExplanation(v, input) }, deps); }
      catch { errorCode = "AI_UNAVAILABLE_OR_LIMITED"; }
      const task = await client.from("ai_tasks").select("id").eq("actor_hash", subject(config.hmac, "ai-actor", actor)).eq("role", "explanation").eq("client_key", key).maybeSingle();
      const runs = task.data ? await client.from("ai_runs").select("provider,model,state,latency_ms,input_tokens,output_tokens,total_tokens,prompt_version,policy_digest").eq("task_id", task.data.id) : null;
      results.push({ caseId: id, selection, templateBaseline: templateSelection(input), schemaAndGroundingPassed: selection !== null, latencyMs: Math.round(performance.now() - began), errorCode, attempts: runs?.data ?? [], preferenceBenefitMeasured: false });
      await writeFile(`research/phase-6/results/${runId}.json`, JSON.stringify({ runId, role: "explanation", model, datasetSha256: sha256, promptVersion: "explanation-v1", review, maximumRequests: maximum,
        checkedAtUtc: new Date().toISOString(), intervalMs, automaticPromotion: false, billedCost: null, results }, null, 2) + "\n", { mode: 0o600 });
      console.log(JSON.stringify({ caseId: id, schemaAndGroundingPassed: selection !== null, errorCode }));
      if (errorCode) { process.exitCode = 1; break; }
    }
    console.log(`Explanation evidence: research/phase-6/results/${runId}.json. No model was promoted.`);
  } catch { console.error("Live explanation evaluation stopped: check the matching review receipt, verified free policy/credentials and admission. Values omitted."); process.exitCode = 1; }
}
