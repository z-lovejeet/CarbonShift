# CarbonShift — blockchain and evidence specification

Version 1.2 · 23 October 2026 · M08 local proof and M09 real Sepolia deployment/publication verified. Public receipt/verifier pages remain M10.

**U34 target revision · 23 October 2026:** the approved household expansion at the end of this document supersedes conflicting washing-only restrictions for new v2 work. Earlier sections retain v1 contracts and historical implementation evidence. New capabilities are not passed until recorded in status.

## 1. Purpose and trust boundary

A participating user and an external reviewer may want a stable record of what the operator said before a run. An on-chain commitment allows a later bundle to be compared against an earlier public digest without trusting the operator's current database alone.

The MVP uses an **operator-issued** record. The member consents through authenticated web UI; the server does not pretend that this is a user-wallet signature. The operator can lie about inputs, censor publication, create many IDs, or collude with users. The chain only constrains the registered record's history.

A signed database/export is the simpler alternative. The testnet ledger is justified only if public timestamp/order and independent checking are useful to the reviewer. No external reviewer or program partner has yet validated this hypothesis.

## 2. On-chain/off-chain split

| On-chain | Off-chain |
|---|---|
| Random receipt ID | Private account/plan mapping |
| Plan and method digests | Grid snapshots, constraints, energy profile, calculations |
| Live/demo mode | Raw user text, which is excluded from published bundles |
| Precommit cutoff and block timestamp | Human-readable explanations |
| Original issuer address | Explicit publication consent records |
| Latest public result revision/digest | Full public result manifests and correction reasons |
| Immutable events for every result revision | Private, unconsented result revisions |

Never put email, name, postcode, IP address, or private task text on-chain. Hashing identifying low-entropy data alone does not make it private.

## 3. Manifest format

`PlanManifestV1` contains:

```text
schemaVersion=1, type="plan", receiptId, nonce
mode="live"|"demo"
chainId, contractAddress
methodVersion, methodHash
comparisonCreatedAtUtc, acceptedAtUtc, commitBeforeUtc|null
constraints: sanitized ConfirmedConstraintsV1
energyWhBins
forecastSnapshot: full normalized covered intervals + source metadata
baseline: {startUtc,endUtc,estimatedMg}
selected: {startUtc,endUtc,estimatedMg}
differenceMg
executionBasis="not_observed"
attribution
```

Sanitized constraints retain the fields required to reproduce feasibility, including blocked times. They exclude owner IDs, comparison IDs, raw prose, and source text spans. Timing and energy may still reveal habits; the user must see that before consenting.

`ResultManifestV1`:

```text
schemaVersion=1, type="result", receiptId, nonce, mode
chainId, contractAddress, planHash, methodVersion, methodHash
publicRevision, previousResultHash
privateResultRevisionNumber
reportedKind, reportedStartUtc|null, reportCreatedAtUtc, resultCreatedAtUtc
reportSource="report"|"cancellation"
profileStillApplicable:boolean|null
executionBasis="self_reported"|"simulated", energyBasis
resultStatus, baselineActualMg|null, reportedActualMg|null, differenceMg|null
actualSnapshot|null
reasonCode, correctionExplanation
```

Only user-reviewed sanitized correction explanations can be public; warn against including personal information. For the first public result, `previousResultHash` is zero bytes32. Subsequent results reference the preceding **public** digest even if private revisions were skipped.

Live results require `executionBasis=self_reported`; authored demo results require `executionBasis=simulated`. Profile confirmation is required for a run and null for a non-run. A false confirmation makes updated amounts unavailable with reason `PROFILE_CHANGED`, even when grid factors exist.

Bundle container: `schemaVersion=1`, plan manifest, ordered published result manifests (maximum 100), known method descriptor, and nullable chain references (network/address/plan transaction hash and ordered result transaction hashes). Chain references sit outside the hashed manifests to avoid circular transaction-hash dependencies.

## 4. Canonical hashing

