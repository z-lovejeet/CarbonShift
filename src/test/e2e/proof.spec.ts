import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { build } from "vite";
import { exportProofBundle, verifyProofBundle } from "../../domain/proof";
import { proofBundle } from "../fixtures/proof/bundle";
import { proofObservation } from "../fixtures/proof/observation";
import digests from "../fixtures/proof/golden-digests.json" with { type: "json" };

declare global { interface Window { carbonShiftProof: typeof import("../fixtures/browser-proof-entry") } }
test.use({ timezoneId: "Asia/Kolkata" });
let browserCode: string;
test.beforeAll(async () => {
  const built = await build({ configFile: false, envFile: false, logLevel: "silent", build: { write: false, target: "es2022", minify: false, lib: { entry: resolve("src/test/fixtures/browser-proof-entry.ts"), name: "carbonShiftProof", formats: ["iife"] } } });
  const output = (Array.isArray(built) ? built : [built]).flatMap((item) => "output" in item ? item.output : []).find((file) => file.type === "chunk");
  if (!output || output.type !== "chunk") throw new Error("Missing executable proof browser bundle."); browserCode = output.code;
});
test("M08 browser/server agree on golden hashes, offline calculation and trusted observations", async ({ page }) => {
  await page.goto("/"); await page.addScriptTag({ content: browserCode });
  const bundle = proofBundle(), text = exportProofBundle(bundle), context = proofObservation(bundle);
  const result = await page.evaluate(({ text, context }) => {
    const api = window.carbonShiftProof, bundle = api.importProofBundle(text);
    const reversedPlan = Object.fromEntries(Object.entries(bundle.plan).reverse());
    return { planHash: api.hashPlan(reversedPlan), resultHashes: bundle.results.map(api.hashResult), methodHash: api.hashMethod(bundle.method), exported: api.exportProofBundle(bundle), offline: api.verifyProofBundle(bundle), observed: api.verifyProofBundle(bundle, context) };
  }, { text, context });
  expect(result.planHash).toBe(digests.planHash); expect(result.resultHashes).toEqual(digests.resultHashes); expect(result.methodHash).toBe(digests.methodHash);
  expect(result.exported).toBe(text); expect(result.offline).toEqual(verifyProofBundle(bundle)); expect(result.observed).toEqual(verifyProofBundle(bundle, context));
});
