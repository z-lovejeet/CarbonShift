# CarbonShift — architecture and system design

Version 1.6 · 22 October 2026 · M04–M06 run locally, including evaluated AI routes and shared admission. Timing assistance is experimental/manual-first. Web deployment and ledger remain later work.

## 1. Architectural choice

Use one Next.js application with a modular TypeScript core, Supabase Auth/Postgres, two small AI adapters, and a small Solidity contract. A separate single-instance Node ledger worker handles queued testnet writes. It can run on the builder's computer during the prototype; the UI must show when publication is queued rather than claiming always-on processing.

Alternatives considered:

- A browser-only planner is simpler but cannot safely hold provider keys or reliably manage accounts and receipt issuance.
- A microservice/agent platform adds deployment and coordination overhead without helping the bounded workflow.
- The selected modular application keeps scheduling and verification pure, while isolating network and persistence failures.

## 2. Component diagram

```mermaid
flowchart TD
  U[Member or visitor browser] --> W[Next.js pages and route handlers]
  U --> V[Local bundle verifier]
  W --> A[Supabase Auth]
  W --> D[(Postgres with RLS)]
  W --> S[Pure scheduling and carbon modules]
  W --> G[Grid adapter and immutable snapshots]
  G --> N[NESO national API]
  W --> I[AI task router and schema validation]
  I --> GE[Gemini API]
  I --> GR[Groq API]
  W --> O[(Ledger outbox)]
  L[Single ledger worker] --> O
  L --> R[Allowlisted Sepolia RPC]
  R --> C[ShiftReceipt contract]
  W --> R
  V --> S
  V --> H[Canonical JSON and SHA-256]
```

The database is the source of private application records. The contract is the source of anchored hashes and revision order. Neither independently verifies appliance operation. AI is a bounded transformation service and cannot call the database, RPC, or arbitrary tools.

## 3. Module contracts

| Module | Input → output | Dependencies and ownership |
|---|---|---|
| `domain/constraints` | Reviewed fields → validated UTC constraints or typed errors | No network; method rules |
| `domain/scheduling` | Constraints + immutable grid snapshot + profile → candidate comparison | Pure; no model or database |
| `domain/carbon` | Wh bins + aligned factors → integer mgCO₂ | Pure; never invent missing factors |
| `domain/proof` | Versioned manifest → canonical bytes/hash and checks | Shared browser/server, no secrets |
| `server/grid` | Requested UTC range → validated snapshot | NESO adapter, bounded cache |
| `server/ai` | Task context → validated suggestions/explanation keys | Gemini/Groq, limits, telemetry |
| `server/limits` | Trusted request/task identity + operation → atomic admission/lease or retry guidance | Postgres shared counters/reservations, no model calls |
| `server/plans` | Authenticated command → immutable plan/report/result | Transactional DB operations |
| `server/publication` | Explicit consent + immutable revision → outbox operation | Publication validation, authorization |
| `worker/ledger` | Durable job → signed/broadcast/confirmed state | Dedicated testnet signer and RPC |
| `server/receipts` | Public receipt ID → approved manifest revisions | Sanitized projection only |

Dependencies flow inward toward `domain`; pure domain modules never import server modules.

### M06 orchestration boundary — target

The router authenticates/validates consent, deduplicates the logical AI action, checks the selected deployment profile and atomically reserves applicable user/application/provider/model capacity before network dispatch. It skips unavailable/unqualified/capped candidates in the ordered registry; this is separate from its maximum two real attempts/task. Quotas and circuit/concurrency leases are shared across instances, not process-local counters. Shared provider quota IDs prevent model aliases or different AI roles from creating fictitious capacity. Full policy is in [09](09-ai-agents-models-and-workflow.md), abuse limits in [11](11-security-privacy-and-abuse.md), and target records in [06](06-data-model-and-state-machines.md).

The two AI roles remain interpretation and explanation. Human confirmation separates interpretation from deterministic scheduling. The existing comparison-explanation endpoint loads optional reason codes after the actual result is visible; no model response blocks grid calculation, acceptance or manual input. Independent users may execute within leased capacity; no speculative parallel model race or autonomous tool loop is added. AI task/attempt bookkeeping cannot become plan acceptance or publication consent.

M06 implements shared server limits on login starts/callbacks and private mutation dispatches, preserving PKCE/redirect behavior and stable save retries. Trust IP metadata only from an explicitly configured deployment proxy; production proxy coverage remains an M11 gate. Existing per-member comparison limits remain; no generic throttle replaces ownership, RLS or transactional idempotency. The policy/parser supersedes the four legacy model fields. Web AI remains disabled until qualification; operational checks and live evidence are separated in the status log.

