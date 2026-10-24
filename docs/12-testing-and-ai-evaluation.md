# CarbonShift — testing, AI evaluation, and acceptance

Version 1.8 · 23 October 2026 · M00–M09 local/testnet evidence is scoped in the status log. Timing AI remains experimental/manual-first and is currently timing out; public M10/M11 acceptance remains pending.

**U34 target revision · 23 October 2026:** the approved household expansion at the end of this document supersedes conflicting washing-only restrictions for new v2 work. Earlier sections retain v1 contracts and historical implementation evidence. New capabilities are not passed until recorded in status.

## 1. Verification strategy

Prioritize the decisions that can be wrong: timing constraints, baseline selection, unit conversion, missing data, account ownership, immutable acceptance, and receipt integrity. Snapshotting component markup is insufficient.

Use pure unit/property tests for arithmetic and scheduling, isolated DB/API tests for authorization and transitions, local-chain tests for contract rules, and a small Playwright suite for full journeys. Paid model evaluation and testnet smoke tests are explicit separate runs.

No unit test may depend on the current date, changing grid data, a paid provider, or a funded wallet. Inject clocks and use labeled fixtures.

## 2. Feature-to-test traceability

| Test ID | Features | Required acceptance evidence |
|---|---|---|
| T01 | F01 | Public demo works without account/network AI; every example state says demo; reset restores fixture |
| T02 | F02 | OAuth start/callback/session/sign-out and server throttling/recovery work; cancellation, invalid code and unsafe redirects fail safely; A cannot access B's plans |
| T03 | F03 | Invalid energy/duration/dates/blocks rejected; ambiguous local time requires disambiguation |
| T04 | F04 | Both bounded roles evaluated; quota-aware selection and duplicate protection; suggestions editable; no acceptance before confirmation; outage/manual/template path succeeds |
| T05 | F05 | Valid grid schema ingested; nulls/gaps/duplicates/staleness do not become recommendations |
| T06 | F06 | Minimum feasible candidate matches brute-force reference; known arithmetic and tie rules pass |
| T07 | F07 | Acceptance freezes exact reviewed inputs; expired/replayed/conflicting requests handled correctly |
| T08 | F08 | Exact consented hash queued; unauthorized/duplicate/late commitment rejected; pending differs from confirmed |
| T09 | F09 | Report/non-run/correction/refresh states preserve history and signed negative differences |
| T10 | F10 | Public export excludes private fields; result consent required; chain history matches revisions |
| T11 | F11 | Local verifier reproduces valid bundle; detects tampering; distinguishes unavailable/unsupported/mismatch |
| T12 | F12 | History/deletion, accessible core flow, methodology/privacy content, production build all checked |

All F01–F12 require acceptance coverage. Individual tests should be decomposed into descriptive cases during implementation.

## 3. Calculation fixtures

Create fixtures with explicit expected outputs:

| Fixture | Expected result |
|---|---|
| 1000 Wh/60 min, baseline factors 300/340, chosen 100/140 | 320,000 mg vs 120,000 mg; difference 200,000 mg; 62.5% |
| 1001 Wh/90 min | Bins `[334,334,333]`, exact sum 1001 |
| 500 Wh bin, half at factor 100 and half at 200 | 75,000 mg using overlap arithmetic |
| All feasible factors zero | Difference 0; percentage null; no division error |
| Two equal-minimum starts | Earliest UTC start wins |
| Baseline only feasible candidate | Valid zero-improvement result |
| Selected actual factors 320/360; baseline actual 180/200; 1000 Wh | Updated baseline 190 g, reported 340 g, difference −150 g |
| One actual factor missing | All updated totals/difference null, `actual_pending` |
| Declared `did_not_run` | No avoided-emissions award; null updated totals |
| Run violates original blocked period | Preserve report and mark deviation; do not rewrite constraints |
| Run reports changed duration/energy assumptions | Preserve report; `PROFILE_CHANGED`, no updated numeric estimate |

Also cover exact deadline finish, 1-minute-over-deadline rejection, overlap boundary touching, day rollover, missing first/last interval, and factor/energy overflow guards.

