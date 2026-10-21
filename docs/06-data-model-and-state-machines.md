# CarbonShift — database, domain model, and state machines

Version 1.2 · 21 October 2026 · Shared domain contracts and M03 grid records implemented; relational persistence and full state lifecycle remain later work.

## 1. Representation rules

- IDs: random UUIDs for private records; cryptographically random 32-byte hex IDs for public receipts. Never derive public IDs from email, home location, or appliance identity.
- Timestamps: Postgres `timestamptz`; API/manifest UTC strings with seconds, such as `2026-10-21T09:00:00Z`.
- Energy: positive integer Wh. Carbon factors: nonnegative integer gCO₂/kWh. Calculation output: integer mgCO₂; render grams by dividing by 1,000.
- Durations: integer minutes; all calculation intervals are half-open `[start, end)`.
- Money is absent. Unknown numeric values use `null` with a status/reason, never zero.
- All authoritative records have `created_at`. Mutable operations additionally have `updated_at` and a version for optimistic concurrency.

## 2. Core types

`ConfirmedConstraintsV1`:

| Field | Type/rule |
|---|---|
| `geography` | Literal `GB_NATIONAL` |
| `timezone` | Literal `Europe/London` |
| `earliestStartUtc`, `deadlineUtc` | Valid resolved instants within allowed horizon |
| `durationMinutes` | One of 30, 60, 90, 120, 150, 180 |
| `energyWh` | Integer 50–5000; method assumption, not manufacturer certification |
| `energyBasis` | `user_estimate` or `illustrative_default` |
| `blockedIntervals` | Up to four nonoverlapping normalized UTC `{startUtc,endUtc}` intervals |
| `baselineStartUtc` | Explicit feasible start, including if generated from earliest feasible default |
| `baselineOrigin` | `user_selected` or `earliest_feasible_confirmed` |
| `confirmedAtUtc` | Server-recorded field review time |

`CandidateV1`: `startUtc`, `endUtc`, `energyWhBins[]`, `factorGPerKwh[]`, `estimatedMg`, `rank`.

`ComparisonV1`: constraints, forecast snapshot ID/hash, baseline candidate, selected candidate, up to three distinct alternatives, `differenceMg`, nullable `differencePercent`, `methodVersion`, `createdAtUtc`, `expiresAtUtc`. Percent is presentation-only; compare/rank using exact integer mg.

`GridSnapshotV1`: `geography`, `sourceUrl`, `retrievedAtUtc`, `providerIssuedAtUtc: null | timestamp`, `license`, ordered `intervals[{fromUtc,toUtc,forecastGPerKwh,actualGPerKwh}]`. Both factor properties may be null; their use is restricted by the method. Never invent provider issuance time from retrieval time.

### M02 shared contract clarification

The strict Zod schemas in `src/domain/schemas/` own these field names. Comparison snapshot references are `forecastSnapshotId` (UUID) and `forecastSnapshotHash` (lowercase `0x` plus 64 hex digits); candidates are `baseline`, `selected`, and `alternatives`. Ranks are one-based in the complete sorted candidate set; alternatives are the next three ranked candidates excluding the selected one (the baseline can appear). Snapshot hashes are supplied by trusted integration consumers; M02 does not implement or attest their digests.

UTC inputs require canonical whole-second `YYYY-MM-DDTHH:mm:ssZ` strings, with valid calendar dates and no leap seconds. Blocks must lie within earliest start/deadline; sorting is normalization, overlapping blocks are rejected, and touching blocks are allowed. `confirmedAtUtc` cannot be in the future relative to the injected comparison clock. External numeric factors and totals must be safe integers; intermediate arithmetic uses BigInt and rejects an unsafe final total.

The pure updated-result projection uses `reportId`, `snapshotHash`, `baselineActualMg`, `reportedActualMg`, `differenceMg`, nullable `differencePercent`, `status`, `reasonCodes`, and `deviationCodes`, alongside the evidence/method labels. No report yields `forecast_only`; a run with missing factors yields `actual_pending` with all updated amounts null. Report persistence, correction sequencing and cancellation authorization remain M07 responsibilities. Private report IDs are UUIDs; `did_not_run` after cancellation is a separate service-layer transition, not a bypass flag in the calculator.

