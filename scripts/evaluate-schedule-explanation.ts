import { readFile, writeFile } from "node:fs/promises";
import { parse } from "dotenv";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/server/db/schema";
import { evaluationConfiguration } from "../src/server/ai/evaluation";
import { createAiStore } from "../src/server/ai/store";
import { createProviderAdapters } from "../src/server/ai/providers";
import { runAiTask } from "../src/server/ai/router";
import { validateScheduleExplanation, type ScheduleCode } from "../src/server/ai/schedule-explanation";
const model = "gemini-3.5-flash-lite", config = evaluationConfiguration({ ...parse(await readFile(".env.local", "utf8")), ...process.env }, model, "explanation");
const client = createClient<Database>(config.databaseUrl, config.databaseSecret, { auth: { persistSession: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(8000) }) } });
const cases: ScheduleCode[][] = [["LOWER_ESTIMATE"], ["NO_IMPROVEMENT_FOUND"], ["LOWER_ESTIMATE", "FIXED_TIMES_RETAINED"], ["LOWER_ESTIMATE", "DEPENDENCIES_RESPECTED"], ["NO_IMPROVEMENT_FOUND", "SEARCH_LIMITED"], ["LOWER_ESTIMATE", "FIXED_TIMES_RETAINED", "DEPENDENCIES_RESPECTED", "SEARCH_LIMITED"]];
const outcomes = [];
for (const [i, codes] of cases.entries()) {
  const facts = { eligibleCodes: codes, requiredCodes: codes.filter((c) => c === "SEARCH_LIMITED") };
  let rejectedOutput: unknown = null;
  try { const selection = await runAiTask({ owner: null, actor: "operator-schedule-explanation", key: randomUUID(), role: "explanation", variant: "schedule-explanation-v2", evaluation: true, model, policy: config.policy, input: facts, validate: (raw) => { try { return validateScheduleExplanation(raw, facts); } catch (e) { rejectedOutput = raw; throw e; } } }, { hmac: config.hmac, store: createAiStore(client), adapters: createProviderAdapters(config) }); outcomes.push({ caseId: i + 1, valid: true, facts, selection }); }
  catch { outcomes.push({ caseId: i + 1, valid: false, facts, rejectedOutput }); process.exitCode = 1; break; }
  console.log(JSON.stringify({ caseId: i + 1, valid: outcomes.at(-1)!.valid }));
}
await writeFile("research/household/ai/schedule-explanation.json", JSON.stringify({ model, variant: "schedule-explanation-v2", promptVersion: "schedule-explanation-v2.3", evaluatedAtUtc: new Date().toISOString(), accountTier: "user-confirmed-free", reviewedBy: "Codex; eligible/required codes are determined by program facts", authoredSynthetic: true, automaticPromotion: false, outcomes }, null, 2) + "\n");