Property tests: conservation of energy bins; nonnegative totals for valid inputs; selected minimum no worse than feasible baseline; deterministic results under normalized data; unchanged result after JSON key-order permutation; every accepted candidate satisfies constraints.

## 4. Timezone tests

Required Europe/London cases:

- Ordinary winter and summer dates.
- Fall-back on 25 October 2026: repeated 01:30 with explicit offsets produces distinct instants.
- Spring-forward: nonexistent 01:30 is rejected rather than silently shifted.
- A 48-hour horizon is elapsed time, not “two local calendar dates.”
- Browser running in Asia/Kolkata still displays/accepts scheduling times in Europe/London.
- At acceptance, a previously valid comparison can expire because server time advanced.
- Historical demo clock can never enter live request handlers.

## 5. AI evaluation dataset

Create **20 development examples** and **40 held-out examples**. Keep template families separated across splits. Examples may be authored but must be labeled; these are not field-user data.

Held-out allocation:

| Category | Count |
|---|---:|
| Straightforward dates/deadlines/blocks | 12 |
| Midnight and relative date language | 8 |
| Ambiguity, missing fields, contradictions | 8 |
| DST and timezone ambiguity | 6 |
| Injection and unsupported requests | 6 |

Each fixture includes reference date, raw text, expected fields, required ambiguity/unsupported codes, and critical constraints. A human checks the gold labels before evaluation.

Run each configured interpreter path and fallback independently, recording model/prompt/schema IDs. Rerun unstable/failing cases and report repeat count. Do not tune on the holdout and continue describing it as untouched.

Every candidate promoted into a role's live order requires its own access/schema and role-quality evidence. Catalog-only, unavailable or unqualified entries remain disabled; do not call an untested lower-priority model just because its quota is larger. Gemini 3.7 is not a configured candidate. Evaluate 3.8 Flash, available 3.6 Flash, Lite and Groq interpreter paths under the same reviewed fixtures where they are being promoted. Record model-specific failures instead of averaging them into a single provider score.

Live smoke/evaluation is explicit opt-in network work on verified free tiers under the same project/organization reservations, request limits and application budget. An unpromoted candidate can be tested deliberately by the evaluation runner, but never through a public/user route. Begin at concurrency one; increase only with measured token/headroom evidence. A 60-example sweep at 17 calls/day needs at least **four quota days**, before extra smoke/repeat calls; the 40-example holdout alone needs at least three. Stage the work across resets; do not rotate keys, raise ceilings silently, tune on holdout or claim G06 passed early. The 200-call application ceiling still applies across models/roles. A paid evaluation needs separate explicit spending approval.

Metrics:

- Exact populated-field accuracy, including correct nulls.
- Whole-example critical-constraint accuracy.
- Ambiguity recall and false-ambiguity rate.
- Schema/semantic rejection and fallback frequency.
- Manual corrections needed to reach correct fields.
- Median and p95 response latency.
- Actual input/output tokens and billed-cost estimate with dated pricing.

Proposed release targets: ≥95% field accuracy, ≥90% whole-example critical accuracy, and zero **silently accepted** known critical errors across the suite after local validation/review gating. These are targets, not a statistical guarantee or achieved score. If unmet, make manual input the default, keep AI visibly experimental, and report actual metrics.

For explanation selection, test every eligible/ineligible code combination. Required limitations must always appear after deterministic validation. Compare with the template-only baseline; retain the fallback even when the model performs well.

### M06 isolated router/admission acceptance

