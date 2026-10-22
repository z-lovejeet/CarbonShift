# CarbonShift — security, privacy, and abuse controls

Version 1.3 · 22 October 2026 · M06 shared admission, OAuth/mutation throttles and privacy boundaries implemented and locally exercised. M07 private deletion/reauthentication is implemented; production proxy coverage and publication-aware controls remain pending; this is not a security certification.

## 1. Assets and threats

| Asset | Relevant failure | Required control |
|---|---|---|
| Private plans/account | Another member reads or changes a plan | Server identity/ownership checks, RLS, adversarial two-user tests |
| Model API budget | Anonymous abuse or retry loop | Authenticated live AI, atomic quotas, bounded calls, provider budget alerts |
| Ledger key | Key exposed to browser/repository/model | Worker-only secret, dedicated testnet key, secret scanning |
| Calculation integrity | Client supplies fake totals or altered snapshot | Server recomputation, immutable snapshots, deterministic verifier |
| Public receipt | PII accidentally published | Allowlist projection, exact preview, explicit consent, separate result consent |
| Chain status | Timeout shown as confirmed | Durable outbox, receipt reconciliation, explicit uncertain state |
| Model interpretation | Prompt injection or invented deadline | No tools, strict schema, semantic checks, human confirmation |
| Grid response | Malformed, incomplete, or stale input | Adapter validation and coverage/freshness gates |

## 2. Identity and authorization

Use Supabase-supported Google/GitHub OAuth with SSR PKCE and server-validated identity. Email/password authentication remains disabled under U16. Store no provider tokens or passwords in application tables; OAuth client secrets remain in Supabase provider configuration. Validate callback destinations and never log authorization codes or cookies.

Validate the session on the server using the selected supported Supabase SSR method. Do not trust an unchecked cookie's user ID. Configure secure cookies and same-origin protections consistent with the SDK.

Every private object lookup checks ownership. Another member's UUID returns 404, not a response that reveals existence. Public views only include explicitly consented publication fields.

Deletion requires a recent reauthentication step using the authentication provider, not a frontend checkbox alone. Operation and result routes need the same ownership checks as plan routes.

## 3. Database controls

Enable RLS on member-facing tables. Default deny, then grant only the needed operations. Use atomic service-layer commands for immutable state transitions; members must not directly UPDATE accepted payloads or published digests.

If elevated server credentials are used for transactions, validate identity and ownership before executing them. Elevated credentials do not inherit the protection of user-scoped RLS automatically. Restrict worker tables to worker/service credentials.

Public receipt responses are projections defined in document 10. Never serialize complete database rows. For privileged SQL functions, fix search path, validate parameters, and explicitly restrict execute grants.

## 4. Secret boundaries

| Secret/configuration | Permitted location |
|---|---|
| Gemini/Groq keys | Server environment only |
| Supabase privileged key | Trusted server/worker environment only |
| Supabase public URL/publishable key | Browser permitted with correct RLS |
| Ledger private key | Dedicated worker environment only |
| Private RPC credentials | Server/worker environment only |
| Chain ID/address/public explorer URL | Browser/public documentation permitted after verification |

Use local ignored environment files and host secret stores. `.env.example` contains variable names and nonsecret illustrative values only. Never paste keys into prompts, screenshots, source files, or public issue text.

Generate a dedicated testnet issuer wallet, not a personal savings wallet. No real funds or mainnet use is part of the MVP. Do not silently change networks when testnet funding fails.

## 5. AI and untrusted input

Treat user text, bundle fields, provider responses, and model outputs as data. Models have no tool permissions. Do not include secrets/system internals in prompts.

Plain text limit: 1,000 characters. Validate all returned fields and source-span indices; reject unsupported dates/units and unexpected properties. A valid schema does not establish correct meaning. Human confirmation remains mandatory.

Do not log raw text by default. Disclose Gemini/Groq processing before optional AI use, including cross-provider fallback. Manual mode remains available.

Free Gemini evaluation uses authored non-personal examples. Its unpaid data-use terms differ from the application's metadata retention; public UK Gemini use requires the deployment decision in document 09. Neither a populated key nor a model quota makes that deployment eligible. Both product AI roles remain bounded structured transformations; no new autonomous assistant is approved.

No HTML from a provider is rendered unescaped. Local verification parses JSON only; no `eval`, dynamic imports, embedded URLs, or script execution from a bundle.

## 6. Data disclosure and retention

| Data | Proposed retention and user control |
|---|---|
| Unsaved form/AI text | Browser memory for the session; no ordinary server persistence |
| Unaccepted comparisons | Delete after 24 hours |
| Unpublished plans/reports | Owner can delete; default prototype retention 30 days |
| AI operational metadata | 7 days; no raw task text |
| AI task keys/input HMACs and explanation-code cache | At most 24 hours; no extraction output/raw text; code cache is owner/comparison/version-bound |
| Quota reservations and concurrency/circuit leases | Until the final applicable window/lease expires; de-identified metadata only, never raw IPs/codes/cookies |
| Idempotency records | 24 hours; permanent domain constraints still prevent duplicates |
| Consented public bundles | Retain as receipt evidence until explicitly revised policy; may be copied externally |
| On-chain events/digests | Public and effectively irreversible for this application |

Implement cleanup as an explicit administrative script with dry-run output and dependency checks. During the prototype, the operator runs it; do not advertise automatic retention enforcement until a scheduler is actually configured and tested.

Deleting an account removes private account mappings and eligible private data. Already-public bundles are de-identified with respect to account ownership but may retain disclosed schedule/energy information. Consent must explain that before publication. Do not promise erasure of blockchain records or third-party copies.

Public pages use `noindex` and random IDs, but neither is an access-control boundary. Anyone with or discovering the URL may read it.

