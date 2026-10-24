/* global URL, document, innerWidth */
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { testAccounts } from "./lib/test-accounts.mjs";

// Explicit real development check: at most one normal two-attempt task per role.
// Requires already evaluated routes and a configured local dev server with AI enabled.
const accounts = testAccounts(), browser = await chromium.launch();
let context, stage = "configuration and temporary identity";
const london = (instant) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant)).map((v) => [v.type, v.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
try {
  const policy = JSON.parse(process.env.AI_POLICY_JSON ?? "null");
  if (process.env.AI_ENABLED !== "true" || !policy || !["constraints", "explanation"].every((role) => policy.roles[role].some((id) => policy.models.some((m) => m.id === id && m.enabled && m.qualifiedRoles.includes(role))))) throw new Error("Enable only evaluated local routes before this explicit live check.");
  const member = await accounts.member();
  context = await browser.newContext({ baseURL: accounts.origin, viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Kolkata" });
  context.setDefaultTimeout(45000); await context.addCookies(member.cookies);
  const page = await context.newPage(), pageErrors = []; page.on("pageerror", () => pageErrors.push("browser_error"));
  stage = "open planner"; await page.goto("/app/plan/new");
  const start = Math.ceil((Date.now() + 10800000) / 1800000) * 1800000, a = london(start), b = london(start + 21600000);
  await page.getByLabel("Estimated cycle energy (kWh)").fill("0.875");
  await page.getByText("Describe your timing", { exact: false }).click();
  await page.getByLabel("Your timing request").fill(`My washing cycle lasts 60 minutes. Earliest start is ${a.date} at ${a.time}; it must finish by ${b.date} at ${b.time}, London time.`);
  await page.getByRole("checkbox", { name: /I agree to send this non-personal timing text/ }).check();
  const aiResponse = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/ai/constraints" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Suggest timing fields", exact: true }).click();
  stage = "Gemini timing response"; const interpreted = await aiResponse;
  if (interpreted.status() !== 200) { const error = (await interpreted.json()).error; throw new Error(`AI_HTTP_${interpreted.status()}_${error?.code ?? "UNKNOWN"}`); }
  const suggestion = (await interpreted.json()).data;
  stage = "timing fields match authored request"; expect(suggestion.earliestLocal).toMatchObject(a); expect(suggestion.deadlineLocal).toMatchObject(b); expect(suggestion.durationMinutes).toBe(60); expect(suggestion.unsupportedRequests).toEqual([]);
  const key = interpreted.request().headers()["ai-task-key"], original = interpreted.request().postDataJSON();
  const duplicate = await context.request.post("/api/v1/ai/constraints", { headers: { Origin: accounts.origin, "AI-Task-Key": key }, data: original }); expect(duplicate.status()).toBe(409);
  const conflict = await context.request.post("/api/v1/ai/constraints", { headers: { Origin: accounts.origin, "AI-Task-Key": key }, data: { ...original, text: original.text + " Please check." } }); expect(conflict.status()).toBe(409);
  stage = "review and apply"; await page.getByRole("checkbox", { name: "I checked these suggestions against my request." }).check();
  await page.getByRole("button", { name: "Apply checked suggestions" }).click();
  await expect(page.locator("#earliest-date")).toHaveValue(a.date); await expect(page.locator("#earliest-time")).toHaveValue(a.time);
  await expect(page.getByLabel("Estimated cycle energy (kWh)")).toHaveValue("0.875");
  await page.getByRole("button", { name: "Review constraints" }).click();
  await page.getByRole("checkbox", { name: /I confirm the duration/ }).check();
  stage = "real grid comparison"; const comparing = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/comparisons" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Compare times" }).click(); const compared = await comparing; expect(compared.status()).toBe(200);
  const comparison = (await compared.json()).data; expect(comparison.constraints.energyWh).toBe(875);
  await page.getByText("Ask AI to select the key reasons", { exact: true }).click();
  await page.getByRole("checkbox", { name: "I agree to send these comparison facts for AI explanation." }).check();
  const explanationResponse = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/explanation") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Explain this comparison", exact: true }).click();
  stage = "Groq explanation response"; const explained = await explanationResponse;
  if (explained.status() !== 200) { const error = (await explained.json()).error; throw new Error(`AI_HTTP_${explained.status()}_${error?.code ?? "UNKNOWN"}`); }
  const explanation = (await explained.json()).data; expect(explanation.source).toBe("ai");
  expect(explanation.selection.limitationCodes).toEqual(expect.arrayContaining(["ASSUMED_ENERGY", "NATIONAL_SIGNAL"]));
  const cached = await context.request.post(`/api/v1/comparisons/${comparison.id}/explanation`, { headers: { Origin: accounts.origin, "AI-Task-Key": randomUUID() }, data: { aiConsent: true } });
  expect(cached.status()).toBe(200); expect((await cached.json()).data.source).toBe("cache");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir("test-results", { recursive: true }); await page.screenshot({ path: "test-results/live-ai-comparison.png", fullPage: true });
  stage = "immutable save and reload"; await page.getByRole("button", { name: "Review this plan" }).click(); await page.getByRole("checkbox", { name: /I’ve reviewed the exact baseline/ }).check();
  const saving = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/plans" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Save this plan", exact: true }).click(); const saved = await saving; expect(saved.status()).toBe(200); const plan = (await saved.json()).data;
  await expect(page).toHaveURL(`/app/plans/${plan.id}`); await page.reload(); await expect(page.getByText("Execution: not reported", { exact: true })).toBeVisible(); expect(pageErrors).toEqual([]);
  const report = { checkedAtUtc: new Date().toISOString(), result: "passed", maximumProviderAttempts: 4, planId: plan.id, comparisonId: comparison.id, snapshotId: comparison.forecastSnapshotId,
    checks: ["real AI interpretation with review/apply", "exact energy unchanged", "finished/changed task keys rejected", "real deterministic grid comparison", "grounded live AI explanation", "owner code cache hit", "immutable save/reload", "axe/overflow"], physicalExecutionVerified: false };
  const directory = process.env.CARBONSHIFT_CHECK_PHASE === "M09" ? "research/phase-9" : "research/phase-6";
  await mkdir(directory, { recursive: true }); await writeFile(`${directory}/live-ai-flow.json`, JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report));
} catch (error) { console.error(`Live AI flow did not pass at ${stage}.${error instanceof Error && /^AI_HTTP_\d+_[A-Z_]+$/.test(error.message) ? ` ${error.message}.` : ""} Provider output, input and credentials omitted; no automatic retry.`); process.exitCode = 1; }
finally { await context?.close(); await browser.close(); try { await accounts.cleanup(); console.log("Only this check's fixture users were removed."); } catch { console.error("Fixture cleanup requires review."); process.exitCode = 1; } }
