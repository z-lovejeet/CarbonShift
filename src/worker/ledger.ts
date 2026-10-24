import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { config } from "dotenv";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { getWorkerEnvironment } from "./env";
import { createLedgerStore } from "./store";
import { createLedgerChain } from "./chain";
import { createLedgerProcessor } from "./processor";

// Load only the worker environment. No private key is loaded by the web entry point.
config({ path: ".env.worker.local", quiet: true });
const allowed = new Set(["--once", "--reconcile-only"]);
if (process.argv.slice(2).some((arg) => !allowed.has(arg))) throw new Error("Use --once and/or --reconcile-only.");
const environment = getWorkerEnvironment(), signer = privateKeyToAccount(environment.privateKey as Hex).address;
const store = createLedgerStore(environment, signer, randomUUID());
const tick = createLedgerProcessor(store, createLedgerChain(environment), environment.contractAddress);
const stopping = new AbortController();
process.once("SIGINT", () => stopping.abort()); process.once("SIGTERM", () => stopping.abort());
do {
  try { console.log(`Ledger worker: ${await tick(process.argv.includes("--reconcile-only"))}.`); }
  catch { console.error("Ledger worker: check failed; no confirmation claimed. Credentials and provider details omitted."); if (process.argv.includes("--once")) process.exitCode = 1; }
  if (process.argv.includes("--once") || stopping.signal.aborted) break;
  try { await setTimeout(10000, undefined, { signal: stopping.signal }); } catch { break; }
} while (!stopping.signal.aborted);
