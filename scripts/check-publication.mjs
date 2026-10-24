/* global URL, document, innerWidth, structuredClone */
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { createPublicClient, http, parseEventLogs } from "viem";
import { sepolia } from "viem/chains";
import { testAccounts } from "./lib/test-accounts.mjs";
import { SHIFT_RECEIPT_ABI_V1 as abi } from "../src/generated/shift-receipt-v1.ts";
import { chainObservationSchema, importProofBundle, verifyProofBundle } from "../src/domain/proof.ts";

// Explicit real development/testnet check. Authored appliance assumptions, real forecast,
// real account/API/worker/chain. The outcome is a cancellation, never simulated appliance operation.
const accounts = testAccounts(), browser = await chromium.launch(), contexts = [];
let worker, stage = "temporary members", cleanupPassed = false;
const evidence = { checkedAtUtc: new Date().toISOString(), basis: "Real development Auth/database, national forecast, ordinary publication UI/API and dedicated Sepolia worker. Authored 875 Wh assumption; no appliance operated; cancellation has no numeric benefit." };
const london = (stamp) => Object.fromEntries(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(stamp)).map((p) => [p.type,p.value]));
const payload = async (response) => { const json = await response.json(); if (!response.ok()) throw new Error(`HTTP ${response.status()}: ${json.error?.code ?? "unavailable"}`); return json.data; };
const integer = (value) => { const n = Number(value); if (!Number.isSafeInteger(n)) throw new Error("Unsafe chain integer."); return n; };
async function confirmed(context, operationId) {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    const op = await payload(await context.request.get(`/api/v1/operations/${operationId}`));
    if (op.status === "confirmed") return op;
    if (op.status === "failed") throw new Error(`Publication failed: ${op.failureCode}`);
    await setTimeout(3000);
  }
  throw new Error("Confirmation wait expired; original operation must be reconciled.");
}
try {
  const member = await accounts.member(), foreign = await accounts.member();
  const context = await browser.newContext({ baseURL: accounts.origin, viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Kolkata" }); contexts.push(context); await context.addCookies(member.cookies);
  const other = await browser.newContext({ baseURL: accounts.origin }); contexts.push(other); await other.addCookies(foreign.cookies);
  const page = await context.newPage(); page.setDefaultTimeout(45000); const errors = []; page.on("pageerror", () => errors.push("browser_error"));
  stage = "manual real-data plan while worker is offline";
  await page.goto("/app/plan/new");
  const first = Math.ceil((Date.now()+7200000)/1800000)*1800000;
  for (const [field, stamp] of [["earliest",first],["deadline",first+21600000]]) { const p = london(stamp); await page.locator(`#${field}-date`).fill(`${p.year}-${p.month}-${p.day}`); await page.locator(`#${field}-time`).fill(`${p.hour}:${p.minute}`); }
  await page.getByLabel("Estimated cycle energy (kWh)").fill("0.875");
  await page.getByRole("button", { name: "Review constraints" }).click(); await page.getByRole("checkbox", { name: /I confirm the duration/ }).check(); await page.getByRole("button", { name: "Compare times" }).click(); await page.getByRole("button", { name: "Review this plan" }).click(); await page.getByRole("checkbox", { name: /I’ve reviewed the exact baseline/ }).check();
  const save = page.waitForResponse((r) => new URL(r.url()).pathname==="/api/v1/plans" && r.request().method()==="POST"); await page.getByRole("button", { name: "Save this plan", exact: true }).click(); const plan = await payload(await save);
  await expect(page).toHaveURL(`/app/plans/${plan.id}`); stage = "exact preview and consent";
  await page.getByRole("button", { name: "Review publication", exact: true }).click();
  const consent = page.getByRole("checkbox", { name: "I reviewed this exact public copy and consent to its lasting disclosure." }); await expect(consent).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Publish this exact copy" })).toBeDisabled(); await consent.check();
  const queueResponse = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith(`/${plan.id}/publication`) && r.request().method()==="POST"); await page.getByRole("button", { name: "Publish this exact copy" }).click(); const queue = await queueResponse, ack = await payload(queue);
  const retryBody = queue.request().postDataJSON(), retryKey = queue.request().headers()["idempotency-key"];
  expect((await payload(await context.request.get(`/api/v1/operations/${ack.operationId}`))).status).toBe("queued");
  expect((await other.request.get(`/api/v1/operations/${ack.operationId}`)).status()).toBe(404);
  expect((await other.request.get(`/api/v1/plans/${plan.id}/publication/bundle`)).status()).toBe(404);
  expect((await context.request.post(`/api/v1/plans/${plan.id}/publication`, { headers: { Origin: accounts.origin, "Idempotency-Key": "missing-consent-case" }, data: { ...retryBody, consent: false } })).status()).toBe(422);
  evidence.workerOfflinePlanningAndQueue = true;
  stage = "real worker plan transaction";
  worker = spawn(process.execPath, ["--import","tsx","src/worker/ledger.ts"], { env: { PATH: process.env.PATH, HOME: process.env.HOME }, stdio: ["ignore","pipe","pipe"] });
  worker.stdout.on("data", () => {}); worker.stderr.on("data", () => {});
  const planOperation = await confirmed(context, ack.operationId);
  const replay = await payload(await context.request.post(`/api/v1/plans/${plan.id}/publication`, { headers: { Origin: accounts.origin, "Idempotency-Key": retryKey }, data: retryBody })); expect(replay).toEqual(ack);
  stage = "cancel after confirmed commitment; separately disclose non-execution";
  await page.reload(); await page.getByText("Cancel this plan", { exact:true }).click(); await page.getByLabel("Why are you cancelling?").fill("Explicit integration check: no appliance was operated.");
  const cancelled = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/cancel") && r.request().method()==="POST"); await page.getByRole("button", { name: "Confirm cancellation" }).click(); await payload(await cancelled); await page.reload();
  await expect(page.getByText(/Unpublished changes/)).toBeVisible();
  await page.getByLabel("Explanation to make public (optional)").fill("Integration test: the wash did not run. No emissions benefit is claimed.");
  await page.getByRole("button", { name: "Review result publication" }).click(); await page.getByRole("checkbox", { name: "I reviewed this exact public copy and consent to its lasting disclosure." }).check();
  const resultResponse = page.waitForResponse((r) => /\/results\/1\/publication$/.test(new URL(r.url()).pathname) && r.request().method()==="POST"); await page.getByRole("button", { name: "Publish this exact copy" }).click(); const resultQueued = await resultResponse, resultAck = await payload(resultQueued);
  const resultOperation = await confirmed(context,resultAck.operationId); await page.reload();
  const resultReplay = await payload(await context.request.post(`/api/v1/plans/${plan.id}/results/1/publication`, { headers: { Origin: accounts.origin, "Idempotency-Key": resultQueued.request().headers()["idempotency-key"] }, data: resultQueued.request().postDataJSON() })); expect(resultReplay).toEqual(resultAck);
  stage = "export and independent actual-chain verification";
  const exported = await context.request.get(`/api/v1/plans/${plan.id}/publication/bundle`); expect(exported.status()).toBe(200); const text = await exported.text(), bundle = importProofBundle(text);
  expect(bundle.results[0].resultStatus).toBe("did_not_run"); expect(bundle.results[0].differenceMg).toBeNull();
  const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL, { timeout: 10000, retryCount: 0 }) }), address = bundle.plan.contractAddress, receiptId = bundle.plan.receiptId;
  const readEvent = async (hash, name) => {
    const r = await client.getTransactionReceipt({ hash }), block = await client.getBlock({ blockNumber:r.blockNumber }); expect(block.hash).toBe(r.blockHash); expect(await client.getBlockNumber({ cacheTime:0 })).toBeGreaterThanOrEqual(r.blockNumber+2n);
    const event = parseEventLogs({ abi, eventName:name, logs:r.logs.filter((l)=>l.address.toLowerCase()===address) })[0]; if (!event) throw new Error("Expected chain event absent.");
    return { ...event.args, issuer:event.args.issuer.toLowerCase(), transactionHash:hash, blockHash:r.blockHash, blockNumber:integer(r.blockNumber), blockTimestamp:integer(block.timestamp), logIndex:event.logIndex };
  };
  const record = await client.readContract({ address, abi, functionName:"getReceipt", args:[receiptId] }), owner = await client.readContract({ address, abi, functionName:"owner" });
  const commit = await readEvent(bundle.chainReferences.planTransactionHash,"PlanCommitted"); commit.commitBefore=integer(commit.commitBefore); commit.committedAt=integer(commit.committedAt);
  const resultEvents = []; for (const hash of bundle.chainReferences.resultTransactionHashes) resultEvents.push(await readEvent(hash,"ResultAppended"));
  const observation = chainObservationSchema.parse({ chainId:await client.getChainId(), contractAddress:address, currentOwner:owner.toLowerCase(), receipt:{ ...record, receiptId, initialIssuer:record.initialIssuer.toLowerCase(), commitBefore:integer(record.commitBefore), committedAt:integer(record.committedAt) }, commit, results:resultEvents });
  stage = "seven independent verification checks";
  const verification = verifyProofBundle(bundle, { expectedChainId:11155111, expectedContractAddress:address, chain:observation });
  for (const [name,check] of Object.entries(verification.checks)) expect(check.state,`${name}: ${check.detail}`).toBe("match");
  stage = "tampered active baseline factor";
  const tampered=structuredClone(bundle), factor= tampered.plan.forecastSnapshot.intervals.find((i)=>i.fromUtc===tampered.plan.baseline.startUtc);
  if(!factor || factor.forecastGPerKwh===null)throw new Error("Baseline interval absent.");factor.forecastGPerKwh++;
  const invalid=verifyProofBundle(tampered,{expectedChainId:11155111,expectedContractAddress:address,chain:observation}); expect(invalid.checks.planIntegrity.state).toBe("mismatch"); expect(invalid.checks.calculation.state).toBe("mismatch");
  stage="responsive publication screen";
  expect((await new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({path:"test-results/live-publication-desktop.png",fullPage:true}); await page.setViewportSize({width:360,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); await page.screenshot({path:"test-results/live-publication-mobile.png",fullPage:true}); expect(errors).toEqual([]);
  await mkdir("research/phase-9",{recursive:true}); await writeFile("research/phase-9/live-proof-bundle.json",text); await writeFile("research/phase-9/live-chain-observation.json",JSON.stringify(observation,null,2)+"\n");
  evidence.publication={receiptId,planOperation,resultOperation,exactRetryAcknowledged:true,ownerIsolation:true,explicitConsentEnforced:true,cancellationNoNumericBenefit:true,verification,tamperingDetected:true,axeViolations:0,browserErrors:0,responsive:true};
  console.log(`Real publication confirmed: ${receiptId}. Plan and non-run result independently verified against Sepolia.`);
} catch { console.error(`Publication integration failed at: ${stage}. Details/credentials omitted; reconcile existing operations before retrying.`); process.exitCode=1; }
finally {
  if(worker){worker.kill("SIGTERM");await Promise.race([new Promise((resolve)=>worker.once("exit",resolve)),setTimeout(15000)]);}
  for(const context of contexts)await context.close();await browser.close();
  try{await accounts.cleanup();cleanupPassed=true;console.log("Temporary accounts removed; consented public evidence retained with account links cleared.");}catch{console.error("Fixture cleanup requires review.");process.exitCode=1;}
  if(!process.exitCode){await writeFile("research/phase-9/live-publication.json",JSON.stringify({...evidence,cleanupPassed},null,2)+"\n");}
}
