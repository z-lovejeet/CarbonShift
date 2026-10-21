# CarbonShift — scheduling and carbon calculation methodology

Version 1.1 · 21 October 2026 · Method ID `carbonshift-gb-uniform-v1`; M02 implementation clarifications preserve this accounting method.

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

Tests and fixture targets are specified in [12](12-testing-and-ai-evaluation.md). M02's domain checks exercise the implemented method; live grid integration, report persistence and public proof verification remain later work. Exact executed evidence is in the status log.

## 11. M02 implementation clarifications

The timing form's kWh value is converted from decimal text to integer Wh without floating-point rounding. V1 accepts at most three fractional decimal places within the existing 50–5000 Wh range; unsupported precision/units are rejected. `src/domain/method.ts` owns named constants; `src/domain/schemas/` owns strict wire/domain validation. These clarifications define interoperable representations rather than a new carbon-accounting method.

The domain accepts an injected `nowUtc`; it never reads the ambient clock. A deadline beyond `nowUtc + 48 elapsed hours` is rejected rather than silently clamped. Constraint timestamps and blocked periods are canonical UTC seconds; starts are enumerated every 1,800 seconds. Local form input uses date plus `HH:mm` and an optional `earlier`/`later` offset choice. A nonexistent time is rejected even when an offset choice is supplied. Both halves of a repeated hour remain distinct.

Forecast retrieval must not be in the future and may be exactly 30 minutes old. Acceptance is valid only while `nowUtc < expiresAtUtc`, with at least ten minutes until both relevant starts; expiry equality is expired. The exact chain cutoff is the earlier start; the app's operational cutoff is ten minutes earlier. Comparisons include creation/expiry and are deeply frozen on return. Hashing and acceptance persistence are later phases.

For updated calculations, a report has a recorded creation timestamp: it cannot precede acceptance or follow the injected clock. A `ran` cycle must have ended by report creation (not merely by a later refresh). A normal `did_not_run` report is permitted after the selected cycle ends; early cancellation remains a separate transactional M07 operation. Deviation flags identify a different selected start, a start before the original earliest time, finish after deadline, and blocked-period overlap. A changed profile takes precedence over a late-window reason; either suppresses numeric estimates. A supported report without a snapshot yields `ACTUAL_SNAPSHOT_UNAVAILABLE`; incomplete required factors yield `MISSING_ACTUAL_FACTORS`. Missingness is never partial numeric success.
