import assert from "node:assert/strict";
import { test } from "node:test";
import { network } from "hardhat";
import { getContract, type Hex } from "viem";
import { SHIFT_RECEIPT_ABI_V1 as abi } from "../../src/generated/shift-receipt-v1.ts";
import { activityProofBundle } from "../../src/test/fixtures/proof/activity-bundle.ts";
import { hashPlanV2, hashResultV2 } from "../../src/domain/proof/v2/canonical.ts";
import { verifyBundleV2 } from "../../src/domain/proof/v2/verifier.ts";
import { epochSeconds } from "../../src/domain/time.ts";
test("v2 household plan and result reuse the existing receipt contract", async () => {
  const connection = await network.create("proof");
  try { const client = await connection.viem.getPublicClient(), clock = await connection.viem.getTestClient(), [owner] = await connection.viem.getWalletClients(); assert.ok(owner); const deployed = await connection.viem.deployContract("ShiftReceipt", [owner.account.address]), contract = getContract({ address: deployed.address, abi, client: { public: client, wallet: owner } });
    const bundle = activityProofBundle(contract.address.toLowerCase()), p = bundle.plan, result = bundle.results[0]!; assert.equal(verifyBundleV2(bundle).checks.calculation.state, "match");
    const planTx = await contract.write.commitPlan([p.receiptId as Hex, hashPlanV2(p) as Hex, p.methodHash as Hex, BigInt(epochSeconds(p.commitBeforeUtc!)), false]); await client.waitForTransactionReceipt({ hash: planTx });
    await clock.setNextBlockTimestamp({ timestamp: BigInt(epochSeconds(result.resultCreatedAtUtc)) }); const resultTx = await contract.write.appendResult([p.receiptId as Hex, 1, result.previousResultHash as Hex, hashResultV2(result) as Hex]); await client.waitForTransactionReceipt({ hash: resultTx });
    const stored = await contract.read.getReceipt([p.receiptId as Hex]); assert.equal(stored.planHash, hashPlanV2(p)); assert.equal(stored.methodHash, p.methodHash); assert.equal(stored.latestResultHash, hashResultV2(result)); assert.equal(stored.latestRevision, 1);
  } finally { await connection.close(); }
});