- Fill the 3.8 daily bucket to 16; concurrent requests can admit only the one remaining local slot, then select a qualified lower candidate without sending an 18th request. Fill Lite to its configured cap and verify recovery to Groq/manual. Unknown 3.6 limits/qualification keep it disabled.
- Test shared project/model buckets across two roles, users, keys and server instances; only genuinely distinct configured buckets add capacity. Check rolling minute/token reservations, long/unknown outputs, 429 headers, daily exhaustion and UTC/Pacific reset boundaries including DST. Reserve conservative unknown usage on timeout/crash.
- Test global 200/day and user 5/minute/20/day jointly. Cached code selections and rejected duplicate task keys make no model call. In-flight/finished/conflicting keys cannot trigger duplicate extraction; never replay fabricated lost suggestions or leak fingerprints.
- Count all dispatch attempts, including SDK behavior: at most two within the original absolute deadline. No parallel model race, retry storm, fallback on ambiguity/refusal, unqualified model or silent paid-profile promotion. A Gemini outage prefers an eligible independent provider.
- Verify one task/user and two provider requests/application across instances, lease expiry/recovery, daily charges surviving lease expiry, three-failure circuit opening and one half-open probe. Quota-store outage makes no provider call and leaves manual planning usable.
- Exercise login start/callback browser/IP thresholds independently, trusted/untrusted forwarded metadata, shared networks, generic 429 recovery, expired callback restart, retained session and sign-out. Test repeated comparison/save submissions, stable uncertain-save keys, unchanged permanent uniqueness and no raw callback codes in logs.
- Browser tests cover editable source-backed suggestions/clarifications, actual pending/limited/unavailable states, manual fallback, truthful retry time and nonblocking comparison explanations. Run the existing M00–M05 regression after runtime integration; documentation checks alone prove none of these controls.

## 6. Contract and worker tests

Contract: authorized commit/append; unauthorized sender; zero fields; duplicate receipt; cutoff before/equal/after block time; demo cutoff requirement; nonexistent receipt; skipped revision; wrong previous hash; repeated hash; ownership transfer; legitimate unrelated second cycle.

Worker:

- Crash before sign, after durable sign, after broadcast, and after mining but before DB acknowledgment.
- Reclaim expired lease without double issuance.
- Re-send same raw transaction on transport retry.
- Wrong chain or missing contract refuses writes.
- RPC returns unknown receipt; state stays submitted/uncertain.
- Block hash changes; previously confirmed operation becomes uncertain.
- Result revision cannot publish ahead of confirmed predecessor.
- Cancellation before signing stops the queued commitment; cancellation after signing does not pretend the transaction has been recalled.

Capture real testnet transaction references separately after local tests pass. A local-chain pass is not a deployed integration pass.

## 7. End-to-end journeys

1. New member completes manual plan, accepts, reports, and sees truthful result.
2. Same journey with AI suggestions corrected before confirmation.
3. AI unavailable; manual path remains usable.
4. Missing grid coverage; form retained, no fabricated recommendation.
5. Public preview/consent → queued → confirmed receipt → local bundle verification.
6. Tampered bundle fails integrity/calculation checks.
7. Correction preserves original public revision and requires new consent.
8. Cross-user access attempts fail; deletion removes eligible private data.

Use isolated seeded users and a frozen clock. Live tests use their own small input set and never mutate production-like personal data.

## 8. UI and performance checks

Check at 360 px, 768 px, and 1440 px widths, keyboard navigation, 200% zoom, reduced motion, form errors, accessible chart table, and one screen-reader smoke test. Automated accessibility checks complement manual checks.

Proposed performance budgets: pure scheduler <100 ms for the bounded horizon on the development machine; cached manual comparison p95 <2 seconds; uncached grid path bounded by its 20-second deadline; AI bounded by document 09. Measure and record hardware/network/sample size. These budgets are not current performance claims.

## 9. Release evidence format

For each milestone record:

```text
Commit/version:
Environment:
Command or manual procedure:
Expected:
Observed:
Pass/fail:
Known limitations:
Relevant fixture/transaction/reference:
```

Do not put private keys or raw personal inputs in evidence. Automated unit/integration/end-to-end checks run without model costs in normal CI; paid eval and testnet checks are separately authorized and budgeted.

No “done” status until relevant checks actually run and their output is inspected. Documentation consistency checks do not substitute for product testing.

## 10. M02 scoped verification and fixtures