## 7. Abuse limits

Initial application policies:

- AI: 5 tasks/minute and 20/day per user; 200 provider calls/day application-wide.
- Comparisons: 10/minute per user; coalesce/reuse grid requests when appropriate.
- OAuth starts: 10/10 minutes per signed browser identifier; broader 60/10 minutes per trusted client-IP bucket.
- OAuth callbacks: separate 20/10 minutes per signed browser identifier and 120/10 minutes per trusted client-IP bucket, preserving legitimate redirects/recovery.
- Protected mutation ingress: 30 requests/minute per authenticated user, including repeated/invalid submissions; existing operation-specific limits still apply. Sign-out and ordinary private reads are not gated by AI/task budgets.
- Publication: 5 new receipt commitments/day per user; 20 result publications/day.
- Public receipt/chain reads: 60/minute per coarse hashed client bucket, with shared caches.
- JSON request body ≤16 KB; exported/imported bundle ≤256 KB.

Store limits atomically in Postgres. An in-memory counter alone is insufficient on multi-instance hosting. Rate-limit identifiers should be short-lived HMACs using a server secret rather than storing raw IP addresses.

These limits are prototype choices, not researched provider quotas. Return useful retry guidance. Do not let one blocked AI operation disable private plan reading.

### M06 enforcement requirements

OAuth and mutation thresholds above are conservative engineering defaults to test, not observed provider limits or separate user-specified numbers. Use independent buckets so an AI limit cannot lock an account out. Browser pending guards improve interaction but do not enforce server policy. Login-start admission precedes provider redirect creation; callback admission precedes code exchange and must never store/log the query code. Use generic 429 recovery with truthful Retry-After, no account-existence signals and no automatic retry loops. Successful or throttled login attempts cannot destroy an existing valid session.

Create a random signed, HttpOnly/SameSite browser identifier for the short-lived bucket. Treat it as one signal: resetting a cookie does not reset the broader IP policy. Accept IP metadata only through the verified deployment proxy contract, normalize IPv4/IPv6 consistently, and HMAC with a short-lived scoped server secret. Never trust arbitrary forwarded headers or hash every missing address into one global “unknown IP.” Local tests/development may lack trusted IP metadata and use the browser bucket; production IP/edge coverage remains an M11 gate until verified. Shared-network tests must show the broader IP cap does not behave like a per-person lockout. Upstream Supabase/host controls complement these app limits; they do not prove them implemented.

Provider quotas are an additional layer owned by document 09: 17/day for the builder-reported 20-RPD 3.8 Flash bucket, a proposed 425/day Lite ceiling against the reported 500, and verified minute/token/shared-bucket limits before activation. More models do not multiply a shared quota. Model skips consume no provider call. Count every real dispatch/fallback conservatively, preserve the 200/day global ceiling and never refund uncertain timeout usage early. Per-user AI task allowances cover both roles together; internal fallback is not a new user task. Cache hits/rejected duplicate task keys issue no provider call; inbound protection still applies.

Implement multi-bucket admission, leases and at most two dispatch intents per AI task transactionally, using fixed-search-path service-only functions and stable lock ordering. A database failure refuses AI admission rather than permit unmetered requests. Existing immutable save idempotency/permanent uniqueness remain authoritative: a repeated save cannot duplicate records even after its command key expires. A lightweight ingress cap may still reject abusive retries, while plan reads let the user inspect an uncertain save. Never create a new key automatically to evade a quota/conflict.

Initial AI concurrency is one active task/user and two provider requests/application. Provider/model circuits open after three transient failures/60 seconds for at least 60 seconds; longer provider cooldown wins, with one leased recovery probe. See document 09 for deadline and accounting details. Public test fixtures use no provider calls; normal tests/CI use isolated stores and clocks. New controls require concurrency, expiry, failure and OAuth recovery evidence before claiming G06 hardening complete.

## 8. Server and network controls

Provider destinations are allowlisted and constructed from validated parameters. No arbitrary fetch URL is accepted from users or bundles. Timeouts apply to every external call.

Set a deployment-appropriate content security policy, frame restrictions, HTTPS behavior, and referrer policy; verify required auth/provider interactions before enforcing. Public manifests must not contain signed private-storage URLs. No third-party tracking is required.

Validate request origin for cookie-authenticated state changes and use the selected framework's supported CSRF protections. Do not assume using POST alone prevents CSRF.

## 9. Required security evidence

Before public use, demonstrate:

1. Member A cannot access/change B's records through API or direct DB access.
2. Unauthenticated callers cannot consume live AI or create ledger jobs.
3. Browser bundles contain no privileged key or signer.
4. A malicious instruction inside timing text cannot change system policy or publish anything.
5. A changed public bundle yields a mismatch.
6. Duplicate/reordered ledger jobs do not create duplicate commitments.
7. Deleted private records no longer appear in owner/list APIs.
8. Public bundle projection contains no raw text, user IDs, email, or other private fields.

Actual test results belong in the development status log. No control should be described as implemented merely because it is specified here.

### M07 deletion baseline

Private plan/account deletion requires a new same-account Google/GitHub OAuth exchange, a signed request nonce, and a session-bound ten-minute server receipt. Account deletion also requires explicit acknowledgement. An unrelated provider identity, ordinary token refresh or stale/tampered receipt is rejected. Receipts and pending OAuth intent are cleared on sign-out/account deletion. The M07 implementation has no public records; public/chain retention and deletion races must be extended before M09. Deleted-plan acknowledgement metadata expires after 24 hours, is physically pruned on the next explicit `lifecycle:maintenance --apply` run, and is deleted on account removal. Grid snapshots have no identity and orphan rows are removed transactionally when their owning private records are deleted. Existing provider quota reservations are not refunded by deletion.
