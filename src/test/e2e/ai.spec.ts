import { resolve } from "node:path";
import { build } from "vite";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
declare global { interface Window { carbonShiftAiTest: typeof import("../fixtures/browser-ai-entry") } }
test.use({ timezoneId: "Asia/Kolkata" });
let browserCode: string;
test.beforeAll(async () => {
  const built = await build({ configFile: false, envFile: false, logLevel: "silent", resolve: { alias: { "@": resolve("src") } }, define: { "process.env.NODE_ENV": '"production"' }, esbuild: { jsx: "automatic" },
    build: { write: false, target: "es2022", minify: false, lib: { entry: resolve("src/test/fixtures/browser-ai-entry.tsx"), name: "carbonShiftAiTest", formats: ["iife"] } } });
  const outputs = Array.isArray(built) ? built : [built]; const chunk = outputs.flatMap((out) => "output" in out ? out.output : []).find((file) => file.type === "chunk");
  if (!chunk || chunk.type !== "chunk") throw new Error("Missing test-only browser harness"); browserCode = chunk.code;
});
test.beforeEach(async ({ page, request }) => {
  // Keep production styles, but mount the authored harness without a competing
  // Next root that can replace its DOM during late landing-page hydration.
  const response = await request.get("/");
  const styles = ((await response.text()).match(/<link\b[^>]*>/g) ?? []).filter((link) => link.includes('rel="stylesheet"')).join("");
  await page.route("**/__authored-ai-fixture", (route) => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="en-GB"><head><title>CarbonShift authored AI test fixture</title>${styles}</head><body><main class="shell planner-width"><h1>Authored AI test fixture</h1><div id="ai-test-root"></div></main></body></html>` }));
  await page.goto("/__authored-ai-fixture");
  await page.addScriptTag({ content: browserCode });
});
test("source-backed suggestions need consent, review and editable manual fields", async ({ page }, testInfo) => {
  await page.evaluate(() => window.carbonShiftAiTest.renderFixture("success"));
  await page.getByText("Describe your timing", { exact: false }).click(); await page.getByLabel("Your timing request").fill("Tomorrow finish by noon.");
  await expect(page.getByRole("button", { name: "Suggest timing fields" })).toBeDisabled();
  await page.getByRole("checkbox", { name: /I agree to send/ }).check(); await page.getByRole("button", { name: "Suggest timing fields" }).click();
  await page.getByText("Supporting text", { exact: true }).click(); await expect(page.locator("q")).toHaveText("Tomorrow finish by noon");
  await expect(page.getByRole("button", { name: "Apply checked suggestions" })).toBeDisabled(); await expect(page.locator("#deadline-time")).toHaveValue("");
  await page.getByRole("checkbox", { name: /I checked these suggestions/ }).check(); await page.getByRole("button", { name: "Apply checked suggestions" }).click();
  await expect(page.locator("#deadline-time")).toHaveValue("12:00"); await expect(page.getByLabel("Estimated cycle energy (kWh)")).toHaveValue("0.875");
  await page.screenshot({ path: testInfo.outputPath("ai-assistance.png"), fullPage: true });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => { document.documentElement.style.zoom = "1"; });
  await page.locator("#deadline-time").fill("12:30"); await page.getByRole("button", { name: /Review constraints/ }).click(); await expect(page.getByRole("status").filter({ hasText: "Manual constraints ready for explicit confirmation." })).toBeVisible();
  expect(await page.evaluate(() => window.carbonShiftAiTest.callCount())).toBe(1);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
});
test("quota and unavailable states preserve manual input and use real retry countdown", async ({ page }) => {
  await page.evaluate(() => window.carbonShiftAiTest.renderFixture("limited")); await page.getByText("Describe your timing", { exact: false }).click();
  await page.getByLabel("Your timing request").fill("Tomorrow finish by noon."); await page.getByRole("checkbox", { name: /I agree to send/ }).check(); await page.getByRole("button", { name: "Suggest timing fields" }).click();
  await expect(page.getByRole("alert")).toContainText("manual fields are ready"); await expect(page.getByRole("button", { name: "Start a new AI request" })).toBeDisabled();
  await expect(page.getByLabel("Your timing request")).toHaveValue("Tomorrow finish by noon."); await expect(page.getByLabel("Estimated cycle energy (kWh)")).toHaveValue("0.875");
  await expect(page.getByRole("button", { name: "Start a new AI request" })).toBeEnabled({ timeout: 5000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("pending explanation leaves the computed reason and next action available", async ({ page }) => {
  await page.evaluate(() => window.carbonShiftAiTest.renderFixture("pending-explanation")); await page.getByText("Ask AI to select the key reasons").click();
  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Explain this comparison" }).click();
  await expect(page.getByRole("button", { name: "Selecting reasons…" })).toBeDisabled(); await expect(page.getByRole("button", { name: "Review this plan" })).toBeEnabled(); await expect(page.getByText(/lower forecast estimate than your reviewed baseline/)).toBeVisible();
});
test("provider outage keeps the manual flow usable at 200 percent zoom", async ({ page }) => {
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await page.evaluate(() => window.carbonShiftAiTest.renderFixture("unavailable")); await page.getByText("Describe your timing", { exact: false }).click();
  await page.getByLabel("Your timing request").fill("Tomorrow finish by noon."); await page.getByRole("checkbox", { name: /I agree to send/ }).check(); await page.getByRole("button", { name: "Suggest timing fields" }).click();
  await expect(page.getByRole("alert")).toContainText("manual fields are kept here");
  await page.locator("#deadline-date").fill("2026-10-23"); await page.locator("#deadline-time").fill("12:00");
  await page.getByRole("button", { name: /Review constraints/ }).click(); await expect(page.getByRole("status")).toHaveText("Manual constraints ready for explicit confirmation.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