The suites named `src/test/unit/domain-*.test.ts` cover T03/T06 domain rules and the T09 updated-calculator subset. Property checks use seeds `20261021`, `31`, `1206`, and `20606` for 1,000 energy conservation, 500 aligned arithmetic, 500 independent per-minute overlap and 300 brute-force optimizer cases. The versioned fixtures are `src/fixtures/demo/gb-uniform-v1.json` and `accounting-v1.json`; all inputs are authored synthetic examples, explicitly labeled. The fixture snapshot hash is a test reference, not a cryptographic verification result.

`src/test/e2e/domain.spec.ts` builds a test-only browser bundle in memory. Chromium in Asia/Kolkata checks London DST disambiguation/nonexistent times and exact browser/server comparison equality, across the existing three viewport projects. This exercises actual shared code without introducing a product page or treating a demonstration as live data. Manual input UX, real feed, authentication, result persistence and proofs remain their owning phases.

`pnpm exec tsx scripts/benchmark-domain.ts` records hardware/runtime, 20 warmups and 200 samples each for 30-/180-minute profiles across the full allowed horizon. Local timings include input/output validation and do not establish web latency or climate benefit. No machine-specific timing threshold is placed in CI. Observed results belong in the status log.

## 11. M03 grid verification

`grid-provider`, `grid-client`, `grid-cache`, `grid-transport` and `grid-replay` unit suites cover T05's server adapter boundary, using fake fetch/clock and the labeled recorded fixture. Check allowlisted endpoints, timestamp normalization, unexpected request fields, malformed intervals/values, complete forecast coverage, partial actual data, cache age/identity, concurrent coalescing/eviction, no stale fallback, timeouts including stalled/late bodies, retry classification, byte caps and sanitized errors. Captured forecasts replay through the real adapter and unchanged scheduler; snapshot digests and the exact fixture bytes are pinned. These tests never use changing live data.

`pnpm check:grid` is the separate explicit live read: a six-hour forecast comparison with illustrative energy plus a completed historical actual range. It uses the real server clock/transport, no account or paid model. `--capture` writes `src/fixtures/grid/neso-national-recorded-v1.json` only if absent; it is frozen historical evidence. Recording a new version requires a distinct fixture/version and review of expected outputs. The script does not save a user plan or claim measured avoided emissions.

M03 regression includes the existing M01 shell/domain browser suite and fresh-copy install/static/unit/local-contract/build checks. The M00 research verifier intentionally rejects a scaffolded app; check preserved research hashes and documentation consistency instead. No hosted CI, Supabase, AI or testnet pass is inferred from these local checks.

## 12. M04 account, authorization and transaction verification

`auth-routes`, `session`, `request-body`, `plan-api` and `plan-repository` unit suites exercise Google/GitHub start/callback/error/sign-out, fixed redirect policy, validated `getUser()` identity, strict input/output shapes, origin/size/time bounds, sanitized outages, quota/conflict mapping, owner checks before elevation and saved snapshot integrity. These inject services/transports and make no live requests.

`pnpm test:integration` provisions a disposable native PostgreSQL cluster, bootstraps isolated Supabase-like Auth roles/schema, applies every migration and executes the real SQL. It covers two-user RLS, direct SELECT/INSERT/UPDATE/DELETE/function denials, composite ownership constraints, immutable records/payloads, snapshot digests, stale/expired acceptance, same/different-key retries, concurrent acceptance/quota and transactional rollback. It never reads application DB credentials or resets a configured database. Native server tools are required; `CARBONSHIFT_PG_BINDIR` selects their directory. CI can supply only a dedicated fresh loopback `carbonshift_test` service via `CARBONSHIFT_CI_DATABASE_URL` with `CI=true`; the runner refuses a nonempty fixture. CI's PostgreSQL 17 service image is pinned by digest. Local verification of this branch is distinct from an observed hosted GitHub run.

