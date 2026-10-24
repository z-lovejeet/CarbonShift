# CarbonShift — household electricity expansion

23 October 2026 · Written design approved under U34 · implementation plan approved for sequential execution; capability completion is recorded in the status log.

## 1. Intended outcome

Help someone understand the electricity and grid-associated CO₂ of everyday electrical activities, compare feasible times, and organize several activities into a workable day. Keep the Renewable Energy & Energy Trading track: flexible electricity demand informed by grid forecasts, with optional inspectable commitments.

The user explicitly requests washing, television, household cleaning, car cleaning and other electrical activities; typed or selected tasks; a simulation page; one-task and multi-task planning; a separate whole-day planner; useful reports; richer home-page content; current API data and a real backend. These requirements replace the washing-only product target. They do not make the existing code multi-activity software.

Approved initial design defaults: retain the current GB national signal and Europe/London scheduling for this expansion; model tasks as uninterrupted activities with optional fixed starts; initially allow up to twelve activities per schedule. These are engineering boundaries, not statements that electricity use elsewhere or other activities are unimportant. Additional geographic coverage requires its own suitable data source.

## 2. Approach and alternatives

**Recommended: extend the existing application with a versioned activity engine.** Reuse Auth, validated grid snapshots, quotas, persistence patterns and the ledger worker. Add independently testable energy estimation and multi-task scheduling, then expose them through separate pages. Preserve v1 historical records and calculations.

An AI-only calculator would be quick to demonstrate, but cannot establish the wattage of an unknown appliance, guarantee constraint satisfaction or reproduce calculations. It does not satisfy the real-data requirement. A device-connected energy platform could measure consumption, but requires specific meters, appliance integrations and access the project does not currently have. Device connections can follow a useful software estimator rather than gate this expansion.

## 3. Pages and navigation

| Page | Job and core content |
|---|---|
| `/` — Home | Explain the household problem, distinguish the three workspaces, show a timestamped GB grid summary, explain how estimates are made, describe supported activities, and explain receipts and limitations. Use real source attribution, useful FAQs and clear actions. No fabricated users, partners or impact counters. |
| `/app/simulate` — Simulate an activity | Select/type one activity; confirm appliance/profile, duration and start; inspect estimated electricity, CO₂ and a time-based breakdown; change inputs and compare scenarios without saving a commitment. |
| `/app/plan/new` — Plan tasks | One or several tasks, each with its own baseline, available windows and constraints; compare feasible schedules, review alternatives, then save. Existing v1 saved-plan URLs continue to work. |
| `/app/day/new` — Plan my day | Choose a local calendar day; add tasks, free time, fixed appointments, dependencies and resource constraints; compare baseline and proposed timelines, per-task changes and whole-day totals. |
| `/app/plans/[planId]` — Saved plan/report | Frozen schedule, task breakdown, assumptions, sources, actual publication state, per-task reporting and append-only corrections. A report belongs to its plan; do not duplicate it on every input page. |
| `/app` — My plans | Real saved schedules and statuses, navigation to all three workspaces, meaningful empty states. Aggregate only comparable, deduplicated records with their evidence basis. |
| Existing settings, methodology, privacy, receipts and verifier | Extend the intended M10 pages to explain and inspect both supported method versions. Distinguish implemented owner features from still-unbuilt public pages. |

Separate route-level workflows share components and the same engine. A page has one main purpose. Keep premium, restrained typography and spacing from document 03; add useful content and task-specific controls rather than repetitive cards or decorative live counters.

## 4. Activity and energy inputs

Support both named task categories and a custom electrical activity. The category chooses relevant questions; it does not establish electricity consumption.

| Activity | Required distinction |
|---|---|
| Clothes washing, dishwasher, tumble dryer | Use estimated energy per selected cycle/programme and duration; a rated maximum wattage is not a measured cycle average. |
| Television, computer, fan, lighting | Average operating watts and duration, with device count and operating mode where relevant. |
| Vacuuming, ironing, electric cleaning equipment | Active electrical runtime, device power, supervision and any resource conflicts. |
| Car cleaning | Clarify hand washing versus pressure washer, vacuum or other powered equipment; estimate each declared electrical component. Do not assign electricity to an unspecified method. |
| Charging or custom equipment | Supply task energy or a suitable operating-power profile and duration; ask for missing information rather than infer it from the name. |

