/* global URL, document, innerWidth */
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { testAccounts } from "./lib/test-accounts.mjs";

const accounts = testAccounts();
const browser = await chromium.launch();
const contexts = [], evidence = [];
const local = (instant) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
};
try {
  await mkdir("test-results", { recursive: true });
  for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 360, height: 800 }]) {
    const member = await accounts.member();
    const context = await browser.newContext({ baseURL: accounts.origin, viewport, timezoneId: "Asia/Kolkata" });contexts.push(context);context.setDefaultTimeout(45_000);
    await context.addCookies(member.cookies);
    const page = await context.newPage();
    const pageErrors = [];page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Your first wash plan starts here." })).toBeVisible();
    if (evidence.length) {
      expect((await context.request.get(`/api/v1/plans/${evidence[0].planId}`)).status()).toBe(404);
      expect((await context.request.get(`/api/v1/comparisons/${evidence[0].comparisonId}`)).status()).toBe(404);
      const foreignPage = await page.goto(`/app/plans/${evidence[0].planId}`);expect(foreignPage.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "This page isn’t here." })).toBeVisible();await page.goto("/app");
    }
    await page.getByRole("link", { name: "Plan a wash", exact: true }).click();
    const earliest = Math.ceil((Date.now() + 3_600_000) / 1_800_000) * 1_800_000;
    for (const [field, stamp] of [["earliest", earliest], ["deadline", earliest + 21_600_000]]) {
      const value = local(stamp);await page.locator(`#${field}-date`).fill(value.date);await page.locator(`#${field}-time`).fill(value.time);
    }
    await page.getByLabel("Estimated cycle energy (kWh)").fill("0.875");
    await page.getByRole("button", { name: "Add blocked period", exact: true }).click();
    for (const [field, stamp] of [["block-0-start", earliest], ["block-0-end", earliest + 1_800_000]]) {
      const value = local(stamp);await page.locator(`#${field}-date`).fill(value.date);await page.locator(`#${field}-time`).fill(value.time);
    }
    await page.getByRole("button", { name: "Review constraints" }).click();
    await expect(page.getByText("0.875 kWh (875 Wh)", { exact: false })).toBeVisible();
    await page.getByRole("checkbox", { name: /I confirm the duration/ }).check();
    const comparisonResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/comparisons" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Compare times" }).click();
    const comparisonResult = await comparisonResponse;expect(comparisonResult.status()).toBe(200);const comparison = (await comparisonResult.json()).data;
    await expect(page.getByRole("heading", { name: "Find the time that fits." })).toBeVisible();
    expect(comparison.constraints.energyWh).toBe(875);expect(Date.parse(comparison.baseline.startUtc)).toBe(earliest + 1_800_000);
    await page.getByText("View accessible forecast table", { exact: false }).click();await expect(page.getByRole("table")).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/live-comparison-${viewport.name}.png`, fullPage: true });
    await page.getByRole("button", { name: "Review this plan" }).click();await page.getByRole("checkbox", { name: /I’ve reviewed the exact baseline/ }).check();
    const saveResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/plans" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Save this plan", exact: true }).click();const savedResponse = await saveResponse;expect(savedResponse.status()).toBe(200);const plan = (await savedResponse.json()).data;
    await expect(page).toHaveURL(`/app/plans/${plan.id}`);await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your saved plan");
    expect(plan.comparison).toEqual(Object.fromEntries(Object.entries(comparison).filter(([key]) => !["id", "version", "schemaVersion"].includes(key))));
    await page.reload();await expect(page.getByText("Execution: not reported", { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/live-plan-${viewport.name}.png`, fullPage: true });
    await page.getByRole("link", { name: "← Your plans", exact: true }).click();await expect(page.locator(`a[href="/app/plans/${plan.id}"]`)).toBeVisible();expect(pageErrors).toEqual([]);
    evidence.push({ viewport: viewport.name, planId: plan.id, comparisonId: comparison.id, snapshotId: comparison.forecastSnapshotId });
    console.log(`${viewport.name}: fresh-user form → live grid comparison → immutable save → reloaded private detail → dashboard passed.`);
  }
  console.log(JSON.stringify({ result: "passed", basis: "real hosted Auth/DB, real grid, normal local pages/API, fresh seeded users", evidence, crossUser: "API comparison/plan and page 404 observed", noAiOrLedger: true }));
} catch (error) { console.error(error instanceof Error ? error.message : "Planner check failed; details omitted.");process.exitCode = 1; }
finally { for (const context of contexts) await context.close();await browser.close();try { await accounts.cleanup();console.log("Only this run’s fixture users were cleaned up; existing OAuth users were not targeted."); } catch { console.error("Fixture cleanup requires review.");process.exitCode = 1; } }