`accounts.spec.ts` exercises P02 availability/error copy, provider labels, no password form, keyboard return navigation, owner-route protection and axe/overflow assertions across three viewport projects. Its production server clears Supabase environment fields, so the test suite does not contact hosted Auth or reuse real browser sessions. The separate configured anonymous probe checks enabled provider buttons, keyboard order, axe and 200% zoom in a fresh context. With native submission prevented only for inspection, it also checks provider progress, duplicate-submit locking and back/forward-cache restoration; actual OAuth remains the separate builder check. Screenshots are ignored local artifacts, visually inspected for desktop/mobile layout.

`pnpm check:accounts` is an explicit live dev integration check, requiring the configured hosted development project and the local server. It provisions two temporary Auth users/sessions in memory via administrative test helpers, performs real grid → comparison → immutable plan → owner read/list/page/retry checks, attempts foreign API/RLS/function access, and deletes only the fixture users. It sends no email, changes no provider settings and does not count as a real Google/GitHub sign-in. The builder independently checked both providers, signed-in confirmation and sign-out. Public production callbacks remain M11 checks.

M04's regression command set includes lint, both typechecks, unit/component tests, isolated DB tests, local contract tooling, production build, browser suite and clean-copy reproduction. Actual counts, failures diagnosed during development and live references are in the status log. Completion/report/publication/deletion UX and full T01–T12 acceptance remain later phases; no paid model or testnet pass is inferred.

## 13. M05 scoped manual journey verification

`task-input` covers exact decimal Wh conversion, London repeated/gap times, feasible baselines, blocked ranges and horizon validation without mutating drafts. `planner-flow` covers explicit review, field preservation, expiry, stable same-key uncertain-save retries (including after expiry), rejection of a mismatched save response, and a server-referenced UI clock under a wrong device wall clock. `forecast-view` checks exact domain amounts, accessible factors and zero-baseline percentage suppression. `planning-api-client` rejects malformed responses, sanitizes unknown errors and sends only acceptance references; `plan-list` tests truthful emptiness and failed-pagination recovery. Owner comparison-read/API/repository cases extend the existing M04 suites.

`planning.spec.ts` runs the shared manual flow via the explicitly labeled public demo at desktop/tablet/mobile widths. It checks review-before-compare/save, accurate authored factors/totals, accessible chart table, alternatives, precision/impossible-window errors, reset, a zero-improvement baseline, keyboard-only completion, 200% zoom and no network mutations. These are offline fixture UI checks; they do not claim a hosted save.

`pnpm check:planner` is an explicit separate live command. It uses the selected development project/local server, creates two temporary legitimate seeded Auth sessions, drives ordinary P03/P04/P05 pages on desktop/mobile in an Asia/Kolkata browser, enters decimal energy and a blocked first interval, compares the real national grid snapshot, checks exact frozen payload equality after acceptance/reload, tests owner dashboard linkage and foreign page/comparison/plan 404, and checks comparison axe/overflow. It cleans up only its created fixture users. It changes no provider settings, sends no email and calls no AI/ledger. Screenshots omit account credentials. Builder usability review was offered and explicitly deferred; screen-reader/other-browser/public-deployment evidence remains separate.

## 14. M06 scoped AI journey verification

`pnpm check:ai-flow` is the explicit live development browser/API check after role evaluation. A fresh fixture member consents to authored non-personal timing input, reviews/applies the suggestion, retains the exact energy assumption, explicitly confirms constraints and compares real national grid data. It checks finished/changed AI request keys, grounded explanation codes, an owner cache hit without another AI dispatch, and immutable save/reload. It checks axe/overflow and cleans its own temporary member. The maximum is four provider attempts across two normal tasks, under the same shared limits; no automatic retry or model qualification is performed. Actual success is recorded separately from isolated browser harness checks.

## 15. M07 private lifecycle verification

Unit/component checks exercise strict commands, profile confirmation, future/unfinished runs, non-execution, current-report corrections, provider outage/null estimates, signed negative differences, stable retries and recent reauthentication/account deletion. Zero-byte DELETE streams are accepted; nonempty data is rejected. SQL checks cover atomicity/rollback, concurrent sequence allocation, actual snapshot persistence/RLS, unchanged refresh reuse, changed actual factors, terminal cancellation, deletion/orphan cleanup and owner-consistent reads.

