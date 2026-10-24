import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("T01/T03/T06/T07 authored demo completes the reviewed manual flow without network mutations", async ({ page }, testInfo) => {
  const mutations: string[] = [], errors: string[] = [];
  page.on("request", (request) => { if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) mutations.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo");
  await page.getByText("Try the earlier washing planner", { exact: true }).click();
  await page.getByText("Explore a household day", { exact: true }).click();
  await expect(page.getByText("Illustrative example", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Review constraints" }).click();
  await expect(page.getByRole("button", { name: "Compare times" })).toBeDisabled();
  await page.getByRole("checkbox", { name: /I confirm the duration/ }).check();
  await page.getByRole("button", { name: "Compare times" }).click();
  await expect(page.getByRole("heading", { name: "Find the time that fits." })).toBeFocused();
  await expect(page.getByText("200 g lower forecast estimate", { exact: false })).toBeVisible();
  await page.getByText("View accessible forecast table", { exact: false }).click();
  await expect(page.locator(".legacy-demo").getByRole("table")).toBeVisible();
  await expect(page.getByRole("cell", { name: "100", exact: true })).toBeVisible();
  await page.getByText("Other feasible times", { exact: false }).click();
  await expect(page.getByText("These alternatives are shown for context.", { exact: false })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`comparison-${testInfo.project.name}.png`), fullPage: true });
  await page.getByRole("button", { name: "Review this plan" }).click();
  await expect(page.getByRole("button", { name: "Preview example plan" })).toBeDisabled();
  await page.getByRole("checkbox", { name: /I’ve reviewed the exact baseline/ }).check();
  await page.getByRole("button", { name: "Preview example plan" }).click();
  await expect(page.getByRole("heading", { name: "Your example plan preview." })).toBeVisible();
  await expect(page.getByText("Nothing was saved or published.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Reset example" }).click();
  await expect(page.getByLabel("Estimated cycle energy (kWh)")).toHaveValue("1");
  expect(mutations).toEqual([]);expect(errors).toEqual([]);
});

test("T03 manual form keeps invalid inputs and explains impossible windows", async ({ page }, testInfo) => {
  await page.goto("/demo");
  await page.getByText("Try the earlier washing planner", { exact: true }).click();
  await page.getByText("Explore a household day", { exact: true }).click();
  await page.getByLabel("Estimated cycle energy (kWh)").fill("1.0001");
  await page.getByRole("button", { name: "Review constraints" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Check these details" })).toContainText("three decimal");
  await expect(page.getByLabel("Estimated cycle energy (kWh)")).toHaveValue("1.0001");
  await expect(page.locator("#input-errors")).toBeFocused();
  await page.getByLabel("Estimated cycle energy (kWh)").fill("1");
  await page.locator("#deadline-time").fill("08:30");
  await page.getByRole("button", { name: "Review constraints" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Check these details" })).toContainText("No complete cycle");
  await expect(page.locator("#deadline-time")).toHaveValue("08:30");
  await page.getByRole("button", { name: "Reset example" }).click();
  await page.getByRole("button", { name: "Add blocked period" }).click();
  await expect(page.getByRole("heading", { name: "Blocked period 1" })).toBeVisible();
  await page.getByRole("button", { name: "Remove blocked period 1" }).click();
  await expect(page.getByRole("button", { name: "Add blocked period" })).toBeFocused();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`planner-${testInfo.project.name}.png`), fullPage: true });
});

test("T01/T03/T07 keyboard alone can review, compare and preview the example", async ({ page }) => {
  await page.goto("/demo");
  await page.getByText("Try the earlier washing planner", { exact: true }).click();
  await page.getByText("Explore a household day", { exact: true }).click();
  async function tabTo(target: ReturnType<typeof page.getByRole>) {
    for (let i = 0; i < 80; i++) { if (await target.evaluate((node) => node === document.activeElement)) return;await page.keyboard.press("Tab"); }
    throw new Error("Keyboard target was not reachable");
  }
  await tabTo(page.getByLabel("Estimated cycle energy (kWh)"));await page.keyboard.press("ControlOrMeta+A");await page.keyboard.type("0.875");
  await tabTo(page.getByRole("button", { name: "Review constraints" }));await page.keyboard.press("Enter");
  await tabTo(page.getByRole("checkbox", { name: /I confirm the duration/ }));await page.keyboard.press("Space");
  await tabTo(page.getByRole("button", { name: "Compare times" }));await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Find the time that fits." })).toBeFocused();
  await tabTo(page.getByRole("button", { name: "Review this plan" }));await page.keyboard.press("Enter");
  await tabTo(page.getByRole("checkbox", { name: /I’ve reviewed the exact baseline/ }));await page.keyboard.press("Space");
  await tabTo(page.getByRole("button", { name: "Preview example plan" }));await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Your example plan preview." })).toBeFocused();
});

test("T06 a baseline already at the minimum does not claim improvement", async ({ page }) => {
  await page.goto("/demo");
  await page.getByText("Try the earlier washing planner", { exact: true }).click();
  await page.getByText("Explore a household day", { exact: true }).click();await page.locator("#baseline-kind").selectOption("user_selected");
  await page.locator("#baseline-date").fill("2026-10-21");await page.locator("#baseline-time").fill("10:00");
  await page.getByRole("button", { name: "Review constraints" }).click();await page.getByRole("checkbox", { name: /I confirm the duration/ }).check();
  await page.getByRole("button", { name: "Compare times" }).click();
  await expect(page.getByText("No estimated improvement over your baseline.", { exact: true })).toBeVisible();
  await expect(page.getByText(/% lower/)).toHaveCount(0);
  await page.setViewportSize({ width: 720, height: 500 });await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