Energy evidence priority:

1. User-supplied task energy from their device information or a previous measurement, explicitly labeled with its origin; a typed measurement remains user-reported.
2. An exact manufacturer/model/programme specification, stored with source URL, retrieved/reviewed date, units, operating conditions and record version.
3. A cited category estimate with applicable conditions and clear limitations, explicitly confirmed by the user.
4. Manual watts or kWh when no relevant source exists. Without sufficient inputs, return `needs_information`, not a guessed number.

A sourced profile registry is reference data, not fabricated output. Its first release needs real reviewed entries for the advertised categories. No universal live appliance-consumption API has been established in this research. A model cannot create a plausible URL, wattage or reference record and treat it as evidence. User-provided URLs are references only; do not add an arbitrary server-side URL fetcher.

Categories can be broadly supported through custom inputs without claiming automatic model identification. Water, detergents, petrol, product manufacture and other lifecycle effects are outside this electricity estimate. A confirmed non-electric activity may be labeled `no_direct_electricity`; that does not mean its total environmental footprint is zero.

## 5. Simulation workflow and real-time meaning

1. Select an activity or describe it in plain language.
2. Optional AI maps the text to editable activity fields, explicit timings and clarification questions. For ambiguous “clean my car,” ask which powered equipment is involved.
3. Resolve and display the energy basis from trusted records or user inputs; the user confirms it.
4. Fetch the current applicable grid snapshot through the existing server adapter. Show source, geographic boundary, interval and retrieval time.
5. Calculate energy and CO₂ deterministically. Display input assumptions, energy, CO₂, timeline, data state and source detail.
6. Changing duration, device count or operating mode recalculates immediately against the loaded snapshot. Changing the time range requests missing coverage. Cancel or ignore stale responses so an older result cannot replace the newest input.
7. A fresh forecast creates a new simulation result. It never mutates an accepted plan. Carry reviewed inputs into planning through an explicit action.

“Real time” means current available grid data and responsive what-if calculations. It is not second-by-second appliance measurement. Proposed grid refresh is every five minutes while the page is visible, coalesced across requests, using existing freshness rules and clear last-updated labels. No inference call on every keystroke, chart animation or refresh timer. An optional session timer may update modeled elapsed consumption only when labeled as a simulation; it is not necessary for the first expansion.

Electricity can still be estimated during a grid outage when its inputs are valid; CO₂ is then unavailable. Show that partial result explicitly. Historical windows require historical data. Future intervals use forecasts; do not substitute the current factor for all future hours. A grid gap must not become a successful full-period CO₂ estimate.

## 6. Calculation method v2

Keep `carbonshift-gb-uniform-v1` unchanged. Proposed new method: `carbonshift-gb-activities-v2`, with versioned descriptor, schemas and reproducibility fixtures.

For constant average power, electricity in kWh is watts × elapsed hours ÷ 1000. For declared cycle energy, preserve total energy and disclose the assumed distribution unless a documented time profile exists. Variable-power activities require appropriate segments or explicitly assumed average power; do not silently equate nameplate maximum with average demand.

Implementation should represent energy at integer mWh precision, integer seconds and exact rational intermediate arithmetic using BigInt. Integrate each relative energy segment over overlapping source intervals. Convert to integer mgCO₂ only at the defined total rounding boundary. The descriptor must fix allocation, remainder handling and rounding before code. Do not reuse v1's 50 Wh minimum, three-hour limit or half-hour duration validation for small/short activities.

Input durations use whole minutes, including tasks shorter than thirty minutes. Proposed flexible-start search uses a five-minute grid, plus explicit user baseline/fixed starts and feasible window boundaries. Source intensity remains its native half-hour resolution; finer scheduling does not create finer forecast measurements. “Best” always states the searched candidate set, not a continuous-time guarantee.

