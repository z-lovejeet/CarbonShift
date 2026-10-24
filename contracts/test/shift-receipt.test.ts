import assert from "node:assert/strict";
import { test } from "node:test";
import { network } from "hardhat";
import { getContract, zeroAddress, zeroHash } from "viem";
import { SHIFT_RECEIPT_ABI_V1 } from "../../src/generated/shift-receipt-v1.ts";
const id = `0x${"1".repeat(64)}` as const, planHash = `0x${"2".repeat(64)}` as const, methodHash = `0x${"3".repeat(64)}` as const;
const resultA = `0x${"4".repeat(64)}` as const, resultB = `0x${"5".repeat(64)}` as const;
async function setup() {
  const connection = await network.create("proof"), { viem } = connection;
  const [owner, other, stranger] = await viem.getWalletClients(); assert.ok(owner && other && stranger);
  const deployed = await viem.deployContract("ShiftReceipt", [owner.account.address]);
  const client = await viem.getPublicClient();
  const receipt = getContract({ address: deployed.address, abi: SHIFT_RECEIPT_ABI_V1, client: { public: client, wallet: owner } });
  return { connection, viem, owner, other, stranger, receipt, client, clock: await viem.getTestClient() };
}

test("M08.04 only the owner can write; zero initial owner and payments are rejected", async () => {
  const f = await setup();
  try {
    await assert.rejects(f.viem.deployContract("ShiftReceipt", [zeroAddress]), /OwnableInvalidOwner/);
    await assert.rejects(f.receipt.write.commitPlan([id, planHash, methodHash, 0n, true], { account: f.other.account }), /OwnableUnauthorizedAccount/);
    await assert.rejects(f.receipt.write.appendResult([id, 1, zeroHash, resultA], { account: f.other.account }), /OwnableUnauthorizedAccount/);
    assert.equal((await f.receipt.read.getReceipt([id])).exists, false);
    await assert.rejects(f.owner.sendTransaction({ to: f.receipt.address, value: 1n }));
  } finally { await f.connection.close(); }
});

test("M08.04 immutable commitment emits exact fields; distinct cycles can share a window", async () => {
  const f = await setup();
  try {
    const cutoff = (await f.client.getBlock()).timestamp + 3600n;
    const hash = await f.receipt.write.commitPlan([id, planHash, methodHash, cutoff, false]);
    const mined = await f.client.waitForTransactionReceipt({ hash });
    const record = await f.receipt.read.getReceipt([id]);
    assert.equal(record.exists, true); assert.equal(record.planHash, planHash); assert.equal(record.methodHash, methodHash);
    assert.equal(record.commitBefore, cutoff); assert.equal(record.isDemo, false); assert.equal(record.latestRevision, 0); assert.equal(record.latestResultHash, zeroHash);
    const event = (await f.client.getContractEvents({ address: f.receipt.address, abi: f.receipt.abi, eventName: "PlanCommitted", fromBlock: mined.blockNumber, toBlock: mined.blockNumber, strict: true }))[0];
    assert.ok(event); assert.deepEqual(event.args, { receiptId: id, planHash, methodHash, commitBefore: cutoff, committedAt: record.committedAt, isDemo: false, issuer: record.initialIssuer });
    await assert.rejects(f.receipt.write.commitPlan([id, resultA, methodHash, cutoff, false]), /ReceiptAlreadyExists/);
    const secondId = `0x${"9".repeat(64)}` as const;
    await f.receipt.write.commitPlan([secondId, planHash, methodHash, cutoff, false]);
    assert.equal((await f.receipt.read.getReceipt([secondId])).exists, true);
    assert.deepEqual(await f.receipt.read.getReceipt([id]), record);
  } finally { await f.connection.close(); }
});

