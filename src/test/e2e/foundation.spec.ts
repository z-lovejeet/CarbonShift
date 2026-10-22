import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("shell is responsive, honest about availability and keyboard accessible", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle("CarbonShift");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Better timing starts with your day.");
  await expect(page.getByText("Live planning uses Great Britain’s national grid signal.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Plan a wash" })).toHaveAttribute("href", "/app/plan/new");
  await expect(page.getByRole("link", { name: "Try the example" })).toHaveAttribute("href", "/demo");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByRole("link", { name: "Explore the approach" }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  const summary = page.locator(".estimate-note > summary");
  await summary.focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".estimate-note")).toHaveAttribute("open", "");
  await expect(page.getByText("It means a lower estimate", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.locator(".primary-link").evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(errors).toEqual([]);
  await page.goto("/");
  await page.screenshot({ path: testInfo.outputPath(`foundation-${testInfo.project.name}.png`), fullPage: true });
});

test("public health is liveness only and does not reveal environment details", async ({ request }) => {
  const response = await request.get("/api/v1/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(["data", "requestId"]);
  expect(body.data).toEqual({ status: "ok" });
});

test("unknown routes return a useful 404 with a working home link", async ({ page }) => {
  const response = await page.goto("/missing-foundation-check");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page isn’t here.");
  await page.getByRole("link", { name: "Return home", exact: true }).click();
  await expect(page).toHaveURL("/");
});
