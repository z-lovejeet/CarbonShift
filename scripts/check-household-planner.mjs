/* global document, innerWidth */
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { testAccounts } from "./lib/test-accounts.mjs";
const accounts = testAccounts(), browser = await chromium.launch(), contexts = [], evidence = [];
const local = (n) => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(n).map((p) => [p.type, p.value])); return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }; };
try {
  const member = await accounts.member(), other = await accounts.member();
  for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ baseURL: accounts.origin, viewport, timezoneId: "Asia/Kolkata" }); contexts.push(context); context.setDefaultTimeout(45000); await context.addCookies(member.cookies);
    const page = await context.newPage(), errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/app/plan/new"); await expect(page.getByRole("heading", { name: "Make room for cleaner energy." })).toBeVisible();
    const first = Math.ceil((Date.now() + 3600000) / 1800000) * 1800000;
    const activities = viewport.name === "desktop" ? [["television", "60", "100"], ["vacuuming", "15", "900"]] : [["fan", "35", "45"]];
    for (const [index, [category, duration, watts]] of activities.entries()) {
      if (index) await page.getByRole("button", { name: "Add another activity" }).click();
      await page.getByLabel("Activity", { exact: true }).selectOption(category); await page.getByLabel("Active duration", { exact: false }).fill(duration); await page.getByLabel("Operating watts per device").fill(watts); await page.getByRole("checkbox", { name: /I have checked this energy basis/ }).check();
      for (const [name, time] of [["Usual start", first + index * 3600000], ["Available from", first], ["Must finish by", first + 14400000]]) { const group = page.getByRole("group", { name, exact: true }), value = local(time); await group.getByLabel("Date", { exact: true }).fill(value.date); await group.getByLabel("Time", { exact: true }).fill(value.time); }
    }
    await page.getByRole("button", { name: "Review all tasks" }).click(); await page.getByRole("checkbox", { name: /These are my usual times/ }).check();
    const comparing = page.waitForResponse((r) => r.url().endsWith("/api/v2/schedules/compare")); await page.getByRole("button", { name: "Compare schedules", exact: true }).click(); const response = await comparing, body = await response.json(); expect(response.status(), JSON.stringify(body.error)).toBe(200);
    const comparison = body.data; expect(comparison.solution.selected.tasks.length).toBe(activities.length); expect(comparison.solution.differenceMg).toBeGreaterThanOrEqual(0);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/household-compare-${viewport.name}.png`, fullPage: true });
    await page.getByRole("checkbox", { name: /I have reviewed every task/ }).check(); const saving = page.waitForResponse((r) => r.url().endsWith("/api/v2/schedules") && r.request().method() === "POST"); await page.getByRole("button", { name: "Save schedule", exact: true }).click(); const savedResponse = await saving, savedBody = await savedResponse.json(); expect(savedResponse.status(), JSON.stringify(savedBody.error)).toBe(200); const saved = savedBody.data;
    await expect(page).toHaveURL(`/app/plans/${saved.id}`); await expect(page.getByRole("heading", { name: "Your saved schedule", exact: true })).toBeVisible(); await page.reload(); await expect(page.getByRole("heading", { name: "Your saved schedule", exact: true })).toBeVisible();
    expect((await context.request.get(`/api/v2/schedules/${saved.id}`)).status()).toBe(200);
    const foreign = await browser.newContext({ baseURL: accounts.origin }); contexts.push(foreign); await foreign.addCookies(other.cookies); expect((await foreign.request.get(`/api/v2/schedules/${saved.id}`)).status()).toBe(404);
    expect(errors).toEqual([]); evidence.push({ viewport: viewport.name, tasks: activities.length, scheduleId: saved.id, comparisonId: comparison.id, snapshotHash: comparison.grid.hash }); console.log(`${viewport.name}: task editing, live comparison, atomic save/reload and foreign-owner denial passed.`);
  }
  await writeFile("research/household/planner-live.json", JSON.stringify({ checkedAtUtc: new Date().toISOString(), source: "real hosted development Auth/DB and GB grid", evidence }, null, 2) + "\n");
} catch (e) { console.error(e instanceof Error ? e.message : "Household planner failed"); process.exitCode = 1; }
finally { for (const context of contexts) await context.close(); await browser.close(); await accounts.cleanup(); }
