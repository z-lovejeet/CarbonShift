import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("shell is responsive, honest about availability and keyboard accessible", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle("CarbonShift");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Same routine\.\s*Better timing\./);
  await expect(page.getByText("Current grid context is unavailable.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore an activity" }).first()).toHaveAttribute("href", "/app/simulate");
  await expect(page.getByRole("link", { name: "See an example" })).toHaveAttribute("href", "/demo");
  await expect(page.locator("#activities > ul > li")).toHaveCount(12);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  const firstWorkspace = page.getByRole("tab", { name: /One activity/ });
  await firstWorkspace.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /A few tasks/ })).toBeFocused();
  await expect(page.getByRole("tabpanel").getByRole("link")).toHaveAttribute("href", "/app/plan/new");
  await page.keyboard.press("End");
  await expect(page.getByRole("tabpanel").getByRole("link")).toHaveAttribute("href", "/app/day/new");
  const summary = page.locator("summary").filter({ hasText: "Will changing time use less electricity?" });
  await summary.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("details").filter({ has: summary })).toHaveAttribute("open", "");
  await expect(page.getByText("A timing-only comparison keeps energy", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.getByRole("link", { name: "Explore an activity" }).first().evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
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
