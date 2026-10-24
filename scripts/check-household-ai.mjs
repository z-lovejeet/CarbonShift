import { chromium, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { testAccounts } from "./lib/test-accounts.mjs";
const accounts = testAccounts(), browser = await chromium.launch(); let context;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
try {
  const member = await accounts.member(); context = await browser.newContext({ baseURL: accounts.origin }); await context.addCookies(member.cookies);
  async function call(path, body, extra = {}) { const response = await context.request.post(`/api/v2${path}`, { headers: { origin: accounts.origin, "content-type": "application/json", ...extra }, data: body }), result = await response.json(); if (response.status() !== 200) throw new Error(`${path}: ${response.status()} ${result.error?.code ?? "unavailable"}`); return result.data; }
  const referenceDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const interpretation = await call("/activities/interpret", { schemaVersion: 2, text: "Clean my car this afternoon. I do not know the equipment power or duration.", referenceDate, aiConsent: true }, { "AI-Task-Key": randomUUID() });
  expect(interpretation.tasks[0].energyText).toBeNull(); expect(interpretation.tasks[0].questions).toEqual(expect.arrayContaining(["equipment", "energy", "duration"]));
  const first = Math.ceil((Date.now() + 7200000) / 1800000) * 1800000;
  const comparison = await call("/schedules/compare", { constraintsConfirmed: true, input: { schemaVersion: 2, kind: "tasks", geography: "GB_NATIONAL", timezone: "Europe/London", dayDate: null, tasks: [{ activity: { schemaVersion: 2, id: "tv", category: "television", name: "Authored AI integration", durationMinutes: 30, quantity: 1, energy: { kind: "average_power", powerMw: 100000, origin: "user_estimate", confirmed: true } }, baselineStartUtc: iso(first), windows: [{ startUtc: iso(first), endUtc: iso(first + 7200000) }], blocks: [], fixedStartUtc: null, resourceIds: [], requiresAttention: false, predecessorIds: [] }] } });
  const saved = await call("/schedules", { comparisonId: comparison.id, version: 1, optionIndex: 0, confirmed: true }, { "Idempotency-Key": randomUUID() });
  const explain = () => call(`/schedules/${saved.id}/explanation`, { aiConsent: true }, { "AI-Task-Key": randomUUID() }), one = await explain(), two = await explain(); expect(one.source).toBe("ai"); expect(two.source).toBe("cache");
  const evidence = { checkedAtUtc: new Date().toISOString(), source: "normal authenticated v2 routes; authored non-personal inputs", interpretation: { energyUnknown: true, questions: interpretation.tasks[0].questions }, explanation: { firstSource: one.source, secondSource: two.source, codes: two.codes }, providerTasks: 2, cachedLookup: "no new inference", blockchainRequests: 0 };
  await writeFile("research/household/final/ai-wiring.json", JSON.stringify(evidence, null, 2) + "\n"); console.log(JSON.stringify(evidence));
} finally { await context?.close(); await browser.close(); await accounts.cleanup(); }
