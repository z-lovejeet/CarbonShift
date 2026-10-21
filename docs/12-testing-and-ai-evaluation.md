# CarbonShift — testing, AI evaluation, and acceptance

Version 1.2 · 21 October 2026 · Full product acceptance specification. M01 foundation and M02 domain checks have run; full T01–T12 product acceptance remains incomplete. See the status log for actual results.

## 1. Verification strategy

Prioritize the decisions that can be wrong: timing constraints, baseline selection, unit conversion, missing data, account ownership, immutable acceptance, and receipt integrity. Snapshotting component markup is insufficient.

Use pure unit/property tests for arithmetic and scheduling, isolated DB/API tests for authorization and transitions, local-chain tests for contract rules, and a small Playwright suite for full journeys. Paid model evaluation and testnet smoke tests are explicit separate runs.

No unit test may depend on the current date, changing grid data, a paid provider, or a funded wallet. Inject clocks and use labeled fixtures.

## 2. Feature-to-test traceability

| Test ID | Features | Required acceptance evidence |
|---|---|---|
| T01 | F01 | Public demo works without account/network AI; every example state says demo; reset restores fixture |
| T02 | F02 | Signup/login/recovery/sign-out work; A cannot read/write/delete B's plans through API or DB |
| T03 | F03 | Invalid energy/duration/dates/blocks rejected; ambiguous local time requires disambiguation |
| T04 | F04 | Structured suggestions editable; no acceptance before confirmation; outage/manual path succeeds |
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
