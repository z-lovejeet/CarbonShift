import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { build } from "vite";
import { GB_UNIFORM_V1_FIXTURE as fixture } from "../../fixtures/demo/gb-uniform-v1";
import { createComparison } from "../../domain/scheduling";

declare global {
  interface Window { carbonShiftTest: typeof import("../fixtures/browser-domain-entry") }
}

test.use({ timezoneId: "Asia/Kolkata" });
let browserCode: string;
test.beforeAll(async () => {
  const built = await build({
    configFile: false, envFile: false, logLevel: "silent",
    build: { write: false, target: "es2022", minify: false, lib: { entry: resolve("src/test/fixtures/browser-domain-entry.ts"), name: "carbonShiftTest", formats: ["iife"] } },
  });
  const outputs = Array.isArray(built) ? built : [built];
  const chunk = outputs.flatMap((output) => "output" in output ? output.output : []).find((file) => file.type === "chunk");
  if (!chunk || chunk.type !== "chunk") throw new Error("No executable browser domain bundle produced");
  browserCode = chunk.code;
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.addScriptTag({ content: browserCode });
});

test("London time and DST remain explicit in a real India-timezone browser", async ({ page }) => {
  const result = await page.evaluate(() => {
    const { resolveLondonTime, londonTime } = window.carbonShiftTest;
    const earlier = resolveLondonTime({ date: "2026-10-25", time: "01:30", offsetChoice: "earlier" });
    const later = resolveLondonTime({ date: "2026-10-25", time: "01:30", offsetChoice: "later" });
    let gapCode: unknown;
    try { resolveLondonTime({ date: "2026-03-29", time: "01:30" }); }
    catch (error) { gapCode = (error as { code: string }).code; }
    return { hostZone: Intl.DateTimeFormat().resolvedOptions().timeZone, earlier, later, local: londonTime(earlier), gapCode };
  });
  expect(result.hostZone).toMatch(/^Asia\/(Calcutta|Kolkata)$/);
  expect(result.earlier).toBe("2026-10-25T00:30:00Z"); expect(result.later).toBe("2026-10-25T01:30:00Z");
  expect(result.local).toEqual({ date: "2026-10-25", time: "01:30", offset: "+01:00", timezone: "Europe/London" });
  expect(result.gapCode).toBe("NONEXISTENT_LOCAL_TIME");
});

test("browser and server reproduce the same authored comparison", async ({ page }) => {
  const input = { constraints: fixture.constraints, snapshot: fixture.snapshot, forecastSnapshotId: fixture.snapshotReference.id, forecastSnapshotHash: fixture.snapshotReference.hash };
  const browserResult = await page.evaluate(({ input, nowUtc }) => window.carbonShiftTest.createComparison(input, nowUtc), { input, nowUtc: fixture.nowUtc });
  expect(browserResult).toEqual(createComparison(input, fixture.nowUtc));
});
