# CarbonShift — security, privacy, and abuse controls

Version 1.4 · 23 October 2026 · M09 exact consent, signer/outbox and publication-aware deletion controls implemented. Production proxy coverage and external release checks remain pending; this is not a security certification.

**U34 target revision · 23 October 2026:** the approved household expansion at the end of this document supersedes conflicting washing-only restrictions for new v2 work. Earlier sections retain v1 contracts and historical implementation evidence. New capabilities are not passed until recorded in status.

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

## M09 consent and signer controls

Migrations 008/009 enforce immutable public text/digests, unique operations/nonce, owner-only reads and service-only preview/signing/lease functions. No web client can read raw transaction bytes or invoke a privileged publication function directly. Exact preview consent is separate from saving/reporting, rejects changed/expired/context-mismatched data and discloses schedule/blocked-time/energy privacy plus lasting copies. Result correction text is separately entered; private reasons/notes never auto-publish.

The signer is loaded only by the worker/deployer entry points from ignored `.env.worker.local`. `.env.local` receives RPC/public chain metadata, never the private key. The deployment journal is ignored with owner-only permissions; signed bytes are operational recovery data and never returned in app responses. The worker does not log raw RPC errors, keys or signed bytes. Its fenced lease and plan lock prevent unsigned cancellation/deletion races; already signed operations remain reconcilable after private data removal. New publication limits are five commitments and twenty results per UTC day; retry replay does not create another operation. No paid activation or mainnet path exists.

## Household expansion — U34 security and privacy

Whole-day schedules expose routines. Treat names, fixed times, availability, resource labels, free text and notes as private. Interpretation is explicit opt-in; send only the current minimal draft, never account/history/wallet data. Raw prompts/results remain transient and absent from ordinary logs. HMAC metadata and retention controls continue across variants.

V2 requests keep owner checks before elevated writes, owner-scoped RLS, strict finite integer schemas, bounded body sizes and shared mutation/AI budgets. Bound tasks (12), windows/blocks (8 each), resources (4), segments (48), solver nodes (50,000), text (2,000 units) and public imports (1 MiB); reject unknown or cyclic relationships. Validate query/cursor/route IDs before database use. No arbitrary source-URL fetch, model-selected endpoint or script execution. Display user text as text; reject markup-based rendering.

Publication is separately consented per exact sanitized revision and states that timings/energy become public. Remove private names/IDs; show public aliases in preview. Deletion removes private routine data while retaining the previously disclosed immutable proof and clearing account links. A pending signed operation cannot be described as erased from the network; preserve existing uncertain-state reconciliation. Test current v1 deletion paths after adding v2 foreign keys.

No secrets in browser/session handoffs; use session storage only for reviewed non-secret draft fields with a short expiry and clear-on-sign-out. Auth navigation and server guards apply to both new pages. Existing OAuth/login protections, worker-only signer and reauthentication rules remain. Expanded documentation does not activate public Gemini access, billing or production deployment.

## M11 implemented retention and browser policy — 25 October 2026

Migration 014 adds service-only `cs_retention`, with a dry-run default, transaction advisory lock and bounded batches of at most 1,000 eligible parents. Unpublished private v1/v2 plans and dependent reports are eligible after 30 days; unaccepted comparisons after 24 hours. Expired command keys, previews and AI metadata use their existing expiries. Consent/publication is checked again under parent locks before deletion. Consented public copies and durable ledger operations are retained. Do not advertise immediate deletion: expired records become inaccessible under their time checks and physical cleanup depends on a completed maintenance run.

`pnpm retention` previews hosted counts; `pnpm retention --apply` explicitly applies cleanup. `vercel.json` declares a daily 03:17 UTC cron request authorized by server-only `CRON_SECRET`. Declaration does not prove the deployed cron is running; verify its first invocation after deployment. Local development still needs the explicit command. The isolated integration test exercises actual cleanup without touching hosted users.

Production headers restrict browser fetches to this origin, forbid framing and object embedding, and allow the browser's local proof worker. Forms allow the same origin, the exact configured Supabase Auth origin and the supported Google/GitHub OAuth redirect destinations. Next's inline bootstrap/style requirements remain permitted; `unsafe-eval` and development WebSocket access are absent in production. This is a static CSP, not a nonce-based policy. HSTS, nosniff, strict-origin-when-cross-origin and disabled camera/microphone/geolocation/payment capabilities are set centrally. A no-referrer document policy makes Chromium submit native forms with Origin: null and breaks the unchanged strict same-origin check; the selected policy preserves that check while limiting cross-origin referrers to the origin. Provider redirect responses keep their separate no-referrer policy. Vercel's trusted client-IP header must be verified on the actual deployment before being enabled; request headers supplied directly by callers are not trusted locally.