### Functional backend requirement

Live screens consume authenticated persisted records, validated provider responses, and deterministic domain outputs. Never hardcode a successful save, impact total, user history, model response, or transaction confirmation. Failed dependencies return the specified error/unavailable states; mock adapters and authored fixtures are confined to isolated tests and the labeled demo. Method constants are named/versioned in the domain layer; credentials, deployment addresses, and model selections use validated environment configuration. No product phase passes on untested stubs.

## 4. Planning and acceptance sequence

```mermaid
sequenceDiagram
  participant User
  participant Web as App server
  participant AI as AI provider
  participant Grid as Grid adapter
  participant DB as Database
  User->>Web: Optional timing text
  Web->>AI: Bounded extraction request
  AI-->>Web: Candidate fields and source spans
  Web-->>User: Editable interpretation
  User->>Web: Confirm fields and compare
  Web->>Grid: Fetch covered forecast
  Grid-->>Web: Immutable normalized snapshot
  Web->>Web: Validate and compute deterministic candidates
  Web->>DB: Save private comparison with expiry
  Web-->>User: Baseline, recommendation, assumptions
  User->>Web: Accept comparison ID + version
  Web->>Web: Recheck time, ownership, expiry, snapshot identity
  Web->>DB: Atomic immutable accepted plan
  Web-->>User: Saved plan; optional publication
```

A stale comparison causes a new comparison and user review. The server must not accept one comparison while displaying another. Acceptance uses an idempotency key and a unique comparison-to-plan relationship.

### M04 implemented service boundary

`server/auth/session.ts` validates identity with Supabase `getUser()`; it never authorizes from cookie claims alone. SSR PKCE exchanges and sign-out run in route handlers. `src/proxy.ts` refreshes sessions and guards `/app/*`; each private API also validates independently. Cookies are HttpOnly, SameSite Lax and Secure on HTTPS. Local OAuth uses the exact configured loopback origin. The M05 default post-login destination is `/app`; invalid/external return destinations still fall back safely to `/login`.

`server/plans/handlers.ts` validates strict request contracts, records its own clock, reserves an atomic per-member comparison quota, invokes the real grid adapter and pure scheduler, then persists the comparison. Its injectable factory is for isolated tests; the production entry has no fixture/clock override. User-scoped reads apply RLS plus an explicit owner filter before elevated acceptance. Fixed-search-path, service-only database functions implement snapshot/comparison insertion and locked immutable acceptance. Database errors become sanitized HTTP failures, never successful saves. Every returned detail revalidates the saved snapshot digest and domain payload.

`server/db/database.types.ts` is generated from the linked development schema. SDK types catch schema drift at compilation; Zod still validates untrusted runtime responses. Supabase HTTP calls have an eight-second timeout. Private responses are non-cacheable; request bodies are bounded by size and time. Next's incoming development request logging is disabled to avoid recording callback authorization codes.

## 5. Publication and reconciliation

1. Server builds the public manifest from allowlisted immutable fields.
2. User sees the publication preview and consents to its exact hash.
3. One DB transaction stores consent, manifest, and uniquely keyed outbox operation.
4. The worker claims a job using a database lease. Only one signer worker runs in the MVP.
5. It checks chain state before signing, validates commit deadline, obtains nonce, signs, and durably records the raw signed transaction before broadcast.
6. Broadcast may be retried with the same raw transaction. Do not allocate another nonce simply because a request timed out.
7. Persist transaction hash and receipt block hash; mark confirmed only after two confirmations.
8. Status requests compare with chain state. A lost/reorganized receipt returns to submitted/uncertain rather than staying falsely confirmed.

Raw signed transaction bytes belong in a worker-only table and must not appear in browser responses. A transaction is public once broadcast; the private signing key is never stored in the application DB.

The worker checks cancellation and commit deadline again immediately before signing, under the same plan/job lock used by cancellation. A live commitment arriving after the earlier baseline/selected start is rejected by the contract. Once a transaction is durably signed, cancellation cannot assume it can be recalled; reconcile it and expose the cancelled plan separately. Result revisions wait for confirmed plan commitment and preceding result revision.

## 6. Completion and corrections

A completion report is immutable. Recalculation fetches an actual-factor snapshot for both baseline and reported run; pending values yield a result with unavailable observed comparison. A later refresh creates another result revision referencing the same report only when relevant actual factors or result semantics change; retrieval-only changes reuse the prior revision. Editing the report creates a new report and result revision with a reason.