M03's `GridSnapshotRecord` wraps the unchanged shared snapshot with server-generated `id`, `hash` and `attribution`. `hash` is SHA-256 over `CarbonShift:grid-snapshot:v1\n` followed by the normalized strict schema's fixed-order JSON projection. It includes truthful retrieval/source/license metadata; object input key order is normalized before hashing. It is a storage identity, distinct from M08's public JCS manifest/method hashes. Cache hits retain the entire original record; future M04 persistence must not rewrite snapshots. Empty actual responses return null, not an invalid empty snapshot or zero-valued factors.

## 3. Relational records

| Table | Principal columns | Constraints/access |
|---|---|---|
| `profiles` | `user_id` PK/FK Auth, `created_at` | Owner read; no public profile directory |
| `grid_snapshots` | `id`, normalized JSON, digest, source, retrieval time | Insert-only by trusted grid service; no member writes |
| `comparisons` | `id`, `owner_id`, constraints/result JSON, snapshot FK, version, expiry | Owner read; server creates; immutable once issued |
| `plans` | `id`, `owner_id`, unique `comparison_id`, `mode=live`, accepted payload, `status`, accepted time | Server writes; immutable inputs; only status may cancel |
| `completion_reports` | `id`, `plan_id`, owner, sequence, `kind`, reported start, `profile_still_applicable`, reason, prior report FK | Insert-only; unique `(plan_id,sequence)`; newest report is current |
| `result_revisions` | `id`, `plan_id`, report FK, sequence, actual snapshot FK nullable, result JSON, reason | Insert-only; unique `(plan_id,sequence)`; recalculations create rows |
| `publications` | `id`, nullable unique `plan_id`, nullable `owner_id`, unique receipt ID, plan manifest JSON/hash, consent time/version, visibility | Owner read while linked; immutable manifest; public projection only |
| `published_results` | `id`, publication FK, nullable result revision FK, public sequence, manifest JSON/hash, consent | Unique `(publication_id,public_sequence)` and `(publication_id,result_revision_id)` |
| `ledger_operations` | `id`, publication/result FK, operation kind, expected hash, status, attempts, lease, transaction/block references | Private worker/service access; unique operation identity |
| `ledger_signed_transactions` | operation FK, nonce, raw signed bytes, transaction hash | Worker-only; persist before broadcast; never expose to web clients |
| `mutation_keys` | owner, route scope, idempotency key, request digest, response reference, expiry | Unique owner/scope/key; mismatch returns conflict |
| `ai_runs` | request ID, owner nullable, task, provider, model, prompt version, latency, token counts, outcome | Metadata only by default; no raw user text |
| `usage_buckets` | hashed subject, bucket type, window start, count | Atomic server-only limits; no arbitrary member writes |

Use FK constraints, unique indexes, CHECK constraints, and database transactions rather than relying on a UI sequence. Restrict administrative SQL functions; secure any elevated function with fixed `search_path` and explicit authorization.

For publications, use `ON DELETE SET NULL` on private plan/owner links; for published results, use it on the private result link. Published manifests contain their own sanitized snapshots and remain interpretable without those private rows. Account deletion can therefore remove private plans/reports/comparisons while retaining the disclosed proof and clearing owner links. Never cascade-delete an already-published proof by accident. Full retention policy is in [11](11-security-privacy-and-abuse.md).

## 4. Relationships

```mermaid
erDiagram
  PROFILE ||--o{ COMPARISON : owns
  GRID_SNAPSHOT ||--o{ COMPARISON : informs
  COMPARISON ||--o| PLAN : accepted_as
  PLAN ||--o{ COMPLETION_REPORT : receives
  COMPLETION_REPORT ||--o{ RESULT_REVISION : calculates
  GRID_SNAPSHOT o|--o{ RESULT_REVISION : informs
  PLAN ||--o| PUBLICATION : optionally_publishes
  PUBLICATION ||--o{ PUBLISHED_RESULT : appends
  RESULT_REVISION ||--o| PUBLISHED_RESULT : optionally_discloses
  PUBLICATION ||--o{ LEDGER_OPERATION : queues
```

