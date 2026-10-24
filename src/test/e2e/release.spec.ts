import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("native same-origin forms retain the Origin required by OAuth protection", async ({ page, request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  let origin: string | undefined;
  await page.route("**/__authored-form-check", (route) => route.fulfill({
    contentType: "text/html", headers: { "Referrer-Policy": headers["referrer-policy"]!, "Content-Security-Policy": headers["content-security-policy"]! },
    body: '<!doctype html><html lang="en"><title>Authored form check</title><form action="/__authored-form-result" method="post"><button>Submit fixture</button></form></html>',
  }));
  await page.route("**/__authored-form-result", (route) => {
    origin = route.request().headers().origin;
    return route.fulfill({ contentType: "text/html", body: "<title>Fixture received</title><p>Fixture received</p>" });
  });
  await page.goto("/__authored-form-check");
  await page.getByRole("button", { name: "Submit fixture" }).click();
  await expect(page.getByText("Fixture received")).toBeVisible();
  expect(origin).toBe(new URL(response.url()).origin);
});

test("release reading and verification pages remain accessible and fit the viewport", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of ["/methodology", "/privacy", "/verify"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("production responses protect browser boundaries and internal maintenance", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("worker-src 'self' blob:");
  expect(headers["content-security-policy"]).not.toContain("unsafe-eval");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  const maintenance = await request.get("/api/internal/maintenance");
  expect([401, 503]).toContain(maintenance.status());
  expect(await maintenance.text()).not.toContain("cs_retention");
});
