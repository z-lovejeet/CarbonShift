import { createHash } from "node:crypto";
import { createPublicClient, http, encodeFunctionData, keccak256, parseTransaction, recoverTransactionAddress, parseEventLogs, TransactionReceiptNotFoundError, type Hex, type PublicClient, type TransactionSerializedEIP1559 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { SHIFT_RECEIPT_ABI_V1 as abi } from "@/generated/shift-receipt-v1";
import build from "@/generated/shift-receipt-v1.build.json";
import type { WorkerEnvironment } from "@/config/environment";
import { epochSeconds } from "@/domain/time";
import { versionedPlanHash as hashPlan } from "@/domain/proof/versions";
import { LedgerFault, type LedgerChain, type LedgerJob, type SignedTransaction, type Observation } from "./contracts";

// Observed Sepolia commit estimate: 582,702; the 20% margin fits this bounded cap.
export const MAX_TRANSACTION_GAS = 1000000n;
export const MAX_FEE_PER_GAS = 20000000000n;
export function createSepoliaClient(rpcUrl: string) {
  return createPublicClient({ chain: sepolia, transport: http(rpcUrl, { timeout: 8000, retryCount: 0, fetchOptions: { redirect: "error" } }) });
}
export async function verifyReceiptContract(client: PublicClient, address: Hex) {
  if (await client.getChainId() !== 11155111) throw new LedgerFault("CHAIN_MISMATCH");
  const code = await client.getCode({ address });
  if (!code || `0x${createHash("sha256").update(Buffer.from(code.slice(2), "hex")).digest("hex")}` !== build.runtimeBytecodeSha256) throw new LedgerFault("CHAIN_MISMATCH");
}
export function ledgerCall(job: LedgerJob) {
  const p = job.plan;
  if (job.kind === "plan") return { functionName: "commitPlan", args: [p.receiptId as Hex, job.expectedHash as Hex, p.methodHash as Hex, p.commitBeforeUtc === null ? 0n : BigInt(epochSeconds(p.commitBeforeUtc)), p.mode === "demo"] } as const;
  const r = job.results.at(-1); if (!r) throw new LedgerFault("INVALID_MANIFEST");
  return { functionName: "appendResult", args: [p.receiptId as Hex, r.publicRevision, r.previousResultHash as Hex, job.expectedHash as Hex] } as const;
}
export function createLedgerChain(environment: WorkerEnvironment, client: PublicClient = createSepoliaClient(environment.rpcUrl)): LedgerChain {
  const account = privateKeyToAccount(environment.privateKey as Hex), address = environment.contractAddress.toLowerCase() as Hex;
  async function verifySigned(job: LedgerJob, signed: SignedTransaction) {
    if (!signed.raw.startsWith("0x02")) throw new LedgerFault("INVALID_MANIFEST");
    const raw = signed.raw as TransactionSerializedEIP1559, tx = parseTransaction(raw);
    if (keccak256(raw) !== signed.hash || tx.chainId !== 11155111 || tx.to?.toLowerCase() !== address || tx.nonce !== signed.nonce || (tx.value ?? 0n) !== 0n ||
      !tx.gas || tx.gas > MAX_TRANSACTION_GAS || (tx.maxFeePerGas ?? 0n) > MAX_FEE_PER_GAS ||
      tx.data !== encodeFunctionData({ abi, ...ledgerCall(job) }) || (await recoverTransactionAddress({ serializedTransaction: raw })).toLowerCase() !== account.address.toLowerCase()) throw new LedgerFault("INVALID_MANIFEST");
  }
  return {
    verify: () => verifyReceiptContract(client, address),
    async sign(job) {
      await verifyReceiptContract(client, address);
      if ((await client.readContract({ address, abi, functionName: "owner" })).toLowerCase() !== account.address.toLowerCase()) throw new LedgerFault("CHAIN_MISMATCH");
      const stored = await client.readContract({ address, abi, functionName: "getReceipt", args: [job.plan.receiptId as Hex] });
      if (job.kind === "plan" ? stored.exists : !stored.exists || stored.planHash !== hashPlan(job.plan) || stored.latestRevision !== job.results.at(-1)!.publicRevision - 1 || stored.latestResultHash !== job.results.at(-1)!.previousResultHash) throw new LedgerFault("EVENT_MISMATCH");
      const call = ledgerCall(job), data = encodeFunctionData({ abi, ...call });
      if (call.functionName === "commitPlan") await client.simulateContract({ address, abi, ...call, account });
      else await client.simulateContract({ address, abi, ...call, account });
      const nonce = await client.getTransactionCount({ address: account.address, blockTag: "pending" });
      const gas = (await client.estimateGas({ account, to: address, data })) * 120n / 100n;
      const fees = await client.estimateFeesPerGas();
      if (gas > MAX_TRANSACTION_GAS || fees.maxFeePerGas > MAX_FEE_PER_GAS) throw new LedgerFault("RPC_UNAVAILABLE");
      const raw = await account.signTransaction({ chainId: 11155111, type: "eip1559", to: address, data, value: 0n, gas, nonce, ...fees });
      return { nonce, raw, hash: keccak256(raw) };
    },
    async broadcast(job, signed) { await verifyReceiptContract(client, address); await verifySigned(job, signed); await client.sendRawTransaction({ serializedTransaction: signed.raw as Hex }); },
    async inspect(job, signed): Promise<Observation> {
      await verifySigned(job, signed);
      let receipt;
      try { receipt = await client.getTransactionReceipt({ hash: signed.hash as Hex }); }
      catch (error) {
        if (error instanceof TransactionReceiptNotFoundError) {
          const nonce = await client.getTransactionCount({ address: account.address, blockTag: "latest" });
          return { status: "uncertain", code: nonce > signed.nonce ? "NONCE_CONFLICT" : "NOT_FOUND", block: null, blockHash: null };
        }
        throw new LedgerFault("RPC_UNAVAILABLE");
      }
      const block = await client.getBlock({ blockNumber: receipt.blockNumber }), head = await client.getBlockNumber({ cacheTime: 0 });
      const position = { block: Number(receipt.blockNumber), blockHash: receipt.blockHash };
      if (!Number.isSafeInteger(position.block)) throw new LedgerFault("CHAIN_MISMATCH");
      if (block.hash !== receipt.blockHash || job.blockHash !== null && job.blockHash !== receipt.blockHash) return { status: "uncertain", code: "REORGANIZED", ...position };
      if (head < receipt.blockNumber + 2n) return { status: "submitted", code: null, ...position };
      if (receipt.status !== "success") return { status: "failed", code: "REVERTED", ...position };
      const logs = receipt.logs.filter((log) => log.address.toLowerCase() === address);
      const event = job.kind === "plan" ? parseEventLogs({ abi, eventName: "PlanCommitted", logs })[0] : parseEventLogs({ abi, eventName: "ResultAppended", logs })[0];
      let matches = false;
      if (event?.eventName === "PlanCommitted") {
        const e = event.args, p = job.plan;
        matches = e.receiptId === p.receiptId && e.planHash === job.expectedHash && e.methodHash === p.methodHash && e.isDemo === (p.mode === "demo") &&
          e.commitBefore === (p.commitBeforeUtc === null ? 0n : BigInt(epochSeconds(p.commitBeforeUtc))) && e.committedAt === block.timestamp && e.issuer.toLowerCase() === account.address.toLowerCase();
      } else if (event?.eventName === "ResultAppended") {
        const e = event.args, r = job.results.at(-1)!;
        matches = e.receiptId === r.receiptId && e.revision === r.publicRevision && e.previousResultHash === r.previousResultHash && e.resultHash === job.expectedHash && e.issuer.toLowerCase() === account.address.toLowerCase();
      }
      const record = await client.readContract({ address, abi, functionName: "getReceipt", args: [job.plan.receiptId as Hex] });
      matches &&= record.exists && record.planHash === hashPlan(job.plan) && record.methodHash === job.plan.methodHash && record.latestRevision >= (job.results.at(-1)?.publicRevision ?? 0);
      return { status: matches ? "confirmed" : "uncertain", code: matches ? null : "EVENT_MISMATCH", ...position };
    },
  };
}
