# CarbonShift — API and external integration contracts

Version 1.7 · 23 October 2026 · Base path `/api/v1`. M04–M09 private planning, AI/admission, lifecycle and owner publication APIs implemented; public receipt APIs remain M10.

**U34 target revision · 23 October 2026:** the approved household expansion at the end of this document supersedes conflicting washing-only restrictions for new v2 work. Earlier sections retain v1 contracts and historical implementation evidence. New capabilities are not passed until recorded in status.

## 1. Common conventions

JSON over HTTPS, UTF-8, explicit API schema version `1`. Authenticated routes validate a server-side Supabase identity. State-changing requests require same-origin protection and an `Idempotency-Key` where noted. User identity comes from the session, not JSON.

Success envelope: `{ "data": ..., "requestId": "uuid" }`.

Error envelope:

```json
{
  "error": {
    "code": "INCOMPLETE_GRID_COVERAGE",
    "message": "Forecast data do not cover the whole requested window.",
    "retryable": true,
    "fieldErrors": []
  },
  "requestId": "example-reference"
}
```

Do not expose raw provider messages or stack traces. `401` unauthenticated, `404` absent/not-owned, `409` stale state/idempotency conflict, `422` invalid domain input, `429` quota, `503` unavailable dependency. Malformed JSON is `400`.

All normal request bodies max 16 KB; local proof imports max 256 KB and never posted for AI. Public bundles may be up to 256 KB. Numbers use the units in [06](06-data-model-and-state-machines.md).

## 2. Application endpoints

| Method/path | Input | Output and rule |
|---|---|---|
| `POST /ai/constraints` | `{text, localReferenceDate, timezone:"Europe/London", aiConsent:true}` + `AI-Task-Key` | `ConstraintSuggestionV1`; authenticated, shared quota-aware dispatch, explicit review required |
| `POST /comparisons` | Reviewed constraint fields; baseline may request `earliest_feasible` before normalization | Saved `ComparisonV1`, confirmed baseline; incomplete coverage is 422/503 as appropriate |
| `GET /comparisons/{id}` | None | Owner-only `{comparison:ComparisonDocumentV1,forecastSnapshot:GridSnapshotV1}` from immutable saved records; no new forecast/recalculation |
| `POST /comparisons/{id}/explanation` | `{aiConsent:true}` + `AI-Task-Key`; no additional user text/totals | Validated explanation codes and template text from owned immutable facts; owner/version-bound cache |
| `POST /plans` | `{comparisonId, comparisonVersion}` + idempotency key | Immutable accepted plan; reject expired/time-invalid comparisons |
| `GET /plans` | Cursor and page size ≤20 | Owner's summaries; no global emissions totals |
| `GET /plans/{id}` | None | Owner plan, latest report/result, public status, revision list |
| `POST /plans/{id}/cancel` | `{reason}` + key | Atomic cancellation before selected start, subject to state rules |
| `POST /plans/{id}/reports` | `{kind, reportedStartUtc, profileStillApplicable, correctsReportId, reason}` + key; nullable field types defined below | New report + result revision; validates current report/state and required profile confirmation |
| `POST /plans/{id}/results/refresh` | `{expectedResultRevision}` + key | New result only if new data/status; otherwise return existing revision |
| `POST /plans/{id}/publication-preview` | None | Public manifest, digest, privacy disclosure, short-lived preview ID |
| `POST /plans/{id}/publication` | `{previewId, manifestHash, consentVersion, consent:true}` + key | Queued operation; recompute exact preview hash; never auto-consent |
| `POST /plans/{id}/results/{revision}/publication-preview` | `{correctionExplanation}`; separately reviewed public text, at most 500 characters | Result manifest with next public sequence and disclosure; private reasons/notes are never copied |
| `POST /plans/{id}/results/{revision}/publication` | Same consent shape + key | Appends consented public result; preceding operation must be confirmed |
| `GET /operations/{id}` | None | Owner-visible chain status/reference; excludes raw signed bytes |
| `GET /receipts/{receiptId}` | None | Public summary and approved revisions, or 404 |
| `GET /receipts/{receiptId}/bundle` | Optional public revision | Published bundle only; no PII/raw prompt |
| `GET /receipts/{receiptId}/chain` | None | Allowlisted RPC read of expected contract state/events; public, rate-limited |
| `DELETE /plans/{id}` | Reauthentication + key | Deletes eligible unpublished private plan; published plan returns documented restriction |
| `POST /account/delete` | Recent reauthentication + explicit acknowledgement + key | Removes eligible private records/account; handles public disclosure retention separately |
| `GET /health` | None | Minimal application health; no provider keys, balances, account details |

