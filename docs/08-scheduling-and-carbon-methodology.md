# CarbonShift — scheduling and carbon calculation methodology

Version 1.2 · 21 October 2026 · Method ID `carbonshift-gb-uniform-v1`; M02 implementation and M05 UI-clock clarifications preserve this accounting method.

**U34 target revision · 23 October 2026:** the approved household expansion at the end of this document supersedes conflicting washing-only restrictions for new v2 work. Earlier sections retain v1 contracts and historical implementation evidence. New capabilities are not passed until recorded in status.

## 1. What the number means

CarbonShift compares an assumed appliance energy profile with time-varying **national GB average grid carbon-intensity estimates**. It estimates the difference between two schedules under stated assumptions.

The provider's `actual` field is itself an estimate derived from metered generation. It does not measure a user's appliance, establish marginal grid response, or prove causally avoided emissions. The source covers electricity-generation-related CO₂; do not relabel outputs as complete lifecycle CO₂e. [Provider methodology overview](https://carbonintensity.org.uk/)

Product labels:

- Before a run: **Forecast comparison**.
- After a reported run with complete actual factors: **Updated estimate using reported timing**.
- Missing actual factors: **Updated estimate unavailable**.
- All runs in this MVP: **Execution self-reported; cycle energy assumed**.

## 2. Input boundary

Geography is `GB_NATIONAL`. Use the national series consistently for both baseline and alternative. Do not combine national actual data with regional forecast data as if they measured the same boundary.

Duration must be 30–180 minutes, divisible by 30. Energy must be an integer 50–5000 Wh, user-confirmed. These bounds are prototype validation choices, not assertions that every washer operates within them.

Demo default: 1000 Wh over 60 minutes, clearly labeled illustrative. For a real task, the person can supply an estimate from their appliance information, but it remains estimated. No manufacturer database or meter integration is included.

Store inputs and method version with each accepted plan. A new method requires a new version and compatibility tests, never silent recalculation of old commitments.

## 3. Time and feasibility

Use UTC instants for enumeration and Europe/London for user entry/display. The builder's India timezone must not affect the scheduling engine.

Live earliest possible candidate is the first half-hour boundary at or after `max(userEarliestStart, serverNow + 10 minutes)`. Deadline is an exact instant; a cycle may finish exactly at the deadline. All candidates must finish within 48 elapsed hours of comparison creation and inside provider coverage.

Blocked intervals are half-open UTC ranges. A cycle overlaps a block iff `cycleStart < blockedEnd && cycleEnd > blockedStart`. Touching a boundary is permitted. Do not silently ignore blocks or shorten the cycle.

Explicit baseline must be a feasible candidate. If it is invalid, ask the user to change it. If they choose the earliest-feasible default, display and confirm the resulting baseline before acceptance.

Local repeated hours need an explicit offset choice. Nonexistent local times are rejected with an explanation. Test 25 October 2026 in Europe/London: the local day has a repeated hour. Do not assume every local day contains 48 half-hours. Spring-forward is also required test coverage.

## 4. Grid validation and freshness

Normalize provider intervals to ordered UTC half-hours. Reject duplicate timestamps, gaps, overlap, wrong duration, nonfinite values, and negative factors. A null forecast is missing, not zero.

Require complete forecast coverage of the requested planning interval from the first candidate start to the deadline rounded up to the next interval boundary. A conservative error is preferable to selecting a minimum from a selectively missing series.

Reuse a retrieved snapshot for up to five minutes when it covers the request. Reject a new live comparison/acceptance if retrieval age exceeds 30 minutes; retain it for historical viewing. This is a local freshness policy. Record `providerIssuedAtUtc=null` if the API does not give it; retrieval time cannot establish provider model issuance time.

Comparisons expire after five minutes or ten minutes before the earlier baseline/selected start, whichever comes first. If no positive acceptance period remains, request a later window.

## 5. Energy profile and exact arithmetic

Let `N = durationMinutes / 30`. Divide total integer Wh into `N` bins:

```text
q = floor(energyWh / N)
r = energyWh mod N
bin[k] = q + 1 for the first r bins, otherwise q
```

The bin sum must exactly equal input Wh. This nearly uniform distribution is an explicit assumption. Real heating phases can make it inaccurate; do not describe it as measured.

For aligned planning bins:

```text
estimatedMg = sum(binWh[k] × factorGPerKwh[k])
estimatedGrams = estimatedMg / 1000
```

Why: Wh / 1000 gives kWh, multiplying by g/kWh gives grams, and multiplying by 1000 converts to mg.

For a reported start that is not on a half-hour boundary, translate the same relative energy bins to that start. Split each bin by its overlaps with grid intervals:

```text
numerator = sum(binWh[k] × factorGPerKwh[j] × overlapSeconds(k,j))
estimatedMg = round_half_up(numerator / 1800)
```

Accumulate with integer arithmetic and round once per total. Every relative bin is 1800 seconds. Example: a 500 Wh bin split equally between factors 100 and 200 produces 75,000 mg. Do not round each overlapping fragment separately.

Accepted report timestamps have minute precision; seconds must be zero. A selected minute is still self-reported, not accurate metering.

## 6. Selection, baseline, and ties

1. Validate confirmed constraints and full coverage.
2. Enumerate all feasible half-hour starts.
3. Calculate every candidate with the same energy profile and forecast snapshot.
4. Rank by exact `estimatedMg`, then earliest UTC start.
5. Compare selected minimum against the explicitly confirmed baseline.
6. Return up to three additional distinct feasible candidates for explanation/display.

```text
differenceMg = baselineMg - selectedMg
differencePercent = baselineMg > 0
  ? 100 × differenceMg / baselineMg
  : null
```

Baseline is itself a candidate, so the planning optimum cannot be worse than baseline. With equal estimates choose the earliest start but say there is no estimated improvement. No flexible window is still a valid result if one candidate exists.

Costs are not calculated in this version. A cleaner interval does not necessarily cost less.

## 7. Reproducible authored example

Assume a 1000 Wh, 60-minute cycle, split into two 500 Wh bins:

| Schedule | Half-hour factors (gCO₂/kWh) | Calculation | Total |
|---|---|---|---|
| Baseline | 300, 340 | `500×300 + 500×340` mg | 320 gCO₂ |
| Alternative | 100, 140 | `500×100 + 500×140` mg | 120 gCO₂ |

Difference: 200 g; percentage: 62.5%. These are test inputs, not a measured CarbonShift result.

A full fixture should include intermediate candidates, blocked periods, and the correct global minimum. A two-window illustration alone is not an optimizer test.

## 8. Completion calculation

The original forecast result remains unchanged. A run report supplies start time; duration and energy profile remain the accepted assumptions. UI must ask whether those assumptions still describe the run. If materially different, return `outside_supported_window`/unsupported basis with explanation rather than silently inventing a new profile.

For supported reports:

- Start cannot precede acceptance, and run end cannot be in the future.
- Start can violate the original schedule/blocks; record the deviation honestly.
- Automatic updated calculations support reported starts through `deadline + 24 elapsed hours`. Later reports remain recorded but are not evaluated by v1.
- Fetch actual factors spanning the original baseline and reported run.
- If any required actual factor is null/missing, totals and difference are null, status `actual_pending`.
- With complete coverage, compare both using actual factors and the same assumed energy profile.
- Negative differences are valid: show “higher updated estimate” and the signed amount.
- “Did not run” is not an award of the baseline's emissions as savings.

No minimum reduction threshold is invented. A tiny calculated change may be insignificant relative to model/load uncertainty; explain the assumed nature rather than fabricating a confidence interval.

## 9. Uncertainty and scientific limits

Sources of uncertainty: future generation forecasts, national versus local conditions, uniform load shape, energy quantity, and self-reported timing. We have not established probability distributions for these; do not output “95% confidence,” an invented error bar, or a fraud score.

Average carbon-intensity accounting is different from consequential/marginal-emissions analysis. The latter needs another method and suitable data. [WattTime's load-shifting approach](https://watttime.org/solutions/load-shifting/) is relevant prior art, not validation of CarbonShift's method.

No household-wide or annual impact extrapolation belongs in the MVP. Do not sum alternative schedules for the same cycle, multiple revisions, or demo fixtures into achieved impact.

## 10. Reproduction contract

A verification bundle includes the method ID/hash, confirmed constraints, normalized grid intervals, energy bins, baseline and selected windows, calculation outputs, evidence labels, and publication revision references. Recompute from inputs rather than trusting stored totals.

An unknown method version yields `unsupported_method`, not a guessed calculation. A changed input with unchanged committed digest yields a mismatch. A matching hash establishes integrity relative to the commitment, not truth of a self-report.

Tests and fixture targets are specified in [12](12-testing-and-ai-evaluation.md). M02 domain checks exercise this method; M03 grid integration and M04 private acceptance now consume it. Report persistence and public proof verification remain later work. Exact executed evidence is in the status log.

## 11. M02 implementation clarifications

The timing form's kWh value is converted from decimal text to integer Wh without floating-point rounding. V1 accepts at most three fractional decimal places within the existing 50–5000 Wh range; unsupported precision/units are rejected. `src/domain/method.ts` owns named constants; `src/domain/schemas/` owns strict wire/domain validation. These clarifications define interoperable representations rather than a new carbon-accounting method.

The domain accepts an injected `nowUtc`; it never reads the ambient clock. A deadline beyond `nowUtc + 48 elapsed hours` is rejected rather than silently clamped. Constraint timestamps and blocked periods are canonical UTC seconds; starts are enumerated every 1,800 seconds. Local form input uses date plus `HH:mm` and an optional `earlier`/`later` offset choice. A nonexistent time is rejected even when an offset choice is supplied. Both halves of a repeated hour remain distinct.

Forecast retrieval must not be in the future and may be exactly 30 minutes old. Acceptance is valid only while `nowUtc < expiresAtUtc`, with at least ten minutes until both relevant starts; expiry equality is expired. The exact chain cutoff is the earlier start; the app's operational cutoff is ten minutes earlier. Comparisons include creation/expiry and are deeply frozen on return. M03 storage digests and M04 private acceptance consume these rules; M08 public proof hashing/verifier consumes these same rules. The public plan retains the original comparison creation instant; acceptance time cannot substitute for that feasibility clock. Public results retain their calculation creation instant for actual-snapshot chronology.

For updated calculations, a report has a recorded creation timestamp: it cannot precede acceptance or follow the injected clock. A `ran` cycle must have ended by report creation (not merely by a later refresh). A normal `did_not_run` report is permitted after the selected cycle ends; early cancellation remains a separate transactional M07 operation. Deviation flags identify a different selected start, a start before the original earliest time, finish after deadline, and blocked-period overlap. A changed profile takes precedence over a late-window reason; either suppresses numeric estimates. A supported report without a snapshot yields `ACTUAL_SNAPSHOT_UNAVAILABLE`; incomplete required factors yield `MISSING_ACTUAL_FACTORS`. Missingness is never partial numeric success.

M05 UI clock clarification: form prevalidation and advisory expiry use a server-provided UTC reference plus monotonic browser elapsed time, rather than trusting the device wall clock. A new comparison resets that reference to its stored creation instant. Network delay can leave the display behind server time by a few seconds; the API/database always recheck actual server time before acceptance. This changes no calculation or acceptance rule.

## Household expansion — U34 method v2

These are implementation constants for `carbonshift-gb-activities-v2`; all earlier v1 rules and bytes remain unchanged. They describe a new method, not completed code.

**Energy.** Parse watts as a decimal with at most three decimal places into integer mW; parse kWh with at most six places into integer mWh. Reject negative/excess precision rather than silently truncate. For constant average power, `energyMwh = roundHalfUp(powerMw × durationSeconds × quantity / 3600)`. For declared cycle energy multiply per-cycle mWh by quantity once. Manual/rated-power assumptions are displayed; maximum connected load is not a measured average. A zero-direct-electricity activity is explicitly confirmed and estimate-only.

**Integration.** Each segment describes integer energy uniformly distributed over its declared seconds. Its contribution over a grid overlap is the exact rational `energyMwh × overlapSeconds × factorGPerKwh / (segmentDurationSeconds × 1000)` mg. Accumulate exact BigInt fractions across the task, reducing fractions as needed, then round half-up once to task mg. A boundary splits duration, not rounded energy; no discarded remainder or per-interval rounding enters the authoritative total. Displayed interval amounts are explanatory and labeled rounded; total comes from exact integration. Schedule totals sum the rounded task totals so the report exactly matches its rows. Percentage is presentation-only and null when baseline mg is zero. Differences remain signed, including negative results.

Bounds follow 06. Every segment is contiguous, nonnegative, exactly spans the activity and conserves energy. Unknown/gapped factors make the affected whole-task CO₂ unavailable; valid input-based electricity remains available. Use factor values only over their actual intervals. Past simulation uses actual factors, future simulation forecasts. A start in the current half-hour can use that half-hour forecast and must be labeled modeled, not measured. Full-window planning requires forecast coverage throughout the searched range, including blocked periods; never select a convenient subset of available data.

**Candidates and constraints.** All starts are whole-minute UTC instants after explicit London conversion. Search starts every 300 seconds on the UTC grid, plus each legal window start/latest-fitting end, the explicit baseline and fixed start. Deduplicate and sort. Include relevant block boundary start/end-minus-duration candidates, but do not claim continuous-time optimality. Intervals are half-open. A task must fit wholly in one allowed window, avoid all its blocks, follow every predecessor's finish and avoid overlapping shared resources. Fixed tasks have one candidate. User attention is a shared resource; different unattended devices may overlap. Safety-critical/always-on equipment is estimate-only unless the user supplies an appropriate explicitly safe operating model; no automatic load control exists.

Require a complete feasible explicit baseline; a suggested earliest baseline must be reviewed, never silently replace the user's stated time. Duration, quantity and energy stay constant across timing alternatives. Compare complete-duration integral, not the cleanest start interval. Keep up to three distinct alternatives after the selected assignment. Ties order by total integer mg then the lexicographic vector of UTC starts in normalized task-ID order. The baseline is always a candidate and feasible incumbent, so selected CO₂ cannot exceed it.

Independent tasks may be solved independently. Coupled tasks use deterministic branch-and-bound with at most 50,000 explored nodes and stable task/candidate ordering. A node is one attempted candidate extension, including one rejected on conflicts. Lower bounds must be admissible; do not prune equal-cost candidates if they could win a time tie. State `optimal_within_candidates` only when the search is exhausted; otherwise `best_found` with a feasible incumbent or `search_incomplete` without one. Enumerate alternatives from the explored feasible schedules; do not imply three globally next-best results after a truncated search. Twelve tasks is an input cap subject to measured performance, not a guarantee of exhaustive search. No-improvement means no improvement found within the stated search status.

A wider-window request may add covered time only when explicitly requested, preserve fixed/resource/dependency rules and return the required changed windows as a separate proposal. Preserve the original valid baseline times and energy profile. Fetch one covered fresh snapshot for both that baseline and the extended candidate set; disclose its new retrieval time. Compare within that proposal rather than subtract amounts across snapshots. Saving requires the user to apply edits and generate/review a fresh comparison; never accept altered constraints under the original digest.

**Time/acceptance.** London day bounds use calendar midnight to next calendar midnight (23/24/25 hours). No implicit cross-midnight extension. New comparisons expire after at most five minutes and no later than ten minutes before the earliest baseline/selected task start. Recheck expiry and forecast age at acceptance; source freshness retains the existing thirty-minute maximum. A historical/current simulation may run immediately; a saved commitment requires the review buffer. Actual reports preserve the existing comparable-profile rule and explicitly report deviations. For multi-task totals, covered/missing/non-run/changed-profile counts remain visible.

Known-answer acceptance: 900 W for 10 minutes = 150,000 mWh; at 200 g/kWh = 30,000 mg. 100 W for 60 minutes across equal half-hours at 100/300 = 100,000 mWh and 20,000 mg. A 1001 Wh cycle retains 1,001,000 mWh without bin-allocation loss. Each is an authored fixture, not a live household observation.
