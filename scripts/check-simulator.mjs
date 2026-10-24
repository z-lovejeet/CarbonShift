/* global document, innerWidth */
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { testAccounts } from "./lib/test-accounts.mjs";
const accounts = testAccounts(), browser = await chromium.launch(), contexts = [], evidence = [];
try {
  await mkdir("test-results", { recursive: true });
  const member = await accounts.member();
  for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ baseURL: accounts.origin, viewport, timezoneId: "Asia/Kolkata" }); contexts.push(context); context.setDefaultTimeout(45000); await context.addCookies(member.cookies);
    const page = await context.newPage(), errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/app/simulate"); await expect(page.getByRole("heading", { name: "Explore your energy use." })).toBeVisible();
    await page.getByLabel("Activity", { exact: true }).selectOption("television");
    await page.getByLabel("Active duration", { exact: false }).fill("60");
    await page.getByLabel("Operating watts per device").fill("100");
    await page.getByRole("checkbox", { name: /I have checked this energy basis/ }).check();
    const responsePromise = page.waitForResponse((r) => r.url().endsWith("/api/v2/activities/simulate") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Calculate estimate" }).click();
    await page.screenshot({ path: `test-results/simulator-submit-${viewport.name}.png`, fullPage: true });
    console.log(JSON.stringify({stage:"submitted", alerts: await page.getByRole("alert").allTextContents(), errors, invalid: await page.locator(":invalid").evaluateAll((items) => items.map((e) => ({id:e.id,message:e.validationMessage}))) }));
    const response = await responsePromise, data = (await response.json()).data;
    expect(response.status()).toBe(200); expect(data.estimate.energyMwh).toBe(100000); expect(data.dataStatus).toBe("available"); expect(data.grid.snapshot.intervals.length).toBeGreaterThan(0);
    await expect(page.getByRole("region", { name: "Activity estimate" })).toBeVisible();
    await page.getByText("Time and energy breakdown", { exact: true }).click();
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/live-simulator-${viewport.name}.png`, fullPage: true });
    await page.getByLabel("Operating watts per device").fill("150"); await expect(page.getByRole("region", { name: "Activity estimate" })).toHaveCount(0);
    expect(errors).toEqual([]); evidence.push({ viewport: viewport.name, energyMwh: data.estimate.energyMwh, estimatedMg: data.estimate.estimatedMg, snapshotHash: data.grid.hash, retrievedAtUtc: data.grid.snapshot.retrievedAtUtc });
    console.log(`${viewport.name}: real-grid estimate, provenance, edit invalidation and accessibility passed.`);
  }
  await writeFile("research/household/simulator-live.json", JSON.stringify({ checkedAtUtc: new Date().toISOString(), source: "normal authenticated local pages/API, real GB grid", evidence }, null, 2) + "\n");
} catch (e) { console.error(e instanceof Error ? e.message : "Simulator check failed"); process.exitCode = 1; }
finally { for (const context of contexts) await context.close(); await browser.close(); await accounts.cleanup(); }