Use RFC 8785-compatible canonical JSON, UTF-8, finite safe integers, UTC strings, and exact field schemas. Reject unknown fields, unsafe numbers, missing required keys, and malformed hex. Sort intervals chronologically before freezing; order of arrays is meaningful.

```text
planHash   = SHA256(UTF8("CarbonShift:plan:v1\n")   || JCS(planManifest))
resultHash = SHA256(UTF8("CarbonShift:result:v1\n") || JCS(resultManifest))
methodHash = SHA256(UTF8("CarbonShift:method:v1\n") || JCS(methodDescriptor))
```

Use a fresh random 32-byte nonce per new manifest; persist it before preview. Retrying the same manifest reuses the same nonce and bytes. The nonce is disclosed in the public bundle and is not a promise of privacy after publication.

The method descriptor is a small versioned JSON artifact generated during implementation that records the constants and algorithm identifier from document 08. Pin its expected digest in verifier tests. Merely including an arbitrary method descriptor with a matching self-chosen hash does not make it a supported method.

[RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) defines the canonicalization reference; the domain prefixes and manifest schemas above are CarbonShift design choices.

## 5. Contract interface

Non-upgradeable contract using OpenZeppelin `Ownable2Step`. No tokens, payments, payable functions, oracle calls, proxy, or carbon-credit issuance.

```text
commitPlan(
  bytes32 receiptId,
  bytes32 planHash,
  bytes32 methodHash,
  uint64 commitBefore,
  bool isDemo
)

appendResult(
  bytes32 receiptId,
  uint32 revision,
  bytes32 previousResultHash,
  bytes32 resultHash
)

getReceipt(bytes32 receiptId)
  -> exists, planHash, methodHash, commitBefore, committedAt,
     isDemo, initialIssuer, latestRevision, latestResultHash
```

Both mutations require the current owner. Initial owner is the dedicated testnet issuer. Ownership transfer uses the library's two-step process and appears in the chain history. Application configuration must check the expected current owner before writing.

`commitPlan` rules:

- Receipt ID, plan hash, and method hash are nonzero.
- Receipt ID must not already exist.
- Live mode: `commitBefore > block.timestamp`.
- Demo mode: `commitBefore == 0`; no claim about a historical precommitment.
- Record original issuer and immutable fields.

`appendResult` rules:

- Receipt must exist and result hash must be nonzero.
- Revision must equal `latestRevision + 1`.
- Previous hash must equal stored latest hash (zero for revision 1).
- New result hash must differ from latest hash.
- Update latest pointer and emit an immutable event.

Events:

```text
PlanCommitted(receiptId indexed, planHash, methodHash,
              commitBefore, committedAt, isDemo, issuer)
ResultAppended(receiptId indexed, revision indexed,
               previousResultHash, resultHash, issuer)
```

The contract cannot inspect off-chain contents or verify that two IDs refer to the same physical wash. Its uniqueness rule prevents reusing an enrolled receipt ID, not global double counting.

## 6. Timing

For live mode, `commitBefore` equals the earlier of baseline start and selected start, as Unix seconds. This blocks claiming an earlier baseline commitment after that baseline period has begun.

The app only accepts/publishes with a ten-minute operational buffer. The contract enforces the exact cutoff independently. Pending transactions mined after cutoff revert. Never move the manifest cutoff later to rescue the transaction.

Historical/synthetic replay uses `mode=demo`, cutoff zero, and persistent demo labeling. A current chain timestamp does not prove a historical commitment.

## 7. Independent verification

Present independent checks:

1. **Schema:** supported version and valid fields.
2. **Plan integrity:** canonical hash equals the on-chain plan hash.
3. **Method:** known method ID and expected descriptor digest.
4. **Calculation:** inputs reproduce feasibility, baseline, selected optimum, and totals.
5. **Timing:** live commitment block predates both relevant starts.
6. **Result history:** revision chain and hashes match events.
7. **Evidence basis:** self-report/assumed energy remain visible regardless of other checks.

