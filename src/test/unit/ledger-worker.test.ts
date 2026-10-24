import { expect, it, vi } from "vitest";
import { createLedgerProcessor, validateLedgerJob } from "@/worker/processor";
import { LedgerFault, type LedgerStore, type LedgerChain, type LedgerJob, type SignedTransaction, type Observation } from "@/worker/contracts";
import { hashPlan } from "@/domain/proof";
import { proofBundle } from "../fixtures/proof/bundle";

function harness() {
  const plan = proofBundle().plan;
  const job: LedgerJob = { id: "b245fb4a-a4ef-4d86-a61e-d2d930854db7", kind: "plan", plan, expectedHash: hashPlan(plan), results: [], transactionHash: null, blockHash: null };
  const signed: SignedTransaction = { nonce: 4, raw: "0xdeadbeef", hash: "0x" + "2".repeat(64) };
  let durable: SignedTransaction | null = null, pending = true;
  const observations: Observation[] = [], order: string[] = [];
  const store: LedgerStore = {
    lease: vi.fn(async () => 1), release: vi.fn(async () => {}),
    reconciliationJobs: vi.fn(async () => durable ? [{ ...job, transactionHash: durable.hash }] : []),
    next: vi.fn(async () => pending && !durable ? job : null),
    signed: vi.fn(async () => durable), prepare: vi.fn(async () => true),
    persist: vi.fn(async (_id, _fence, bytes) => { order.push("persist"); durable = bytes; return true; }),
    observe: vi.fn(async (_id, _fence, observed) => { observations.push(observed); if (observed.status === "confirmed") pending = false; }),
  };
  const chain: LedgerChain = {
    verify: vi.fn(async () => {}), sign: vi.fn(async () => { order.push("sign"); return signed; }),
    broadcast: vi.fn(async (_job, bytes) => { expect(durable).toEqual(bytes); order.push("broadcast"); }),
    inspect: vi.fn(async (): Promise<Observation> => ({ status: "confirmed", code: null, block: 8, blockHash: "0x" + "3".repeat(64) })),
  };
  return { job, signed, store, chain, observations, order, tick: createLedgerProcessor(store, chain, plan.contractAddress) };
}
it("validates the actual manifest/calculator before preparing or signing", () => {
  const h = harness(); expect(validateLedgerJob(h.job, h.job.plan.contractAddress)).toEqual(h.job);
  expect(() => validateLedgerJob({ ...h.job, plan: { ...h.job.plan, differenceMg: 42 } }, h.job.plan.contractAddress)).toThrow();
  expect(() => validateLedgerJob(h.job, "0x" + "f".repeat(40))).toThrow();
});
it("persists exact signed bytes before broadcast and resumes without another signature", async () => {
  const h = harness(); expect(await h.tick()).toBe("submitted"); expect(h.order).toEqual(["sign", "persist", "broadcast"]);
  await h.tick(); expect(h.chain.sign).toHaveBeenCalledOnce(); expect(h.observations.at(-1)?.status).toBe("confirmed");
});
it("a crash before durable signing broadcasts nothing and can reclaim the unsigned job", async () => {
  const h = harness(); vi.mocked(h.store.persist).mockRejectedValueOnce(new Error("crash"));
  await expect(h.tick()).rejects.toThrow("crash"); expect(h.chain.broadcast).not.toHaveBeenCalled();
  await h.tick(); expect(h.chain.broadcast).toHaveBeenCalledOnce();
});
it("a crash after durable signing resends only the identical transaction and nonce", async () => {
  const h = harness(); vi.mocked(h.chain.broadcast).mockRejectedValueOnce(new Error("lost acknowledgment"));
  await h.tick(); expect(h.observations.at(-1)?.status).toBe("uncertain");
  vi.mocked(h.chain.inspect).mockResolvedValueOnce({ status: "uncertain", code: "NOT_FOUND", block: null, blockHash: null });
  await h.tick(); expect(h.chain.sign).toHaveBeenCalledOnce();
  expect(vi.mocked(h.chain.broadcast).mock.calls.map((call) => call[1])).toEqual([h.signed, h.signed]);
});
it("mining before database acknowledgment is recovered through the saved transaction", async () => {
  const h = harness(); await h.tick(); vi.mocked(h.store.observe).mockRejectedValueOnce(new Error("db unavailable"));
  await h.tick(); await h.tick(); expect(h.chain.sign).toHaveBeenCalledOnce(); expect(h.observations.at(-1)?.status).toBe("confirmed");
});
it("unknown receipt or reorganization does not remain confirmed or use a new nonce", async () => {
  const h = harness(); await h.tick(); await h.tick();
  vi.mocked(h.chain.inspect).mockResolvedValueOnce({ status: "uncertain", code: "REORGANIZED", block: 9, blockHash: "0x" + "4".repeat(64) });
  await h.tick(); expect(h.observations.at(-1)?.status).toBe("uncertain"); expect(h.chain.sign).toHaveBeenCalledOnce();
  vi.mocked(h.chain.inspect).mockRejectedValueOnce(new Error("rpc timeout")); await h.tick();
  expect(h.observations.at(-1)?.code).toBe("RPC_UNAVAILABLE");
});
it("wrong chain/code refuses signing and invalidates checked confirmation availability", async () => {
  const h = harness(); await h.tick(); vi.mocked(h.chain.verify).mockRejectedValueOnce(new LedgerFault("CHAIN_MISMATCH"));
  await expect(h.tick()).rejects.toThrow(); expect(h.observations.at(-1)?.status).toBe("uncertain"); expect(h.chain.sign).toHaveBeenCalledOnce();
});
it("cancellation/deletion or loss of the fence before persistence cannot broadcast", async () => {
  const h = harness(); vi.mocked(h.store.persist).mockResolvedValue(false); expect(await h.tick()).toBe("state_changed"); expect(h.chain.broadcast).not.toHaveBeenCalled();
  const lost = harness(); vi.mocked(lost.store.lease).mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(null);
  await expect(lost.tick()).rejects.toThrow("LEASE_LOST"); expect(lost.chain.broadcast).not.toHaveBeenCalled();
});
it("a different active worker or reconciliation-only command cannot sign", async () => {
  const h = harness(); vi.mocked(h.store.lease).mockResolvedValueOnce(null); expect(await h.tick()).toBe("leased_elsewhere");
  await h.tick(true); expect(h.chain.sign).not.toHaveBeenCalled(); expect(h.chain.broadcast).not.toHaveBeenCalled();
});