`pnpm check:lifecycle` drives the ordinary development planner/save/P06/P07/cancellation/deletion journey with real Auth/database/forecast and temporary members. It checks future-report rejection, preserved forecast, duplicate cancellation, foreign 404, deletion without confirmation 403, provider start redirects, desktop/mobile layout, axe and cleanup. Callback success/owner-switch rejection are isolated tests; temporary deletion uses a signed fixture receipt. A separate authored historical plan stays in memory and consumes real actual-grid data; it is never saved as a live comparison. No appliance operation, measured execution, human reauthentication pass or deployed product is inferred. See phase-7 evidence and status for actual outcomes.

## M08 local T08/T10/T11 subset

`proof-builders.test.ts` checks allowlist export, private-data omission, false profile/terminal cancellation, immutable snapshot/parent pairing, strict input and retry-stable nonce. `proof.test.ts` checks fixed golden digests against independent Node SHA-256, UTF-16 JCS order, key permutation, mutation, bounded duplicate-key/Unicode/integer import, known method, complete optimization/arithmetic and separate chain-unavailable states. It includes signed negative actual estimates, missing factors, inferior feasible start, altered source factors, future snapshots, changed profile, revision/correction/cancellation and wrong network/address/mode/cutoff/events/latest pointer.

`contracts/test/shift-receipt.test.ts` exercises authorization, zero owner/hash, nonpayability, uniqueness, exact cutoff, demo zero cutoff, sequential hash-linked append, two-step transfer and unrelated same-window cycles. `proof-roundtrip.test.ts` deploys only to an isolated in-process EVM, commits a live or demo fixture, appends through an ownership transfer, reads actual state/events/block times through the generated ABI, exports/imports and independently verifies the complete bundle. Renouncing ownership leaves existing content verifiable. `src/test/e2e/proof.spec.ts` checks server/real Chromium hash/export/verifier parity across the three configured viewport projects and an India browser timezone.

`contracts:test` also checks ABI/source/bytecode build fingerprints; `verify:clean` proves reproduction without ignored credentials/artifacts. These tests do not close T08 consent/worker/testnet delivery, T10 public route/consent or T11 full verification-page UX; those belong to M09/M10. Existing SQL/live-account evidence is retained from G07 because M08 changes no database/auth path. Exact fresh counts, failures resolved and final G08 outcome live in status section 22.

## M09 verification scope

`publication.test.ts` executes actual SQL for stable identity/preview bytes, concurrent same/different-key consent, altered/expired/version/path rejection, daily quota, owner RLS/direct-call denial, immutable public records, result consent and account-link detachment, fenced lease expiry and unsigned/signed cancellation/deletion. `publication-api` checks origin/auth/strict consent/path binding and sanitized failure; `publication-panel` checks the unchecked review, stable retry after lost acknowledgement, honest uncertainty and unpublished private changes.

`ledger-worker` exercises crash before durable sign, after persist/broadcast/mining, exact-byte resend, lease loss, wrong-chain handling and reorganization/RPC uncertainty. `contracts/test/ledger-adapter.test.ts` uses the actual viem adapter to sign/broadcast/read a real isolated-EVM commitment and result, waits two further blocks and checks wrong calldata/changed block detection. Neither suite uses the dedicated wallet or public RPC.

`check:publication` separately drives ordinary real development pages/API with temporary accounts, real national forecast, authored cycle energy, explicit preview/consent, offline-worker queuing, actual Sepolia plan/cancellation-result confirmation, retry/owner isolation and independently imported exported bundle against actual chain events. No appliance is operated and cancellation yields no numeric benefit. It checks desktop/mobile overflow, axe and browser errors, stops its worker and removes only temporary accounts, retaining disclosed evidence. Actual results are recorded in phase-9/status; no pass is inferred from the script existing. M10 public pages and M11 external release acceptance remain pending.

## Household expansion — U34 focused acceptance

Keep T01–T12 for v1. Add T13–T20 matching feature IDs in 02; historical pass totals do not pass these new tests.