test("M08.04 rejects zero IDs/digests and invalid live/demo cutoffs including exact cutoff", async () => {
  const f = await setup();
  try {
    for (const args of [[zeroHash, planHash, methodHash], [id, zeroHash, methodHash], [id, planHash, zeroHash]] as const)
      await assert.rejects(f.receipt.write.commitPlan([...args, 0n, true]), /ZeroDigest/);
    const now = (await f.client.getBlock()).timestamp;
    await assert.rejects(f.receipt.write.commitPlan([id, planHash, methodHash, now, false]), /InvalidCutoff/);
    await assert.rejects(f.receipt.write.commitPlan([id, planHash, methodHash, 0n, false]), /InvalidCutoff/);
    await assert.rejects(f.receipt.write.commitPlan([id, planHash, methodHash, now + 100n, true]), /InvalidCutoff/);
    const cutoff = now + 30n;
    await f.clock.setNextBlockTimestamp({ timestamp: cutoff }); await f.clock.mine({ blocks: 1 });
    await assert.rejects(f.receipt.write.commitPlan([id, planHash, methodHash, cutoff, false]), /InvalidCutoff/);
    assert.equal((await f.receipt.read.getReceipt([id])).exists, false);
    await f.receipt.write.commitPlan([id, planHash, methodHash, 0n, true]);
    const demo = await f.receipt.read.getReceipt([id]); assert.equal(demo.isDemo, true); assert.equal(demo.commitBefore, 0n);
  } finally { await f.connection.close(); }
});

test("M08.04 revisions are consecutive, hash linked, nonzero and append only", async () => {
  const f = await setup();
  try {
    await assert.rejects(f.receipt.write.appendResult([id, 1, zeroHash, resultA]), /ReceiptNotFound/);
    await f.receipt.write.commitPlan([id, planHash, methodHash, 0n, true]);
    await assert.rejects(f.receipt.write.appendResult([id, 1, zeroHash, zeroHash]), /ZeroDigest/);
    await assert.rejects(f.receipt.write.appendResult([id, 0, zeroHash, resultA]), /InvalidRevision/);
    await assert.rejects(f.receipt.write.appendResult([id, 2, zeroHash, resultA]), /InvalidRevision/);
    await assert.rejects(f.receipt.write.appendResult([id, 1, planHash, resultA]), /PreviousHashMismatch/);
    await f.receipt.write.appendResult([id, 1, zeroHash, resultA]);
    await assert.rejects(f.receipt.write.appendResult([id, 1, zeroHash, resultA]), /InvalidRevision/);
    await assert.rejects(f.receipt.write.appendResult([id, 3, resultA, resultB]), /InvalidRevision/);
    await assert.rejects(f.receipt.write.appendResult([id, 2, zeroHash, resultB]), /PreviousHashMismatch/);
    await assert.rejects(f.receipt.write.appendResult([id, 2, resultA, resultA]), /RepeatedResultHash/);
    await f.receipt.write.appendResult([id, 2, resultA, resultB]);
    const result = await f.receipt.read.getReceipt([id]); assert.equal(result.latestRevision, 2); assert.equal(result.latestResultHash, resultB); assert.equal(result.planHash, planHash);
    const events = await f.client.getContractEvents({ address: f.receipt.address, abi: f.receipt.abi, eventName: "ResultAppended", fromBlock: 0n, strict: true });
    assert.equal(events.length, 2); assert.equal(events[1]!.args.previousResultHash, events[0]!.args.resultHash);
  } finally { await f.connection.close(); }
});

test("M08.04 ownership transfer requires acceptance and preserves the original issuer", async () => {
  const f = await setup();
  try {
    await f.receipt.write.commitPlan([id, planHash, methodHash, 0n, true]);
    await f.receipt.write.transferOwnership([f.other.account.address]);
    await assert.rejects(f.receipt.write.appendResult([id, 1, zeroHash, resultA], { account: f.other.account }), /OwnableUnauthorizedAccount/);
    await assert.rejects(f.receipt.write.acceptOwnership({ account: f.stranger.account }), /OwnableUnauthorizedAccount/);
    await f.receipt.write.acceptOwnership({ account: f.other.account });
    assert.equal((await f.receipt.read.owner()).toLowerCase(), f.other.account.address.toLowerCase());
    await assert.rejects(f.receipt.write.appendResult([id, 1, zeroHash, resultA]), /OwnableUnauthorizedAccount/);
    await f.receipt.write.appendResult([id, 1, zeroHash, resultA], { account: f.other.account });
    const record = await f.receipt.read.getReceipt([id]); assert.equal(record.initialIssuer.toLowerCase(), f.owner.account.address.toLowerCase());
  } finally { await f.connection.close(); }
});
