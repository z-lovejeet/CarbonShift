import "server-only";
import { createHash } from "node:crypto";
import { createPublicClient, http, parseEventLogs, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { SHIFT_RECEIPT_ABI_V1 as abi } from "@/generated/shift-receipt-v1";
import build from "@/generated/shift-receipt-v1.build.json";
import { getWebEnvironment } from "@/server/env";
import { verificationContextSchema, type VerificationContext } from "@/domain/proof/observations";
import type { loadPublicReceipt } from "./public-reader";
export async function observePublicReceipt(publication: Awaited<ReturnType<typeof loadPublicReceipt>>): Promise<VerificationContext | null> {
  const env = getWebEnvironment(); if (!env.ledger.enabled) return null;
  const expected = { expectedChainId: 11155111, expectedContractAddress: env.ledger.contractAddress.toLowerCase(), chain: null };
  if (publication.operation.status !== "confirmed" || !publication.operation.transactionHash) return expected;
  try {
    const client = createPublicClient({ chain: sepolia, transport: http(env.ledger.rpcUrl, { retryCount: 0, timeout: 8000, fetchOptions: { redirect: "error" } }) }), address = expected.expectedContractAddress as Hex;
    const [chainId, code, owner, stored, head] = await Promise.all([client.getChainId(), client.getCode({ address }), client.readContract({ address, abi, functionName: "owner" }), client.readContract({ address, abi, functionName: "getReceipt", args: [publication.bundle.plan.receiptId as Hex] }), client.getBlockNumber({ cacheTime: 0 })]);
    if (chainId !== 11155111 || !code || `0x${createHash("sha256").update(Buffer.from(code.slice(2), "hex")).digest("hex")}` !== build.runtimeBytecodeSha256) return expected;
    async function transaction(hash: string) { const receipt = await client.getTransactionReceipt({ hash: hash as Hex }), block = await client.getBlock({ blockNumber: receipt.blockNumber }); if (receipt.status !== "success" || block.hash !== receipt.blockHash || head < receipt.blockNumber + 2n) throw new Error("Unconfirmed or changed inclusion"); return { receipt, block }; }
    const commitment = await transaction(publication.operation.transactionHash), event = parseEventLogs({ abi, eventName: "PlanCommitted", logs: commitment.receipt.logs.filter((l) => l.address.toLowerCase() === address) })[0]; if (!event) return expected;
    const position = (receipt: typeof commitment.receipt, block: typeof commitment.block, logIndex: number) => ({ transactionHash: receipt.transactionHash, blockHash: receipt.blockHash, blockNumber: Number(receipt.blockNumber), blockTimestamp: Number(block.timestamp), logIndex });
    const results = [];
    for (const operation of publication.resultOperations) {
      if (operation.status !== "confirmed" || !operation.transactionHash) continue;
      const observed = await transaction(operation.transactionHash), result = parseEventLogs({ abi, eventName: "ResultAppended", logs: observed.receipt.logs.filter((l) => l.address.toLowerCase() === address) })[0]; if (!result) return expected;
      results.push({ ...position(observed.receipt, observed.block, result.logIndex), receiptId: result.args.receiptId, revision: result.args.revision, previousResultHash: result.args.previousResultHash, resultHash: result.args.resultHash, issuer: result.args.issuer.toLowerCase() });
    }
    const e = event.args;
    return verificationContextSchema.parse({ ...expected, chain: { chainId, contractAddress: address, currentOwner: owner.toLowerCase(), receipt: { receiptId: publication.bundle.plan.receiptId, exists: stored.exists, planHash: stored.planHash, methodHash: stored.methodHash, commitBefore: Number(stored.commitBefore), committedAt: Number(stored.committedAt), isDemo: stored.isDemo, initialIssuer: stored.initialIssuer.toLowerCase(), latestRevision: stored.latestRevision, latestResultHash: stored.latestResultHash }, commit: { ...position(commitment.receipt, commitment.block, event.logIndex), receiptId: e.receiptId, planHash: e.planHash, methodHash: e.methodHash, commitBefore: Number(e.commitBefore), committedAt: Number(e.committedAt), isDemo: e.isDemo, issuer: e.issuer.toLowerCase() }, results } });
  } catch { return expected; }
}
