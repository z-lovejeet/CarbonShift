import assert from "node:assert/strict";
import { test } from "node:test";
import { network } from "hardhat";
import { getContract, zeroAddress, type Hex } from "viem";
import { SHIFT_RECEIPT_ABI_V1 } from "../../src/generated/shift-receipt-v1.ts";
import { proofBundle } from "../../src/test/fixtures/proof/bundle.ts";
import { chainObservationSchema, exportProofBundle, hashPlan, hashResult, importProofBundle, verifyProofBundle } from "../../src/domain/proof.ts";
import { epochSeconds } from "../../src/domain/time.ts";

const integer = (value: bigint): number => { const n = Number(value); assert.ok(Number.isSafeInteger(n)); return n; };
for (const mode of ["live", "demo"] as const) {
  test(`M08.05 ${mode}: portable bundle independently matches actual local-EVM reads/events`, async () => {
    const connection = await network.create("proof");
    try {
      const { viem } = connection, client = await viem.getPublicClient(), clock = await viem.getTestClient();
      const [owner, successor] = await viem.getWalletClients(); assert.ok(owner && successor);
      const deployed = await viem.deployContract("ShiftReceipt", [owner.account.address]);
      const contract = getContract({ address: deployed.address, abi: SHIFT_RECEIPT_ABI_V1, client: { public: client, wallet: owner } });
      const bundle = proofBundle(contract.address.toLowerCase(), mode), p = bundle.plan;
      const id = p.receiptId as Hex;
      const planTransactionHash = await contract.write.commitPlan([id, hashPlan(p) as Hex, p.methodHash as Hex, BigInt(p.commitBeforeUtc === null ? 0 : epochSeconds(p.commitBeforeUtc)), mode === "demo"]);
      await client.waitForTransactionReceipt({ hash: planTransactionHash });
      const resultTransactionHashes: Hex[] = [];
      for (const [i, result] of bundle.results.entries()) {
        if (i === 1) {
          await contract.write.transferOwnership([successor.account.address]);
          await contract.write.acceptOwnership({ account: successor.account });
        }
        await clock.setNextBlockTimestamp({ timestamp: BigInt(epochSeconds(result.resultCreatedAtUtc)) });
        const hash = await contract.write.appendResult([id, result.publicRevision, result.previousResultHash as Hex, hashResult(result) as Hex], { account: i === 0 ? owner.account : successor.account });
        await client.waitForTransactionReceipt({ hash }); resultTransactionHashes.push(hash);
      }
      bundle.chainReferences = { chainId: p.chainId, contractAddress: p.contractAddress, planTransactionHash, resultTransactionHashes };
      const record = await client.readContract({ address: contract.address, abi: SHIFT_RECEIPT_ABI_V1, functionName: "getReceipt", args: [id] });
      const currentOwner = await client.readContract({ address: contract.address, abi: SHIFT_RECEIPT_ABI_V1, functionName: "owner" });
      const commit = (await client.getContractEvents({ address: contract.address, abi: SHIFT_RECEIPT_ABI_V1, eventName: "PlanCommitted", fromBlock: 0n, args: { receiptId: id }, strict: true }))[0]; assert.ok(commit);
      const events = await client.getContractEvents({ address: contract.address, abi: SHIFT_RECEIPT_ABI_V1, eventName: "ResultAppended", fromBlock: 0n, args: { receiptId: id }, strict: true });
      const position = async (event: { transactionHash: Hex; blockHash: Hex; blockNumber: bigint; logIndex: number }) => ({ transactionHash: event.transactionHash, blockHash: event.blockHash, blockNumber: integer(event.blockNumber), logIndex: event.logIndex, blockTimestamp: integer((await client.getBlock({ blockNumber: event.blockNumber })).timestamp) });
      const chain = chainObservationSchema.parse({
        chainId: await client.getChainId(), contractAddress: contract.address.toLowerCase(), currentOwner: currentOwner.toLowerCase(),
        receipt: { ...record, receiptId: id, initialIssuer: record.initialIssuer.toLowerCase(), commitBefore: integer(record.commitBefore), committedAt: integer(record.committedAt) },
        commit: { ...await position(commit), ...commit.args, commitBefore: integer(commit.args.commitBefore), committedAt: integer(commit.args.committedAt), issuer: commit.args.issuer.toLowerCase() },
        results: await Promise.all(events.map(async (event) => ({ ...await position(event), ...event.args, issuer: event.args.issuer.toLowerCase() }))),
      });
      const portable = exportProofBundle(bundle), independentlyImported = importProofBundle(portable);
      const context = { expectedChainId: 11155111, expectedContractAddress: contract.address.toLowerCase(), chain };
      const verification = verifyProofBundle(independentlyImported, context);
      for (const [name, check] of Object.entries(verification.checks)) assert.equal(check.state, "match", `${name}: ${check.detail}`);
      assert.equal(verification.originalIssuer, owner.account.address.toLowerCase()); assert.equal(verification.currentOwner, successor.account.address.toLowerCase()); assert.notEqual(verification.originalIssuer, verification.currentOwner);
      assert.equal(record.latestRevision, 2); assert.equal(verification.checks.evidenceBasis.detail.includes(mode === "live" ? "self-reported" : "simulated"), true);
      assert.equal(verifyProofBundle(portable).checks.planIntegrity.state, "unavailable");
      independentlyImported.plan.forecastSnapshot.intervals[0]!.forecastGPerKwh!++;
      const tampered = verifyProofBundle(independentlyImported, context);
      assert.equal(tampered.checks.planIntegrity.state, "mismatch"); assert.equal(tampered.checks.calculation.state, "mismatch");
      await contract.write.renounceOwnership({ account: successor.account });
      chain.currentOwner = (await contract.read.owner()).toLowerCase();
      assert.equal(chain.currentOwner, zeroAddress);
      // Renunciation prevents future writes; already committed content remains independently verifiable.
      assert.equal(verifyProofBundle(portable, { ...context, chain }).checks.planIntegrity.state, "match");
    } finally { await connection.close(); }
  });
}