Also compare manifest network/address/mode/method hash with the configured contract and its stored record. For live mode, the chain cutoff and manifest cutoff must equal the minimum of baseline and selected start; for demo both use the documented zero/null representation. Reject cross-mode result bundles, inconsistent receipt IDs, or an arbitrary method descriptor even if its own digest is internally consistent.

Failures are `mismatch`, `unsupported`, or `unavailable`, not a blanket pass/fail. An RPC outage is unavailable. A changed factor is mismatch. A matching result is not physical certification.

On the verification page, import JSON and recompute locally. An independent reviewer can also inspect contract events using the configured public explorer or their own trusted tooling. Do not claim independence merely because the same operator server returns a green badge.

## 8. Required adversarial cases

Reject unauthorized writes, duplicate receipt IDs, late live commits, skipped/out-of-order revisions, wrong previous hash, and zero digests. Alter one bundled factor and show both integrity/calculation checks. Re-submit the exact accepted request and show idempotent handling rather than another event.

Test correct legitimate second plans: unrelated washing cycles may share the same time window. Do not globally prohibit one time slot or mistake it for unique appliance identity.

## 9. Publication limits

Public data can be copied; revoking a hosted link cannot erase the chain or third-party copies. Consent is per plan and per published result. Preserve immutable original estimates and label newer public revisions.

A hash cannot restore a deleted bundle. Export/download is therefore part of the receipt flow. The prototype uses operator hosting and user downloads; durable independent archival is a future operational dependency.

## 10. M08 reproducibility decisions

The two creation instants are explicit: feasibility uses `comparisonCreatedAtUtc`, not acceptance or confirmation time; actual snapshot chronology uses `resultCreatedAtUtc`. Both come from immutable private records. Public correction text is supplied separately after review; the export builder never copies private notes/reasons. `reportSource=cancellation` is restricted to a terminal non-run before selected start, no prior report/result, null profile and amounts, and `reasonCode=cancelled_before_start`. Ordinary non-runs retain the post-cycle timing rule. Missing result reason is null; pending/outside reasons retain the domain codes. These details are fixed before any public version-1 receipt exists.

Canonical manifests use lowercase nonzero addresses/identities, Sepolia chain ID 11155111, safe integer amounts, bounded strings and at most 200 contiguous grid intervals. The import limit is 256 KiB and nesting is bounded. Reject duplicate keys, malformed Unicode, decimal/exponent numeric lexemes, negative zero and unsafe JSON values before canonicalization. Unknown fields fail closed. Descriptor matching requires the implementation's pinned digest, not just a supplied descriptor/hash pair.

Builders require an explicit, externally persisted nonce; they never mint one during retries. The server identity factory creates cryptographic receipt IDs/nonces. M08 exercises stable reuse locally; persistence before preview belongs to the M09 publication transaction. No preview/persistence route or public database table is claimed in M08.

The pure verifier accepts optional *separately trusted* chain observations (validated reads and events supplied by its caller), never treats bundle chain references as proof. Without observations, integrity/timing/history on-chain checks are unavailable while local method/calculation checks still run. Observation matching covers network, contract, immutable commitment fields, issuer, mode, cutoff, latest pointers, every published result event and chronological block order. A valid prefix missing later on-chain revisions is a mismatch. Current owner and original issuer are shown separately and need not match after a two-step transfer. A zero current owner after renunciation prevents new writes without invalidating existing commitments.

The dedicated `proof` Hardhat network is an isolated in-process EVM using chain ID 11155111 and a fixed authored clock to exercise network matching. It is not Sepolia RPC or a deployment. Golden bundles and snapshots are explicitly synthetic fixtures. No physical execution verification, global washing-cycle uniqueness or avoided-emissions certification is implied.

## M09 deployment and worker boundary

Actual deployment evidence is in `research/phase-9/sepolia-deployment.json`: Sepolia contract `0xddc904b894669e4f00a3b4dfbaad58f90e9f7040`, block 11971755, transaction `0x4357d49ace21861481be1149975d6195a6ac83781461a7a8a2ddf38038a93ebd`. The actual runtime bytecode and owner matched the generated build; two blocks after inclusion were observed. This real deployment is distinct from M08's isolated EVM.