For timing-only comparisons, hold task count, energy and duration constant. Moving a task can lower its estimated grid-associated CO₂ while using the same electricity. A duration/mode change is a separate scenario comparison, never presented as a timing-only saving. Report baseline and recommended kWh, both CO₂ estimates, signed difference and percentage only where the baseline is positive. No uncalibrated confidence intervals or guaranteed avoided-emissions claims.

## 7. Task planning and window outcomes

Each task has a stable ID, category/custom name, profile and provenance, duration, explicit baseline start, one or more allowed windows, blocked intervals, fixed/flexible state, optional predecessor tasks and required resources. User time availability and device availability are distinct. A task requiring continuous attention occupies the user resource; an unattended task may overlap only under the user's confirmed supervision constraints. Preserve manufacturer operating constraints.

Compute the whole duration, not just the cleanest start interval. Offer up to three distinct feasible alternatives when available. If fewer exist, show fewer. No universal “sustainable” threshold is invented: compare with the confirmed baseline and describe relative differences.

| Outcome | Behavior |
|---|---|
| Window shorter than task | Name the task, required duration and available time; offer edits. Do not shorten it automatically. |
| Blocked times/dependencies/resources prevent a schedule | Identify the conflicting constraints. Never silently omit a task or move a fixed appointment. |
| Valid lower estimate | Show baseline/recommendation times, kWh, CO₂, signed difference, alternatives and source/assumption details. |
| Feasible but no lower estimate | Say the baseline is already as good as the evaluated options, or that improvement was not found within the current search. This is a valid result, not a form error. |
| Data unavailable or stale | Show unavailable state and preserve inputs; do not infer that no better time exists. |
| Bounded search exhausted | Distinguish “no solution found within the search limit” from proven infeasibility. If a feasible incumbent exists, label it best found and disclose that optimality is unproven. |

For a user-enabled broader search, examine additional covered time and return the specific required relaxation (for example, a later finish) plus the comparison with the original valid baseline. Preserve fixed times and other hard constraints. The extension is a proposal; accept it only after the user changes/confirms the constraint. Quantify a difference only when both schedules have valid energy and grid coverage. If the original timing is impossible, show its feasibility problem instead of inventing an accepted baseline or saving.

## 8. Whole-day engine

Collect the day, up to twelve activities initially, per-task windows, fixed times, quiet/blocked periods and explicit dependencies such as washing before drying. Do not infer that all tasks require continuous presence or that none do. Unsupported operating constraints require clarification.

Build and validate a feasible baseline schedule first. Minimize the sum of estimated task CO₂ while respecting every constraint. Distinct devices may overlap when their resources allow it; two jobs on the same washer cannot. Two attention-intensive activities cannot overlap for the same person. Fixed TV time remains fixed unless the user marks it flexible. Always-on or safety-critical equipment is estimate-only and cannot be casually deferred.

Independent tasks can be optimized independently. Coupled tasks need a deterministic bounded search with stable ordering, pruning and a feasible incumbent; greedy placement alone is insufficient to claim a global optimum. Proposed budget: 50,000 explored nodes, with separate request cancellation. Report proven optimum only if the search completes; otherwise return best found or search incomplete. Validate tiny cases against exhaustive enumeration. Confirm performance before making the twelve-task limit a release promise.

Day boundaries use London calendar dates, including 23/25-hour DST days. A task must finish within the declared day unless a cross-midnight extension is explicitly reviewed. Existing 48-hour forecast availability still applies. Forecast coverage, not a date-picker promise, determines whether the entire requested day can be scheduled.

The output is a baseline timeline, proposed timeline, per-task comparison, total kWh/CO₂, conflicts or limitations, and save review. Save the schedule atomically with immutable child tasks; a partial save is not a completed day plan. Report each task separately afterward. Aggregate completion estimates only for comparable completed tasks, disclose missing tasks and count each task once. A non-run does not earn avoided-emissions credit.

## 9. AI and backend responsibilities

Extend the two existing roles through new schema/prompt versions:

- **Activity and constraint interpreter:** extract one or multiple requested tasks, explicit units/times/resources, uncertainty and supporting source spans. Resolve only known profile IDs through deterministic lookup; no self-invented energy values.
- **Result explanation selector:** use computed facts to select grounded reasons, conflict guidance and available next actions. Numbers and dates are rendered from the engine, never rewritten by model prose.

