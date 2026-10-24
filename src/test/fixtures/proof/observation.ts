/** Synthetic chain observations for failure tests; real local-EVM observations are built in contract tests. */
import { hashPlan, hashResult } from "../../../domain/proof/canonical";
import { ZERO_HASH, type ProofBundleV1 } from "../../../domain/proof/schemas";
import type { VerificationContext } from "../../../domain/proof/observations";
import { epochSeconds } from "../../../domain/time";
export function proofObservation(bundle: ProofBundleV1): VerificationContext {
  const initialIssuer = `0x${"a".repeat(40)}`, currentOwner = `0x${"b".repeat(40)}`;
  const position = (n: number, utc: string) => ({ transactionHash: `0x${String(n + 5).repeat(64)}`, blockHash: `0x${String(n + 6).repeat(64)}`, blockNumber: n + 1, blockTimestamp: epochSeconds(utc), logIndex: 0 });
  const planHash = hashPlan(bundle.plan), hashes = bundle.results.map(hashResult), commitBefore = bundle.plan.commitBeforeUtc === null ? 0 : epochSeconds(bundle.plan.commitBeforeUtc), committedAt = epochSeconds("2026-10-21T06:02:00Z");
  return { expectedChainId: bundle.plan.chainId, expectedContractAddress: bundle.plan.contractAddress, chain: {
    chainId: bundle.plan.chainId, contractAddress: bundle.plan.contractAddress, currentOwner,
    receipt: { receiptId: bundle.plan.receiptId, exists: true, planHash, methodHash: bundle.plan.methodHash, commitBefore, committedAt, isDemo: bundle.plan.mode === "demo", initialIssuer, latestRevision: hashes.length, latestResultHash: hashes.at(-1) ?? ZERO_HASH },
    commit: { ...position(0, "2026-10-21T06:02:00Z"), receiptId: bundle.plan.receiptId, planHash, methodHash: bundle.plan.methodHash, commitBefore, committedAt, isDemo: bundle.plan.mode === "demo", issuer: initialIssuer },
    results: bundle.results.map((r, i) => ({ ...position(i + 1, r.resultCreatedAtUtc), receiptId: r.receiptId, revision: r.publicRevision, previousResultHash: r.previousResultHash, resultHash: hashes[i]!, issuer: i === 0 ? initialIssuer : currentOwner })),
  } };
}