The worker validates supported manifest/calculation/hash/context, correct chain, pinned runtime and current owner before signing. It verifies saved EIP-1559 bytes, signer, nonce, destination, zero value and exact calldata before rebroadcast. Confirmation requires the expected successful event, contract read and canonical inclusion block plus two further blocks. A missing receipt, consumed unknown nonce, event mismatch, changed canonical block or RPC failure preserves uncertainty. No fresh nonce replaces an uncertain transaction. Public result writes await confirmed predecessors; failed transactions do not erase the consented evidence.

The dedicated deployment journal is local/ignored and retains its original signed transaction across retries. The RPC's actual deployment estimate exceeded the initial provisional gas bound; a bounded six-million deployment allowance was adopted with the original fee/balance checks. Operational limits are not chain performance or gas-price guarantees. Actual plan/result publication evidence belongs in status section 24 after the live flow passes.

## Household expansion — U34 proof contract

V2 is a separate strict manifest/method dispatch, not a new interpretation of v1 bytes. Plan/result/method digests use the existing SHA-256 + JCS construction with domain prefixes `CarbonShift:plan:v2\n`, `CarbonShift:result:v2\n`, `CarbonShift:method:v2\n`. The actual prefix contains a newline, not two literal backslash characters. Keep all v1 prefixes and pinned method fixtures unchanged.

V2 plan manifest: `schemaVersion=2`, type, receipt ID/nonce/mode, chain ID/contract, method version/hash, comparison/acceptance/cutoff instants, sanitized resolved activities and constraints, full covered forecast snapshot/provenance, baseline/selected assignments and per-task/aggregate quantities, search descriptor and `executionBasis=not_observed`. Public task/resource IDs are fresh deterministic aliases within the preview, preserving relationships but excluding private IDs/custom names. Include generic categories and enough frozen energy segments/provenance to reproduce amounts. Private source notes, raw text, source spans, email, account IDs and private display labels never enter exports. Timing itself remains publicly revealing and is disclosed before consent.

V2 result manifest: common receipt/method/network identity, plan hash, public revision/previous public result hash, a frozen vector of task-result revisions and sanitized report facts, referenced actual snapshots, per-task result statuses/amounts/reasons, covered/missing/non-run task counts, nullable complete aggregate and explicitly partial eligible aggregate. Non-runs and changed profiles contribute no claimed avoided amount; only latest selected task result enters each snapshot once. Corrections append and do not rewrite the plan. Public revision chaining is independent of skipped private revisions.

Bundle imports have a 1 MiB byte cap, maximum twelve tasks, bounded profile segments/intervals and at most 100 result manifests; a large history exceeding the cap requires fewer explicitly selected published revisions only if chain-continuity verification remains possible, otherwise report export-size limitation rather than silently truncate. Freeze the final bounded schema and known-answer digest before enabling publication. Reject unsafe numbers, unknown fields/versions, mixed receipt/network identities, broken task references and duplicate revision/task IDs. Method support is pinned code-owned recognition, not an arbitrary matching descriptor.

One schedule has one receipt. Live commit cutoff is the minimum of every baseline/selected task start; actual ledger inclusion must precede it. Private acceptance also retains the ten-minute buffer. A partly started day cannot receive a new precommit claim. Result previews reveal exactly which task revisions are public, including missing tasks. The v1 contract's arbitrary method/plan hashes suggest reuse; X05 must prove local and actual Sepolia compatibility before enabling the v2 publication UI. Do not redeploy for cosmetic changes.

Verification independently reports schema, integrity, known method, arithmetic/feasibility, chain identity/state, precommit timing and result lineage. A recomputed schedule proves feasibility and arithmetic; do not assert global optimality solely because the manifest says so. Replay the bounded deterministic solver if checking its search claim. Preserve the distinction between self-report, calculated estimate and confirmed hash.
