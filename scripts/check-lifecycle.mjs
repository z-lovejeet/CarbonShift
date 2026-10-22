/* global URL, document, innerWidth */
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { testAccounts } from "./lib/test-accounts.mjs";
import { issueProof } from "../src/server/auth/reauth-proof.ts";
import { createLifecycleService } from "../src/server/plans/lifecycle.ts";
import { planSchema } from "../src/contracts/planning.ts";
import { createComparison } from "../src/domain/scheduling.ts";
import { createGridSnapshotRecord } from "../src/server/grid/snapshot.ts";
import { createGridClient } from "../src/server/grid/client.ts";

// Explicit development check. Historical plan fixtures stay in memory; no product clock override,
// provider callback bypass or fabricated forecast enters the application database.
const accounts = testAccounts(), browser = await chromium.launch(), contexts = [];
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const iso = (stamp) => new Date(stamp).toISOString().replace(/\.\d{3}Z$/, "Z");
const london = (stamp) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(stamp)).map((part) => [part.type, part.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
let stage = "create temporary members", cleanupPassed = false;
const evidence = { checkedAtUtc: iso(Date.now()), basis: { privateJourney: "real development Auth/database, live forecast, normal pages/API", completionMath: "authored historical plan held only in memory with live national actual factors", reauthentication: "real provider-start redirects; callback success/identity checks isolated; signed fixture receipt used only for temporary-account deletion" }, noAiOrLedger: true };
try {
  const member = await accounts.member(), foreign = await accounts.member();
  const context = await browser.newContext({ baseURL: accounts.origin, viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Kolkata" }); contexts.push(context); context.setDefaultTimeout(45000); await context.addCookies(member.cookies);
  const other = await browser.newContext({ baseURL: accounts.origin }); contexts.push(other); await other.addCookies(foreign.cookies);
  const page = await context.newPage(), errors = []; page.on("pageerror", () => errors.push("browser_error"));
  stage = "manual live planning"; await page.goto("/app/plan/new");
  const start = Math.ceil((Date.now() + 3600000) / 1800000) * 1800000;
  for (const [field, stamp] of [["earliest", start], ["deadline", start + 21600000]]) {
    const value = london(stamp); await page.locator(`#${field}-date`).fill(value.date); await page.locator(`#${field}-time`).fill(value.time);
  }
  await page.getByLabel("Estimated cycle energy (kWh)").fill("0.875");
  await page.getByRole("button", { name: "Review constraints" }).click(); await page.getByRole("checkbox", { name: /I confirm the duration/ }).check();
  await page.getByRole("button", { name: "Compare times" }).click(); await page.getByRole("button", { name: "Review this plan" }).click(); await page.getByRole("checkbox", { name: /I’ve reviewed the exact baseline/ }).check();
  const saving = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/plans" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Save this plan", exact: true }).click(); const saved = await saving; expect(saved.status()).toBe(200); const plan = (await saved.json()).data;
  await expect(page).toHaveURL(`/app/plans/${plan.id}`); await expect(page.getByText("Execution: not reported", { exact: true })).toBeVisible();
  expect((await other.request.get(`/api/v1/plans/${plan.id}`)).status()).toBe(404);
  stage = "future report rejection and completion form";
  await page.getByRole("link", { name: "Report execution", exact: true }).click(); await page.getByLabel("Do the saved duration and energy assumption still apply?").selectOption("yes");
  const reporting = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/reports") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Save execution report" }).click(); expect((await reporting).status()).toBe(422); await expect(page.getByRole("alert").filter({ hasText: "A run must begin after acceptance" })).toBeVisible();
  const completionAxe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze(); expect(completionAxe.violations).toEqual([]);
  await mkdir("test-results", { recursive: true }); await page.screenshot({ path: "test-results/m07-completion-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: "test-results/m07-completion-mobile.png", fullPage: true });
  stage = "cancellation, retry and original forecast";
  await page.goto(`/app/plans/${plan.id}`); await page.getByText("Cancel this plan", { exact: true }).click(); await page.getByLabel("Why are you cancelling?").fill("Development lifecycle check: no appliance operated.");
  const cancelling = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/cancel") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Confirm cancellation" }).click(); const cancelled = await cancelling; expect(cancelled.status()).toBe(200); const ack = (await cancelled.json()).data;
  await expect(page.getByRole("heading", { name: "Plan cancelled", exact: true })).toBeVisible();
  const detail = (await (await context.request.get(`/api/v1/plans/${plan.id}`)).json()).data;
  expect(detail.comparison).toEqual(plan.comparison); expect(detail.forecastSnapshot).toEqual(plan.forecastSnapshot); expect(detail.latestResult.result.differenceMg).toBeNull(); expect(detail.reports).toHaveLength(1);
  const repeated = await context.request.post(`/api/v1/plans/${plan.id}/cancel`, { headers: { Origin: accounts.origin, "Idempotency-Key": cancelled.request().headers()["idempotency-key"] }, data: cancelled.request().postDataJSON() }); expect(repeated.status()).toBe(200); expect((await repeated.json()).data).toEqual(ack);
  const terminal = await context.request.post(`/api/v1/plans/${plan.id}/reports`, { headers: { Origin: accounts.origin, "Idempotency-Key": randomUUID() }, data: { kind: "did_not_run", reportedStartUtc: null, profileStillApplicable: null, correctsReportId: detail.latestReport.id, reason: "Attempted correction of cancelled plan" } }); expect(terminal.status()).toBe(409);
  stage = "reauthentication controls";
  expect((await context.request.delete(`/api/v1/plans/${plan.id}`, { headers: { Origin: accounts.origin, "Idempotency-Key": randomUUID() } })).status()).toBe(403);
  await page.goto("/app/settings"); await page.getByRole("checkbox").check(); await expect(page.getByRole("button", { name: "Delete my CarbonShift account" })).toBeDisabled();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: "test-results/m07-settings-mobile.png", fullPage: true });
  for (const provider of ["google", "github"]) {
    const response = await context.request.post("/auth/sign-in", { form: { provider, intent: "reauth" }, headers: { Origin: accounts.origin }, maxRedirects: 0 }); expect(response.status()).toBe(303);
    const destination = new URL(response.headers().location); expect(destination.pathname).toBe("/auth/v1/authorize"); expect(destination.searchParams.get("redirect_to")).toBe(accounts.origin + "/auth/callback");
  }
  // Fixture-only receipt tests the real server/session binding and deletion path. It is NOT
  // evidence of a successful human Google/GitHub reauthentication; isolated callback tests cover that.
  const proof = issueProof("receipt", member.id, member.sessionId, process.env.RATE_LIMIT_HMAC_SECRET);
  await context.addCookies([{ name: "cs-reauth", value: proof, url: accounts.origin, httpOnly: true, sameSite: "Lax" }]);
  stage = "private plan deletion"; await page.goto(`/app/plans/${plan.id}`); await page.getByText("Delete this private plan", { exact: true }).click(); await page.getByRole("checkbox").check();
  const deletingPlan = page.waitForResponse((r) => new URL(r.url()).pathname === `/api/v1/plans/${plan.id}` && r.request().method() === "DELETE");
  await page.getByRole("button", { name: "Delete private plan", exact: true }).click(); expect((await deletingPlan).status()).toBe(200); await expect(page).toHaveURL("/app"); expect((await context.request.get(`/api/v1/plans/${plan.id}`)).status()).toBe(404);
  stage = "temporary-account deletion"; await page.goto("/app/settings"); await expect(page.getByText("Identity confirmed recently.", { exact: false })).toBeVisible(); await page.getByRole("checkbox").check();
  const deletingAccount = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/account/delete" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Delete my CarbonShift account", exact: true }).click(); expect((await deletingAccount).status()).toBe(200); await expect(page).toHaveURL(/\/login\?account=deleted$/);
  const removed = await admin.auth.admin.getUserById(member.id); expect(removed.error?.code).toBe("user_not_found"); expect((await admin.auth.admin.getUserById(foreign.id)).error).toBeNull(); expect(errors).toEqual([]);
  evidence.privateJourney = { passed: true, futureReportRejected: true, cancellationTerminal: true, originalForecastPreserved: true, retryStable: true, ownerIsolation: true, deletionReceiptEnforced: true, temporaryAccountRemoved: true, unrelatedMemberRetained: true, desktopMobileChecks: true, axeViolations: 0, browserErrors: 0 };
  stage = "live actual grid integration with an in-memory authored plan";
  const clock = Math.floor((Date.now() - 43200000) / 1800000) * 1800000, first = clock + 3600000;
  const factors = [300, 340, 260, 220, 100, 140, 280, 300];
  const authored = createGridSnapshotRecord({ geography: "GB_NATIONAL", sourceUrl: `https://api.carbonintensity.org.uk/intensity/${iso(first).replace(":00Z", "Z")}/fw48h`, retrievedAtUtc: iso(clock), providerIssuedAtUtc: null, license: "CC BY 4.0", intervals: factors.map((factor, i) => ({ fromUtc: iso(first + i * 1800000), toUtc: iso(first + (i + 1) * 1800000), forecastGPerKwh: factor, actualGPerKwh: null })) });
  const comparison = createComparison({ constraints: { geography: "GB_NATIONAL", timezone: "Europe/London", earliestStartUtc: iso(first), deadlineUtc: iso(first + 14400000), durationMinutes: 60, energyWh: 875, energyBasis: "user_estimate", blockedIntervals: [], baselineStartUtc: iso(first), baselineOrigin: "user_selected", confirmedAtUtc: iso(clock) }, snapshot: authored.snapshot, forecastSnapshotId: authored.id, forecastSnapshotHash: authored.hash }, iso(clock));
  const isolatedPlan = planSchema.parse({ schemaVersion: 1, id: randomUUID(), comparisonId: randomUUID(), version: 1, mode: "live", status: "accepted", acceptedAtUtc: iso(clock), comparison, forecastSnapshot: authored.snapshot, completion: "not_reported", publication: "private", latestReport: null, latestResult: null, reports: [], revisions: [] });
  const grid = createGridClient(); let observed;
  const service = createLifecycleService({ repository: { detail: async () => isolatedPlan, replay: async () => null, commit: async (value) => { observed = value; return { planId: value.planId, planVersion: 2, reportId: value.report.id, resultId: value.revision.id, changed: true, deleted: false }; } }, now: () => iso(Date.now()), actual: (range) => grid.getActual(range) });
  await service.report(isolatedPlan.id, { kind: "ran", reportedStartUtc: comparison.selected.startUtc, profileStillApplicable: true, correctsReportId: null, reason: "Authored historical plan fixture; live actual factors; no appliance operated." }, randomUUID(), "a".repeat(64));
  expect(observed.revision.result.status).toBe("actual_estimate");
  evidence.actualIntegration = { passed: true, originalForecast: "authored fixture kept only in memory", actualSource: observed.snapshot.snapshot.sourceUrl, actualRetrievedAtUtc: observed.snapshot.snapshot.retrievedAtUtc, actualIntervals: observed.snapshot.snapshot.intervals.length, updatedResult: observed.revision.result, applicationDatabaseWrites: 0 };
  console.log("M07: real private planner → future-report rejection → cancellation/history → guarded plan/account deletion passed. In-memory authored plan + live actual factors passed.");
} catch (error) { console.error(`M07 check failed at ${stage}: ${error instanceof Error ? error.message.slice(0, 500) : "details omitted"}`); process.exitCode = 1; }
finally {
  for (const context of contexts) await context.close(); await browser.close();
  try { await accounts.cleanup(); cleanupPassed = true; console.log("Only temporary fixture accounts targeted; cleanup passed."); } catch { console.error("Temporary fixture cleanup requires review."); process.exitCode = 1; }
  if (!process.exitCode) { await mkdir("research/phase-7", { recursive: true }); await writeFile("research/phase-7/live-lifecycle.json", JSON.stringify({ ...evidence, cleanupPassed }, null, 2) + "\n"); }
}