Google/GitHub OAuth uses Supabase SSR PKCE. POST `/auth/sign-in` validates the provider and same origin; GET `/auth/callback` exchanges the single-use code using its verifier cookie; POST `/auth/sign-out` clears the session. The callback destination is an allowlisted internal path. No password signup, recovery or email OTP product route is included under U16.

M06 adds login-start/callback server throttling and a coarse private-mutation admission layer using document 11's policies. The existing OAuth POST/PKCE contract remains; a throttled start does not call the provider or destroy a valid session. A callback admission failure must not consume/exchange its code, log its query, or redirect in an automatic retry loop. Render a safe recovery response with Retry-After and a link to restart sign-in if the code expires; do not claim a callback code can always be replayed.

Publication preview expires after five minutes and before the live precommit cutoff, whichever is earlier. Publication rechecks freshness/time/state. Any difference produces `409 PREVIEW_CHANGED` and another preview; consent is never transferred to changed data.

M09 clarification: a plan preview expires at the earlier of five minutes or ten minutes before the precommit cutoff; result previews expire after five minutes. Persist receipt identity/nonces before returning a preview; concurrent identical previews reuse the frozen bytes. A changed private plan version, public predecessor or reviewed explanation requires a fresh preview. `GET /plans/{id}/publication` and `GET /plans/{id}/publication/bundle` provide owner-only state/export during M09; public receipt/bundle/chain routes remain M10. Signed transaction bytes are never part of these responses.

The server supplies the trusted Europe/London reference date for live AI interpretation. A client `localReferenceDate` is accepted only if it matches that context; stale or conflicting dates require a refreshed review. Demo-relative dates are confined to fixture mode.

New plan publication requires an accepted, uncancelled plan. Cancellation/worker races follow document 06. A first report may omit a human explanation by sending an empty reason; corrections require a nonempty reason. `reportedStartUtc` is a timestamp for `ran` and null for `did_not_run`. `profileStillApplicable` is boolean for `ran` and null for `did_not_run`. `correctsReportId` is null for the first report and the current report UUID for a correction.

## 3. Example comparison input

This is an authored request illustration; timestamps must be regenerated from the actual planning clock for live requests.

```json
{
  "geography": "GB_NATIONAL",
  "timezone": "Europe/London",
  "earliestStartUtc": "2026-10-21T07:00:00Z",
  "deadlineUtc": "2026-10-21T11:00:00Z",
  "durationMinutes": 60,
  "energyWh": 1000,
  "energyBasis": "user_estimate",
  "blockedIntervals": [],
  "baseline": {
    "kind": "user_selected",
    "startUtc": "2026-10-21T07:00:00Z"
  },
  "constraintsConfirmed": true
}
```

Server converts the baseline union to `ConfirmedConstraintsV1.baselineStartUtc/baselineOrigin`, records confirmation time, validates coverage, calculates, and persists. It returns server-calculated numbers and a persisted snapshot reference; the client never sends carbon totals. `baseline` is strictly either `{kind:"user_selected",startUtc}` or `{kind:"earliest_feasible"}`. Extra fields (including owner IDs, totals or clocks) are rejected.

### M04/M05 response contracts

The executable authority is `src/contracts/planning.ts` (re-exported at the M04 `src/server/plans/contracts.ts` path), built on the strict domain schemas in document 06:

