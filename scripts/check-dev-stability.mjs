import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";
import { URL } from "node:url";
import { chromium } from "@playwright/test";

// Observe the actual development HMR connection without accounts or mutations.
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3001");
assert(["127.0.0.1", "localhost"].includes(origin.hostname), "Use a local development server.");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  let documentLoads = 0;
  let reloadMessages = 0;
  let builds = 0;
  let runtimeErrors = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) documentLoads++;
  });
  page.on("pageerror", () => runtimeErrors++);
  page.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => {
    let message;
    try { message = JSON.parse(String(payload)); } catch { return; }
    if (message.type === "reloadPage") reloadMessages++;
    if (message.type === "building") builds++;
  }));
  // Finish initial route compilation before observing an untouched page.
  const response = await page.goto(origin.href, { waitUntil: "domcontentloaded" });
  assert(response?.ok(), "The local page must load successfully before checking stability.");
  await page.locator("h1").first().waitFor({ state: "visible" });
  await wait(2000);
  documentLoads = reloadMessages = builds = runtimeErrors = 0;
  await wait(10000);
  const result = { idleSeconds: 10, documentLoads, reloadMessages, builds, runtimeErrors };
  console.log(JSON.stringify(result));
  assert.equal(documentLoads, 0, "The idle page navigated without user input.");
  assert.equal(reloadMessages, 0, "The development server requested an idle reload.");
  assert.equal(builds, 0, "The development server rebuilt an untouched page.");
  assert.equal(runtimeErrors, 0, "The idle page raised a runtime error.");
} finally {
  await browser.close();
}
