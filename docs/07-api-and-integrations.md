# CarbonShift — API and external integration contracts

Version 1.1 · 21 October 2026 · Wire contracts, with the M03 internal grid integration implemented. Base path `/api/v1`; private product endpoints remain later work.

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
| `POST /ai/constraints` | `{text, localReferenceDate, timezone:"Europe/London"}` | `ConstraintSuggestionV1`; authenticated, explicit AI consent, rate-limited |
| `POST /comparisons` | Reviewed constraint fields; baseline may request `earliest_feasible` before normalization | Saved `ComparisonV1`, confirmed baseline; incomplete coverage is 422/503 as appropriate |
| `POST /comparisons/{id}/explanation` | No additional user text | Validated explanation keys and template text; owner only; cached by comparison/task version |
| `POST /plans` | `{comparisonId, comparisonVersion}` + idempotency key | Immutable accepted plan; reject expired/time-invalid comparisons |
| `GET /plans` | Cursor and page size ≤20 | Owner's summaries; no global emissions totals |
| `GET /plans/{id}` | None | Owner plan, latest report/result, public status, revision list |
| `POST /plans/{id}/cancel` | `{reason}` + key | Atomic cancellation before selected start, subject to state rules |
| `POST /plans/{id}/reports` | `{kind, reportedStartUtc, profileStillApplicable, correctsReportId, reason}` + key; nullable field types defined below | New report + result revision; validates current report/state and required profile confirmation |
| `POST /plans/{id}/results/refresh` | `{expectedResultRevision}` + key | New result only if new data/status; otherwise return existing revision |
| `POST /plans/{id}/publication-preview` | None | Public manifest, digest, privacy disclosure, short-lived preview ID |
| `POST /plans/{id}/publication` | `{previewId, manifestHash, consentVersion, consent:true}` + key | Queued operation; recompute exact preview hash; never auto-consent |
| `POST /plans/{id}/results/{revision}/publication-preview` | None | Result manifest with next public sequence and disclosure |
| `POST /plans/{id}/results/{revision}/publication` | Same consent shape + key | Appends consented public result; preceding operation must be confirmed |
| `GET /operations/{id}` | None | Owner-visible chain status/reference; excludes raw signed bytes |
| `GET /receipts/{receiptId}` | None | Public summary and approved revisions, or 404 |
| `GET /receipts/{receiptId}/bundle` | Optional public revision | Published bundle only; no PII/raw prompt |
| `GET /receipts/{receiptId}/chain` | None | Allowlisted RPC read of expected contract state/events; public, rate-limited |
| `DELETE /plans/{id}` | Reauthentication + key | Deletes eligible unpublished private plan; published plan returns documented restriction |
| `POST /account/delete` | Recent reauthentication + explicit acknowledgement + key | Removes eligible private records/account; handles public disclosure retention separately |
| `GET /health` | None | Minimal application health; no provider keys, balances, account details |

Auth signup/login/password recovery use supported Supabase Auth flows rather than custom password storage. The callback destination is an allowlisted internal path.

Publication preview expires after five minutes and before the live precommit cutoff, whichever is earlier. Publication rechecks freshness/time/state. Any difference produces `409 PREVIEW_CHANGED` and another preview; consent is never transferred to changed data.

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

Server converts the baseline union to `ConfirmedConstraintsV1.baselineStartUtc/baselineOrigin`, records confirmation time, validates coverage, calculates, and persists. It returns one authoritative snapshot and numbers; the client never sends carbon totals.

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