- `POST /comparisons`: `data` is `ComparisonV1` plus `schemaVersion:1`, server UUID `id` and `version:1`. It includes `forecastSnapshotId`/`forecastSnapshotHash`, rather than the entire forecast. Confirmation time and comparison expiry come from the server. No client authority fields are accepted.
- `GET /comparisons/{id}` (M05): returns `{comparison,forecastSnapshot}` using the same saved domain payload, ID/version and digest-validated snapshot. Owner reads only; foreign/missing IDs both 404, including expired comparisons (expiry affects acceptance, not historical reading). This supplies the chart/table without refreshing or changing the reviewed comparison.
- `POST /plans`: requires exactly `{comparisonId,comparisonVersion}` and an `Idempotency-Key` of 8–128 letters/digits/underscores/hyphens. `data` is `PlanV1`: `schemaVersion`, `id`, `version`, `comparisonId`, `mode:"live"`, `status`, `acceptedAtUtc`, the exact accepted `comparison`, and its validated `forecastSnapshot`. M04's derived fields are `completion:"not_reported"`, `publication:"private"`, `latestReport:null`, `latestResult:null`, `revisions:[]`; no completion/publication records exist yet. These explicit initial states are not simulated results.
- `GET /plans/{id}`: the same `PlanV1`, owner-only; missing/foreign IDs both return 404. Responses exclude owner IDs, Auth metadata and internal mutation/quota fields.
- `GET /plans?limit=20&cursor=...`: `data` is `{items:PlanSummaryV1[],nextCursor:string|null}`. A summary includes `schemaVersion,id,version,comparisonId,mode,status,acceptedAtUtc,baseline,selected,differenceMg,completion,publication`. Order is accepted time descending, then UUID descending; the opaque base64url cursor encodes the last whole-second UTC time and UUID. `limit` is 1–20 (default 20). Repeated or unknown query fields and malformed cursor contents are rejected before database filters are constructed.

All these JSON responses use the common request-ID envelope and `Cache-Control: private, no-store`; no global statistics or climate-impact aggregation is returned. JSON bodies require `application/json`; `413` means oversized, `415` wrong media type, `403` wrong/missing mutation origin. Quota failure returns `429` with `Retry-After:60`. Missing identity is 401; absent configuration or unavailable Auth/database is 503. Body reading is limited to 16 KiB/eight seconds. Same-origin mutations must use the exact `APP_ORIGIN` (local development `http://127.0.0.1:3000`).

OAuth form bodies have a separate 1 KiB cap and accept only `provider=google` or `provider=github`. Successful start/callback/sign-out returns a 303 with non-cacheable, no-referrer headers; provider errors use approved static copy. The callback never reflects raw provider errors or accepts an external return URL. No OAuth code/token is written to application logs.

## 4. Grid provider adapter

Official base URL: `https://api.carbonintensity.org.uk`.

- Planning: documented national `/intensity/{from}/fw48h`, with server-constructed ISO datetime and validated actual response coverage.
- Result calculation: documented `/intensity/{from}/{to}` for the union range covering baseline and reported run.
- Parse `data[]`, interval `from/to`, and `intensity.forecast/actual`; null actual values remain null.
- Reject malformed or duplicated intervals and nonfinite/negative values; preserve source/retrieval metadata.
- A five-minute application cache reduces requests; coalesce identical in-flight requests.
- Timeout 8 seconds; at most one retry for transient read failures within a 20-second comparison deadline.
- A successful HTTP response does not establish complete coverage. Method 08 defines exact acceptance.

