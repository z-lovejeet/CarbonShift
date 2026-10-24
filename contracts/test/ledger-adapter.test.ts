import assert from "node:assert/strict";
import { test } from "node:test";
import { network } from "hardhat";
import { hashPlan, hashResult } from "../../src/domain/proof.ts";
import { proofBundle } from "../../src/test/fixtures/proof/bundle.ts";
import { createLedgerChain } from "../../src/worker/chain.ts";
import type { LedgerJob } from "../../src/worker/contracts.ts";
import type { Hex } from "viem";

// Public Hardhat development key only. Never a configured wallet or network credential.
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
test("M09 real adapter signs, broadcasts and reconciles local-EVM plan/result with two-block confirmation", async () => {
  const connection = await network.create("proof");
  try {
    const client = await connection.viem.getPublicClient(), clock = await connection.viem.getTestClient();
    const [owner] = await connection.viem.getWalletClients();
    const contract = await connection.viem.deployContract("ShiftReceipt", [owner.account.address]);
    const bundle = proofBundle(contract.address.toLowerCase());
    const chain = createLedgerChain({ databaseUrl: "https://fixture.invalid", databaseSecretKey: "isolated-fixture", rpcUrl: "http://127.0.0.1:1", chainId: 11155111, contractAddress: contract.address.toLowerCase(), deploymentBlock: 0, privateKey: TEST_KEY }, client);
    await chain.verify();
    const job: LedgerJob = { id: "1823f89d-e975-4e06-861e-59900c4df93c", kind: "plan", plan: bundle.plan, results: [], expectedHash: hashPlan(bundle.plan), transactionHash: null, blockHash: null };
    const signed = await chain.sign(job);
    await chain.broadcast(job, signed);
    assert.equal((await chain.inspect(job, signed)).status, "submitted");
    await clock.mine({ blocks: 2 });
    const confirmed = await chain.inspect(job, signed); assert.equal(confirmed.status, "confirmed");
    const hash = signed.hash as Hex; assert.equal((await client.getTransactionReceipt({ hash })).status, "success");
    const resultJob: LedgerJob = { ...job, kind: "result", results: [bundle.results[0]!], expectedHash: hashResult(bundle.results[0]!) };
    const resultSigned = await chain.sign(resultJob); assert.equal(resultSigned.nonce, signed.nonce + 1);
    await chain.broadcast(resultJob, resultSigned); await clock.mine({ blocks: 2 });
    assert.equal((await chain.inspect(resultJob, resultSigned)).status, "confirmed");
    await assert.rejects(() => chain.broadcast({ ...job, expectedHash: "0x" + "a".repeat(64) }, signed));
    assert.equal((await chain.inspect({ ...job, blockHash: "0x" + "b".repeat(64) }, signed)).code, "REORGANIZED");
  } finally { await connection.close(); }
});
