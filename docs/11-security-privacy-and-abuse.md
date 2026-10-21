# CarbonShift — security, privacy, and abuse controls

Version 1.0 · 20 October 2026 · Proposed controls and verification requirements, not a security audit or compliance certification.

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

Use Supabase-supported email/password and recovery flows; never store passwords in application tables. Require email confirmation according to actual provider configuration before enabling live writes.

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

No HTML from a provider is rendered unescaped. Local verification parses JSON only; no `eval`, dynamic imports, embedded URLs, or script execution from a bundle.

## 6. Data disclosure and retention

| Data | Proposed retention and user control |
|---|---|
| Unsaved form/AI text | Browser memory for the session; no ordinary server persistence |
| Unaccepted comparisons | Delete after 24 hours |
| Unpublished plans/reports | Owner can delete; default prototype retention 30 days |
| AI operational metadata | 7 days; no raw task text |
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
- Publication: 5 new receipt commitments/day per user; 20 result publications/day.
- Public receipt/chain reads: 60/minute per coarse hashed client bucket, with shared caches.
- JSON request body ≤16 KB; exported/imported bundle ≤256 KB.

Store limits atomically in Postgres. An in-memory counter alone is insufficient on multi-instance hosting. Rate-limit identifiers should be short-lived HMACs using a server secret rather than storing raw IP addresses.

These limits are prototype choices, not researched provider quotas. Return useful retry guidance. Do not let one blocked AI operation disable private plan reading.

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