The workflow is text → validated suggestions → clarification/user review → profile resolution → grid snapshot → deterministic calculation/scheduling → grounded explanation → human save → optional publication. Separate concerns do not require more autonomous agents. Existing provider ceilings, deduplication and two-attempt task limits remain. Expanded schemas require their own focused accuracy evidence; the washing-only evaluation is not qualification for day planning. Current Gemini timing timeouts remain a known issue, with a complete manual path.

Use new versioned shared contracts and `/api/v2` endpoints for profiles, simulation, schedule comparison and accepted schedules. Keep the v1 routes and schemas operational for their existing records. Server loads trusted profile versions and computes all totals; clients cannot supply owner IDs or authoritative carbon totals. Reuse owner checks, same-origin protection, shared rate admission and idempotent mutations.

New tables/records should distinguish reviewed profile versions, expiring comparisons, immutable accepted schedules/tasks, per-task reports and publication revisions. Add migrations rather than rewrite applied migrations. New private activity names and whole-day routine text must not leak through AI logs or public exports. Manual input remains usable without model capacity; figures remain usable without optional explanation inference.

## 10. Reports, receipts and compatibility

Preserve all existing v1 plans, reports, manifest hashes and Sepolia records. Add explicit v2 serializers, method dispatch and verification; old unknown-method behavior must continue to fail honestly. The existing Solidity contract stores arbitrary plan/method hashes, so its interface appears reusable; this is an inspection finding, not a tested v2 integration or authorization to redeploy.

One saved multi-task schedule can have one consented commitment containing the reviewed task set and frozen aggregate, followed by consented result revisions. A single precommit must precede the earliest baseline or selected start across all tasks. A day partly underway cannot become a newly precommitted whole-day plan: keep it private or explicitly create a new plan for future tasks. Simulation estimates are not commitments.

Review publication separately: full-day timing and resource constraints can disclose routines. Public data must include enough sanitized fields to reproduce the claimed calculation while excluding raw prose, account identifiers and private notes. Never promise both full public reproducibility and secrecy of all schedule inputs. V2 publication stays unavailable until its exact manifest, consent, size limits, v1/v2 verifier and real testnet journey pass. Private simulation/planning should work independently of this gate.

## 11. Delivery sequence and focused verification

The approved expansion sequence is listed in document 13 as X00–X05. These are new tasks, not retroactive changes to passed M00–M09 gates. M10 public pages should use the approved v1/v2 presentation contracts; M11 remains the release phase.

Required practical evidence: short appliance calculation, multi-interval energy integration, ambiguous car-cleaning clarification, valid zero improvement, impossible window, proposed relaxation, unavailable grid, conflicting day schedule, fixed task preservation, day save/reload, per-task completion, cross-user rejection, one v1 regression fixture and v2 export verification. Include actual current-grid and bounded provider checks when their consuming feature exists. Use targeted tests during each slice and one integrated run at the end, rather than repeatedly running the full suite without new reason.

No capability is complete merely because this proposal names a route or record. Detailed executable contracts and the numbered owner documents must be aligned before implementation. The historical scopes remain recognizable and existing work remains intact.

## 12. Source notes and outstanding decisions

Official sources inspected for this proposal:

- [NESO API definitions](https://carbon-intensity.github.io/api-definitions/) and [endpoint index](https://api.carbonintensity.org.uk/) document the GB signal, half-hour intervals, forecast/estimated fields and forward windows. These support the source boundary; they do not establish live account access or household measurement.
- [Virginia Tech/Virginia State University appliance energy guide](https://www.pubs.ext.vt.edu/content/pubs_ext_vt_edu/en/2901/2901-9014/2901-9014.html) supports watts × time estimation and the importance of operating settings. It does not supply a verified profile for any user's device.

U34 accepts GB-only live carbon guidance initially and the twelve-task/five-minute search boundaries. Exact contracts are now owned by the U34 sections of documents 06–10. Profile availability and joint-search performance must be checked during implementation. Public AI eligibility, actual privacy contact and hosting remain the existing release decisions; this expansion does not activate billing.
