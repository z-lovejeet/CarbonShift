import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { setTimeout as wait } from "node:timers/promises";
import type { Database } from "../src/server/db/schema";
import { AI_MODEL_IDS } from "../src/config/ai-registry";
import { evaluationConfiguration } from "../src/server/ai/evaluation";
import { createAiStore } from "../src/server/ai/store";
import { createProviderAdapters } from "../src/server/ai/providers";
import { runAiTask } from "../src/server/ai/router";
import { validateActivitySuggestion } from "../src/server/ai/activity-variant";
import type { ActivitySuggestion } from "../src/contracts/activity-ai";

const args = process.argv.slice(2), option = (key: string) => args[args.indexOf(key) + 1];
const model = z.enum(AI_MODEL_IDS).parse(args.includes("--model") ? option("--model") : "gemini-3.5-flash-lite");
const maximum = z.coerce.number().int().min(1).max(24).parse(args.includes("--max-requests") ? option("--max-requests") : 1);
const interval = z.coerce.number().int().min(0).max(60000).parse(args.includes("--interval-ms") ? option("--interval-ms") : 0);
const raw = await readFile("research/household/ai/cases.json", "utf8"), datasetSha256 = createHash("sha256").update(raw).digest("hex");
type Expected = Record<string, unknown> & { requiredQuestions?: string[]; tasks?: Expected[] };
const cases = JSON.parse(raw) as { id: string; split: string; text: string; referenceDate: string; expected: Expected }[];
const review = JSON.parse(await readFile("research/household/ai/review.json", "utf8"));
if (review.datasetSha256 !== datasetSha256 || !review.reviewedBy) throw new Error("The labels need review after edits.");
const start = args.includes("--start-at") ? cases.findIndex((c) => c.id === option("--start-at")) : 0;
if (start < 0) throw new Error("Unknown case");
const selected = cases.slice(start, start + maximum);
if (!args.includes("--live")) { console.log(JSON.stringify({ model, caseIds: selected.map((c) => c.id), datasetSha256, liveRequests: 0 })); }
else {
  const source = { ...parse(await readFile(".env.local", "utf8")), ...process.env }, config = evaluationConfiguration(source, model, "constraints");
  const client = createClient<Database>(config.databaseUrl, config.databaseSecret, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(8000) }) } });
  const diagnostic: Record<string, unknown> = {};
  const dependencies = { store: createAiStore(client), adapters: createProviderAdapters(config, async (url, init) => {
    const response = await fetch(url, init);
    if (!response.ok) {
      const errorText = (await response.clone().text()).slice(0, 16384).toLowerCase();
      diagnostic.providerStatus = response.status;
      diagnostic.categories = ["schema", "not found", "unsupported", "api key", "quota", "invalid argument", "too complex", "maximum", "pattern"].filter((word) => errorText.includes(word));
    }
    return response;
  }), hmac: config.hmac };
  const runId = randomUUID(), outcomes: unknown[] = [];
  await mkdir("research/household/ai/results", { recursive: true });
  for (const item of selected) {
    if (outcomes.length && interval) await wait(interval);
    let answer: ActivitySuggestion | null = null, errorCode: string | null = null; const began = performance.now();
    try { answer = await runAiTask({ owner: null, actor: "operator-activity-evaluation", key: randomUUID(), role: "constraints", variant: "activity-v2", model, evaluation: true, policy: config.policy,
      input: { text: item.text, referenceDate: item.referenceDate, timezone: "Europe/London" }, validate: (value) => {
        try { return validateActivitySuggestion(value, item.text); }
        catch (error) { diagnostic.validation = error instanceof z.ZodError ? error.issues.map((i) => ({ code: i.code, path: i.path.join(".") })) : error instanceof Error ? error.message : "invalid"; diagnostic.authoredCaseOutput = value; throw error; }
      } }, dependencies); }
    catch (e) { errorCode = e && typeof e === "object" && "code" in e && typeof e.code === "string" ? e.code : "AI_UNAVAILABLE"; }
    const expected = item.expected.tasks ?? [item.expected], wrongFields: string[] = [];
    if (answer?.tasks.length !== expected.length) wrongFields.push("taskCount");
    for (const [i, task] of expected.entries()) {
      for (const [field, value] of Object.entries(task)) {
        if (["tasks", "requiredQuestions"].includes(field)) continue;
        if (JSON.stringify(answer?.tasks[i]?.[field as keyof ActivitySuggestion["tasks"][number]]) !== JSON.stringify(value)) wrongFields.push(`${i}.${field}`);
      }
      for (const question of task.requiredQuestions ?? []) if (!answer?.tasks[i]?.questions.includes(question as ActivitySuggestion["tasks"][number]["questions"][number])) wrongFields.push(`${i}.question.${question}`);
    }
    const outcome = { diagnostic: structuredClone(diagnostic), caseId: item.id, split: item.split, errorCode, latencyMs: Math.round(performance.now() - began), correct: answer !== null && !wrongFields.length, wrongFields, answer };
    outcomes.push(outcome);
    await writeFile(`research/household/ai/results/${runId}.json`, JSON.stringify({ runId, model, variant: "activity-v2", promptVersion: "activity-v2.3", datasetSha256, review, accountTier: "user-confirmed-free", automaticPromotion: false, updatedAtUtc: new Date().toISOString(), outcomes }, null, 2) + "\n");
    console.log(JSON.stringify({ caseId: item.id, errorCode, correct: outcome.correct, wrongFields }));
    if (errorCode) { process.exitCode = 1; break; }
  }
  console.log(`Evidence: research/household/ai/results/${runId}.json`);
}
