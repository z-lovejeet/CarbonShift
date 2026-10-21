# CarbonShift — blockchain and evidence specification

Version 1.0 · 20 October 2026 · Proposed contract `ShiftReceipt`; not implemented or deployed.

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
acceptedAtUtc, commitBeforeUtc|null
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
reportedKind, reportedStartUtc|null, reportCreatedAtUtc
profileStillApplicable:boolean|null
executionBasis="self_reported"|"simulated", energyBasis
resultStatus, baselineActualMg|null, reportedActualMg|null, differenceMg|null
actualSnapshot|null
reasonCode, correctionExplanation
```

Only user-reviewed sanitized correction explanations can be public; warn against including personal information. For the first public result, `previousResultHash` is zero bytes32. Subsequent results reference the preceding **public** digest even if private revisions were skipped.

Live results require `executionBasis=self_reported`; authored demo results require `executionBasis=simulated`. Profile confirmation is required for a run and null for a non-run. A false confirmation makes updated amounts unavailable with reason `PROFILE_CHANGED`, even when grid factors exist.

Bundle container: plan manifest, ordered published result manifests, method descriptor, and chain references (network/address/transaction hashes/block references). Chain references sit outside the hashed manifests to avoid circular transaction-hash dependencies.

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