Private corrections do not automatically disclose new data publicly. A member separately previews/consents to each published result. Public revision numbers are consecutive and may skip private result revisions; both identifiers remain in the manifest. This prevents a hidden correction from being silently represented as publicly acknowledged.

## 7. Failure isolation

| Failure | Required behavior |
|---|---|
| AI timeout, schema failure, quota | Fall back within the bounded policy; then manual fields/template |
| Grid unavailable | Show last retrieval age; stale snapshots may be viewed but cannot create fresh live comparisons |
| Partial grid coverage | Refuse optimization over the incomplete requested window; show affected range |
| Auth unavailable | Keep public demo/read-only content available; refuse private writes |
| Database write failure | Do not acknowledge acceptance/publication; safe idempotent retry |
| Worker offline | Publication stays queued; private planning continues |
| RPC timeout | Preserve job/transaction reference; mark unknown state; check before retry |
| Contract revert | Show typed failure and preserve the private plan |
| Missing public bundle | On-chain hash still exists but content cannot be reconstructed; verification is unavailable |

## 8. Time, caching, and environment isolation

All stored instants are UTC. UI interprets scheduling fields in Europe/London regardless of the builder's location. Demo clock is injected only into demo/domain fixtures; live command handlers use server time.

Grid retrieval cache: five-minute reuse for identical covered requests. Forecast acceptance age cap: 30 minutes since retrieval, with explicit coverage checks; this is an application policy, not a supplier guarantee of forecast issuance time.

Local tests use an isolated database and local chain. Live deployment uses its own secrets and Sepolia contract. Demo fixtures never write into member live-plan tables. Testnet replay records carry `mode: demo` in both manifest and contract; they cannot become `live`.

## 9. Deployment boundary

Proposed web host: Vercel; data/auth: Supabase; ledger worker: explicit local Node process for the prototype. The public web app can run while the local worker is offline, but publication cannot complete then. Always-on external deployment requires moving that same worker to an approved persistent host and testing its restart behavior.

Deployment/manual steps are in [14](14-manual-setup-guide.md). Source versions and folder layout are in [05](05-tech-stack-and-folder-structure.md). Database authority is [06](06-data-model-and-state-machines.md); wire contracts are [07](07-api-and-integrations.md).

## 10. M03 integration boundary

`server/grid/index.ts` is the server-only product entry point. It owns a process-local client with real fetch and server time. `client.ts` exposes dependency injection only for isolated replay tests and the explicit local check script. Provider parsing, bounded transport and immutable snapshot identity are separate modules, reusing the pure M02 validators/calculator. Neither server module imports the demo or recorded fixtures. No public unauthenticated grid proxy or new page is added.

The cache is a bounded optimization per process, not durable storage or a source of new retrieval timestamps. Its loss may cause another public read; a failed read cannot become a fixture or stale successful comparison. The returned record supplies `id/hash/snapshot/attribution`, now persisted transactionally by M04. M04 authenticates, validates the trusted live clock, checks ownership, maps typed failures and freezes reviewed comparisons; M03 does not implement that API lifecycle.

## 11. M05 manual interface boundary

`contracts/planning.ts` owns the shared Zod API schemas; the M04 server path re-exports them for compatibility. Browser code never imports server credentials or database modules. P03/P05 use validated server identity plus the existing repository; load failures cannot become empty success. P04 supplies the current server time to a browser controller; local prevalidation shares the pure date/profile/constraint modules, while the API recomputes every authoritative value. UI expiry is advisory and uses monotonic elapsed time relative to a server reference.

The live controller posts confirmed fields, then reads `GET /comparisons/{id}` for the already-saved snapshot and verifies that the returned comparison equals the issued response. No extra grid request changes its forecast. Saving sends only ID/version and a stable random retry key; a valid-looking response for different reviewed inputs is rejected. Uncertain saves may be retried with that same key after UI expiry to discover an already-committed result; a definite expiry/version failure requires another reviewed comparison.

The shared planner receives a live or demo adapter. Only the dedicated demo module imports the synthetic fixture and fixed clock; its discriminated interface exposes no save function and only creates a local preview. No demo server mode, fake-login switch or fixture-backed live endpoint was added. Offline browser tests exercise the shared UI via the labeled demo; the explicit `check:planner` command separately provisions two temporary development Auth sessions and drives ordinary protected pages/API against real grid/Supabase services. These seeded sessions are not evidence of new OAuth provider sign-ins.