Use only allowlisted provider URLs assembled from validated timestamps. Store normalized snapshots immutably. Attribute NESO Carbon Intensity API and CC BY 4.0 in methodology and exported bundles. [Official endpoint list and license](https://api.carbonintensity.org.uk/)

No provider API key is specified by the public quick-start. If authenticated access or terms change, update the adapter/setup rather than guessing a key.

M00 observation, 21 October 2026: the public 48-hour endpoint returned 97 contiguous half-hours, including one interval before the requested start, with 96 null actual values. Validate timestamps and requested coverage rather than assuming exactly 96 rows. Extra surrounding intervals may be retained in the source snapshot; only the required covered range participates in a calculation. Future actual values remain null. The [saved response observation](../research/phase-0/2026-10-21-grid-observation.json) is readiness evidence, not an implemented adapter or a reusable live forecast.

### M03 internal implementation contract

M03 internal grid contract (not a new public endpoint): `getForecast({fromUtc,toUtc})` returns an immutable `{id,hash,snapshot,attribution}` record after complete forecast coverage validation. The endpoints and cache keys are constructed only from strict UTC fields. Forecast bounds are aligned half-hours, with a positive span at most 48 hours. `getActual({fromUtc,toUtc})` rounds the required range outward to half-hours and supports a bounded 96-hour union range, enough for method v1's baseline/reported cycle. It returns a structurally valid partial snapshot or null for an empty series; missing actual coverage remains for the domain's `actual_pending` projection, never zero.

The provider's minute timestamps are explicitly normalized to canonical UTC seconds. Required known fields are validated; unused provider additions (such as intensity index) are discarded. Full snapshots retain extra contiguous edge intervals. Provider issuance stays null. Records get a server UUID and a digest of a versioned, fixed-field snapshot projection (`CarbonShift:grid-snapshot:v1\n` + JSON); this storage digest is not the M08 public manifest/JCS proof scheme or independent source certification. Attribution is NESO Carbon Intensity API, CC BY 4.0.

Five-minute cache reuse is per normalized request and process, with 32 retained entries and identical in-flight coalescing. Retrieval time/ID/hash are never refreshed on a hit. Expired or clock-future entries are not served as fresh on an outage. The live entry point supplies its own server clock and fetch; tests inject dependencies in the internal client only. Empty actual series and failed requests are not cached. Cache loss across server processes affects request volume, not calculation correctness.

Each read has an eight-second attempt timeout covering headers and body, one possible retry, and a twenty-second total deadline. Retry only transport/timeouts, HTTP 408/429 and 5xx; invalid schema/JSON and other 4xx fail immediately. Default retry wait is 250 ms; a valid Retry-After up to two seconds is honored, and a longer value returns the typed failure instead of waiting/retrying early. Redirects are refused, framework fetch caching is disabled, credentials are omitted, and response bodies are limited to 256 KiB and 256 intervals. These are application bounds, not provider quotas. Errors use sanitized static messages without raw bodies. Live checks are a separate explicit command; normal tests remain offline.

The M03 live check on 21 October 2026 used both national endpoints. Its [recorded normalized fixture](../src/fixtures/grid/neso-national-recorded-v1.json) is historical replay evidence only; it cannot be a live fallback. It includes source/retrieval data, null issuance, storage hashes and a scheduler comparison with explicitly illustrative cycle energy. Actual observed counts/times and executed checks are in the status log. The current [official definition](https://carbon-intensity.github.io/api-definitions/) documents a 14-day range limit; CarbonShift deliberately uses the tighter 96-hour actual-range bound for this method.

## 5. AI provider adapters

Provide one application interface:

```text
runStructuredTask(task, modelId, promptVersion, context, schema, deadline)
  -> {validatedOutput, provider, modelId, usage, durationMs, outcome}
```

Implement provider-native requests behind this boundary; do not assume identical SDK parameters. Use Gemini structured JSON and Groq strict JSON Schema where supported. Validate again locally and check domain meaning. Select exact model IDs and routing from [09](09-ai-agents-models-and-workflow.md).

No browsing, code execution, shell, arbitrary URLs, external tools, private database access, or contract signing is enabled for either product AI role. Keys remain server-only.

### M06 logical-task and recovery contract

Both AI endpoints require a UUID `AI-Task-Key` scoped to the validated member and role. It is separate from a persisted mutation's `Idempotency-Key`: raw extraction results are not stored for replay. Same key/different keyed fingerprint returns `409 AI_TASK_CONFLICT`; running returns `409 AI_TASK_IN_PROGRESS`; a completed/abandoned extraction returns `409 AI_TASK_FINISHED` with safe manual/new-explicit-request guidance and no second extraction. Reusing the key must not restart SDK/router calls or consume a fresh logical-task allowance. The keyed fingerprint includes current trusted reference date and schema/prompt/policy versions. Never log the original text or an OAuth code.

Authenticate, check origin/body/consent and comparison ownership first. An explanation cache hit may return validated codes without another AI task/provider charge, but the lightweight inbound throttle still applies. Resolve stored codes against current immutable facts and required limitations before rendering. A miss uses the same task/reservation contract as extraction. Model metadata and quota internals are not authority for user-visible facts.

Return `429 AI_RATE_LIMITED` for exhausted user/application capacity or a pool whose otherwise valid candidates are all quota-blocked, with bounded integer-second `Retry-After` derived from the earliest valid recovery across applicable windows. Return sanitized `503 AI_UNAVAILABLE` for unavailable/configuration/provider failures without usable fallback. Preserve the draft/manual/template path. Unknown recovery time is not invented. The common M06 error helper now carries actual retry guidance without changing response envelopes or echoing provider errors. Legacy comparison limits retain their existing 60-second default when no more precise recovery value is supplied.

Model candidates and shared budgets come exclusively from the validated server policy in document 09. Skipping a capped model emits no request; every real attempt reserves capacity and fits the task's two-call/deadline bound. No user request chooses a provider URL/model/bucket or supplies carbon facts. New mutation throttles must retain current permanent plan uniqueness and same-key recovery; quotas do not replace idempotency.

## 6. Blockchain read/write adapter

Network pin: Sepolia chain ID `11155111`. Contract address and deployment block are configuration written only after actual deployment verification. No fabricated default address.

Web server reads through the configured RPC. Worker alone writes; it checks chain ID, contract bytecode, ownership, and manifest digest before signing. Include contract ABI and method version in the build.

User-supplied URLs are never fetched by the server verifier. A downloaded bundle can be checked independently against the public explorer/another trusted RPC outside the app.

## 7. Idempotency and concurrency

Store body digest with owner/route/key. Identical requests return the original response reference. Same key with a different body returns `409 IDEMPOTENCY_CONFLICT`. Keep mutation keys 24 hours, while domain uniqueness constraints remain permanent.

Reports and public revision allocation lock their parent row. Two tabs cannot create the same revision. Ledger operations have separate durable identity and may outlive the web idempotency record.

## 8. Observability contract

Record request ID, operation type, status code, duration, provider/model ID, schema version, and sanitized failure code. Do not record passwords, bearer cookies, raw timing text, or private manifest contents by default.

Emit counters for incomplete grid coverage, model fallback, schema rejection, accepted comparisons, pending publications, and mismatched proofs. Counts are operational diagnostics, not climate-impact evidence.

### M07 concrete private commands

Reports accept exactly `{kind, reportedStartUtc, profileStillApplicable, correctsReportId, reason}`; reason is trimmed, at most 500 characters, and required for corrections. A first report uses `correctsReportId: null`. Cancellation accepts exactly `{reason}` with a nonempty reason. Refresh accepts exactly `{expectedResultRevision}` (positive integer). DELETE plan has no body. Account deletion accepts exactly `{acknowledgeDeletion: true}`. All commands require an 8–128 character Idempotency-Key and same-origin authenticated requests. Private deletion additionally requires recent same-account provider reauthentication.

Lifecycle acknowledgements are `{planId, planVersion, reportId, resultId, changed, deleted}`; report/result IDs may be null for deletion. Read detail after acknowledgement for the current history; a replay returns the original acknowledgement even after a later correction. Keys are scoped by owner, plan and command for 24 hours; changed input conflicts. Stale corrections/refreshes return 409. A deleted plan key can replay its acknowledgement for its authenticated owner. Account deletion removes the authentication identity; a subsequent request without that identity returns 401 rather than implying the account still exists.

Reauthentication starts at the existing `/auth/sign-in` form with provider and `intent=reauth`; no client return URL is accepted. The server signs a short-lived request nonce bound to the current owner, stores the nonce in a signed HttpOnly intent cookie bound to the browser’s PKCE flow, preserving the existing allowlisted callback URL, and requires a newly exchanged PKCE session for that same owner. The resulting HttpOnly, SameSite=Lax receipt is bound to its Supabase session ID and expires after ten minutes. Normal sign-in, session refresh and a query parameter alone cannot mint it. Provider SSO may reuse its own login; this proves a fresh provider exchange, not forced password entry.

Primary references checked for M07: [OAuth sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithoauth), [server-side admin deletion](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser). Administrative deletion stays server-only.

### M08 internal proof contract (no HTTP endpoint yet)

`buildPlanManifest(privatePlan, persistedIdentity)` returns a frozen sanitized live plan; `buildResultManifest(privatePlan, publicPlan, retainedReport, retainedRevision, actualSnapshotOrNull, publicOptions)` requires exact parent/snapshot pairing and separately reviewed correction text. Both reject unknown public fields and use the documented integer/UTC contracts. The nonce/receipt identity is supplied, not regenerated. No request-provided owner or totals become authoritative.

`exportProofBundle`/`importProofBundle` operate locally under a 256-KiB limit; imports reject duplicate keys, unsafe/non-integer numeric lexemes and invalid Unicode. `verifyProofBundle(bundleOrJson, optionalTrustedContext)` performs no I/O and returns seven separate checks plus computed digests, original/current issuer fields and limitations. Trusted context is `{expectedChainId, expectedContractAddress, chain}`; `chain` is a separately obtained state/event/block observation, or null. Embedded transaction references cannot substitute for it. The versioned generated ABI/build metadata are available for later adapters; no RPC read endpoint, worker write or public default address is implemented in M08.

## M09 executable publication contract

Plan preview accepts an empty body or `{}`; result preview accepts only `{correctionExplanation}`. Preview response is `{id,manifest,manifestHash,expiresAtUtc,consentVersion:"public-proof-v1"}`. Consent is exactly `{previewId,manifestHash,consentVersion,consent:true}` plus the normal retry key and returns `{operationId,receiptId,manifestHash}`. The result URL identifies the private result sequence and is checked against the frozen preview. No owner, totals, timestamps, provider or chain destination may be supplied.

Owner state is `{publication:null|{receiptId,manifestHash,manifest,operation,results:[{manifestHash,manifest,operation}]}}`. Operation projections contain `id,kind,status,manifestHash,transactionHash,blockNumber,checkedAtUtc,failureCode`; no signed bytes, signer key, leases or private result/account links. `GET /operations/{id}` checks identity plus owner/RLS. The owner bundle preserves all consented copies; chain references are null unless its complete transaction set is confirmed. Content can still be recomputed offline. Public receipt/bundle/chain APIs remain M10.

`409 PREVIEW_CHANGED` requires another exact review. `409 PUBLICATION_NOT_ALLOWED` explains cancellation/cutoff/preceding-state constraints. `429 PUBLICATION_RATE_LIMITED` preserves the private plan. All private responses are non-cacheable. Chain status is the worker's recorded observation with a visible last-check time; a submit acknowledgement is never confirmation.

## Household expansion — U34 API contract

New APIs use strict v2 contracts and the existing `{data,requestId}` / safe error envelopes. Private responses use `private,no-store`. Mutations require exact origin, authenticated identity, shared admission and bounded JSON. No client owner ID, source factor, carbon total, server clock or trusted profile content is accepted. Resolve profile versions on the server.

| Method/path | Contract |
|---|---|
| GET `/api/v2/activities/profiles` | Bounded reviewed reference records/categories and provenance; no personal data; authenticated |
| POST `/api/v2/activities/simulate` | Reviewed activity plus start; return energy, nullable CO₂, interval/source metadata and explicit data status; no commitment |
| POST `/api/v2/activities/interpret` | Consent, bounded text/reference context and stable AI task key; editable suggestions/questions; no authoritative energy or schedule |
| POST `/api/v2/schedules/compare` | Strict reviewed tasks/day input; server forecast and deterministic comparison or precise conflict outcome |
| POST `/api/v2/schedules` | Comparison identity/version plus stable idempotency key; atomic acceptance of exact stored comparison; return immutable schedule |
| GET `/api/v2/schedules` | Owner pagination, maximum twenty items, stable accepted-time/UUID cursor |
| GET `/api/v2/schedules/[id]` | Owner detail including immutable inputs and append-only task history |
| POST `/api/v2/schedules/[id]/explanation` | Consent/key, server-loaded facts; eligible codes rendered with deterministic numbers |
| POST `/api/v2/schedules/[id]/tasks/[taskId]/reports` | Ran/non-run plus current revision, profile confirmation/start where relevant, correction link; append only |
| POST `/api/v2/schedules/[id]/tasks/[taskId]/refresh` | Reuse frozen report; obtain actual factors; append only if result state/source changes |
| DELETE `/api/v2/schedules/[id]` | Same private/de-linked public retention and recent-auth rules as existing lifecycle |
| POST `/api/v2/schedules/[id]/publication-preview` | Exact sanitized plan/result revision preview and disclosure before consent |
| POST `/api/v2/schedules/[id]/publication` | Exact preview digest/version plus consent/idempotency; no implicit publication |

Schedule create/compare/accept bodies cap at 32 KiB/eight seconds; interpretation text caps at 2,000 UTF-16 units with up to twelve tasks. Small simulation/report requests keep 16 KiB. These are explicit endpoint bounds; do not globally relax v1 request validation. Imported public bundles have a separate bounded schema/byte policy in 10.

Use v1 mutation admission 30/minute/user as a shared ceiling across versions, comparison admission 10/minute/user, and a simulator ceiling 20/minute/user. AI remains within the same application/provider/user budgets across v1/v2. Public home summary is server-cached five minutes; do not expose an unlimited anonymous provider proxy.

Errors distinguish `NEEDS_INFORMATION`, `INVALID_ACTIVITY`, `WINDOW_TOO_SHORT`, `BASELINE_INFEASIBLE`, `CONSTRAINT_CONFLICT`, `INCOMPLETE_GRID_COVERAGE`, `COMPARISON_EXPIRED`, `RATE_LIMITED`, `IDEMPOTENCY_CONFLICT` and unavailable services. Feasible no-improvement and feasible best-found are successful comparisons with clear status. Search exhaustion without a feasible witness is `search_incomplete`, never proven conflict. Retry only on explicit transient states, with Retry-After honored; an uncertain save reuses its key.

Forecast requests round outward to half-hour boundaries and use the existing validated 48-hour national feed. Historical simulation uses actual factors and is labeled retrospective; mixed past/future simulation is rejected with an actionable choice rather than silently mix factor kinds. Source metadata retains original retrieval/issuance/license. Never substitute current intensity for missing future intervals or AI text for a failed API.

## M11 release maintenance endpoint — 25 October 2026

`GET /api/internal/maintenance` is an operator-only Vercel cron endpoint. It requires the exact `Bearer CRON_SECRET` value (at least 32 characters), returns no-store aggregate counts and runs the service-only `cs_retention` RPC. Missing configuration returns 503; missing/incorrect credentials return 401. It exposes no plan contents, provider keys or signer. A concurrent run returns a busy result rather than competing over the same cleanup. The public health endpoint remains liveness only. Schedule reads retain ownership/authentication checks and do not consume the mutation submission budget; duplicate/unknown paging parameters are rejected.