Demo page fixtures are read-only local assets and are not represented as real users/plans. A testnet replay may be produced by an explicit operator script with `mode=demo`; it belongs in a separate fixture/export path and never appears in live member statistics.

## 5. Plan and completion transitions

Comparisons are immutable, short-lived proposals. Accepting creates `plans.status=accepted`. The server rejects expired comparisons or ones whose baseline/selected start is less than ten minutes away at acceptance.

An accepted plan may:

- Receive a `ran` report after the reported cycle has finished.
- Receive a `did_not_run` report after the selected cycle would have finished.
- Be cancelled before its selected start if no completion report exists. Cancellation atomically sets status and creates a `did_not_run` report with reason `cancelled_before_start`.

Cancelled plans are terminal in the MVP. A later actual run uses a new plan; do not revive an already-public cancelled commitment.

Correcting a completion creates a new report with `prior_report_id` and a nonempty reason. Current user-visible completion is derived from the newest report, never a mutable overwrite. Corrections cannot be future-dated.

For `ran`, `profile_still_applicable` is a required boolean confirming whether accepted duration/energy assumptions still apply. False preserves the report but yields `outside_supported_window` with reason `PROFILE_CHANGED`. For `did_not_run`, reported start and this confirmation are null. Do not infer confirmation from an omitted field.

Cancellation blocks a new publication preview. An unsigned queued commitment is marked failed/cancelled under the same plan lock. Already-signed or broadcast transactions cannot reliably be recalled: reconcile them and retain the cancelled status alongside any resulting original commitment. Publishing the non-run result requires separate consent.

## 6. Result statuses

| Status | Meaning and numeric policy |
|---|---|
| `forecast_only` | No completion report; original forecast comparison remains visible |
| `actual_pending` | Run reported but one or more baseline/run actual factors missing; observed totals/difference are null |
| `actual_estimate` | Complete actual-factor coverage; estimated cycle profile still assumed |
| `did_not_run` | No run comparison; all observed totals/difference are null |
| `outside_supported_window` | Reported time or changed profile cannot be evaluated under this method; explicit reason and no fabricated result |

Each result includes `executionBasis=self_reported`, `energyBasis`, method version, report ID, snapshot hash if present, baseline and reported run estimates, delta, and failure/missing-data reasons.

Refreshing pending data produces a new result revision and preserves the old state. Publish only explicitly approved revisions, with a separate consecutive public sequence. A private correction does not imply the current public receipt is up to date; owner UI says “Unpublished changes.”

## 7. Ledger operation transitions

```text
queued -> signing -> submitted -> confirmed
                 \-> failed
submitted -> uncertain -> submitted | confirmed | failed
confirmed -> uncertain  (chain reorganization detected)
```

A queued lease may expire and be reclaimed. Before reclaiming a signing job, inspect durable signed bytes and transaction hash. Signing and broadcasting are not safely repeated with fresh nonces.

Retries of the same command reuse the same operation and hash. Changing payload requires a new domain revision, not a reused idempotency key. `failed` does not erase the private plan.

Confirmation policy: two blocks after inclusion plus matching chain ID, contract address, event parameters, and canonical block hash. Two confirmations are a prototype policy, not finality assurance.

## 8. Transaction boundaries and authorization

- **Accept:** verify owner/expiry/version → insert plan once → store idempotency result.
- **Report/correct:** lock plan row → allocate report/result sequence → insert both → return canonical result.
- **Publish:** verify owner/consent/hash/time → insert immutable publication + outbox → return operation.
- **Publish result:** lock publication → allocate public sequence → store consent/manifest/outbox atomically.
- **Delete private data:** for individual deletion, check no publication dependency; for reauthenticated account deletion, stop unsigned queued work, reconcile already-signed operations, sever private/public links as above, then remove eligible private records. Preserve public commitments/disclosed copies as explained to the user.

Use user-scoped Supabase clients for owner reads. Privileged services performing writes must check validated Auth identity and ownership before use; never accept `owner_id` from the request body.

RLS tests must attempt cross-user SELECT, INSERT, UPDATE, DELETE and direct function calls. Public reads are dedicated allowlisted views/service projections filtered by explicit consent and visibility, never `SELECT *` on private tables.
