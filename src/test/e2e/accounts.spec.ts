import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("T02 account page names both providers, keeps unavailable states honest and fits the viewport", async ({ page }, testInfo) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A better time, on your terms.");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Account services are unavailable");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`accounts-${testInfo.project.name}.png`), fullPage: true });
  await page.getByRole("link", { name: "Back to CarbonShift" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/");
});
test("T02 login errors use approved copy and private routes stay protected", async ({ page, request }) => {
  await page.goto("/login?error=sign_in_failed&error_description=private-canary");
  await expect(page.getByRole("alert").filter({ hasText: "Sign-in wasn’t completed" })).toContainText("Sign-in wasn’t completed");
  await expect(page.getByText("private-canary", { exact: true })).toHaveCount(0);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  const response = await request.get("/api/v1/plans");
  expect(response.status()).toBe(503);
  expect((await response.json()).error.code).toBe("DATABASE_UNAVAILABLE");
});