| ID | Practical evidence |
|---|---|
| T13 | TV/short vacuum/cycle/custom/no-direct-electricity inputs; real grid result; unknown source/wattage clarification; fractional integration and missing-data handling |
| T14 | Single/two-task scheduling, fixed time/resource/dependency constraints, tiny-case exhaustive oracle, bounded search status, atomic owner-safe save/reload |
| T15 | Separate mixed-day journey; London 23/25-hour bounds, per-task availability, fixed TV and wash-before-dry order |
| T16 | Window too short, infeasible baseline, conflict, no improvement, stale/missing factors, incomplete search and explicitly reviewed relaxation |
| T17 | Per-task report/non-run/correction, missing actuals, changed profile, latest-result-only partial aggregate and account/private deletion |
| T18 | Expanded-role schema/semantic fixtures, new variant qualification, shared quota/fallback, manual path and grounded explanation |
| T19 | Unchanged v1 proof, v2 portable reproducibility/tamper checks, exact consent/cutoff/privacy, local chain and one real Sepolia journey |
| T20 | Real home source/status; three useful workspaces, mixed history, detailed reports, keyboard/mobile/no stale response, production build |

Domain checks include the explicit 900W/10min and 100W/60min examples in 08, quantity conservation, zero factor vs null, task segment overlap, tie ordering, input precision/bounds, and a frozen v1 fixture. A small exhaustive oracle independently checks coupled search; do not mirror the implementation as its own expected answer. One bounded twelve-task case records elapsed time and search status without claiming unlimited scheduling capacity.

Expanded AI evaluation is a focused authored set: 12 development cases and 12 held-out cases from separate sentence families, spanning explicit energy/unit extraction, multiple tasks/dependencies, fixed-vs-flexible time, ambiguous car cleaning, missing device power, conflicting windows, London DST and adversarial instructions. Freeze expected fields and review before live runs. Each newly enabled interpreter candidate needs its own evidence on these cases; explanation candidates need a small complete set of eligible-code scenarios. This replaces repeating the old 60-example washing dataset for v2; the old result remains historical evidence only. Count and disclose every actual run/retry and safety rejection. Keep manual-first experimental labeling if original quality targets are missed; no silent numerical/constraint fabrication may survive validation/review. Unknown/unavailable candidates stay excluded. Do not run all catalog models.

Run targeted tests while editing; one combined unit/SQL/contract/browser/static/build pass at the integrated boundary, then repeat only affected checks after fixes. Use isolated fixtures in normal tests and separate bounded live source/provider/testnet checks. A route is not complete because it renders placeholder content or fixture success. Record which actual device measurements are absent; all authored energy examples remain estimates.


### U37 builder-led UI acceptance

On 24 October 2026 the builder accepted the U36 landing appearance, requested consistent quality/detail across the application, and explicitly said they will perform testing themselves. For this presentation update, Codex runs only lint/import-boundary, TypeScript and build checks to catch code/compilation errors. It does not run unit/component, browser/accessibility/end-to-end, live API/model, SQL or blockchain journeys. These are not new passing feature/visual acceptance claims; the builder’s review is pending. Historical U34/U36 evidence retains its original scope/date. Further test execution requires subsequent user direction or a concrete authorized scope change.

## M11 reproduction and deployment evidence

`pnpm verify:clean --browser` runs the frozen dependency install, environment check, lint/import boundaries, isolated contracts, both typechecks, unit/component tests, production build and production-browser suite in a fresh temporary copy. Real environment files, Vercel tokens, dependencies and generated artifacts are excluded. The temporary copy is removed afterward; preserve the command output for the release record. Chromium must already be installed with `pnpm exec playwright install chromium`. Isolated PostgreSQL tests remain `pnpm test:integration`; no hosted reset or paid inference is part of ordinary verification.

A clean-copy/browser pass is local software evidence. It does not replace real deployment URLs, production proxy behavior, current Google/GitHub sign-in, public AI eligibility, a running ledger worker or a fresh external user journey. Existing AI/chain evidence should not be repeated solely to increase test counts.
