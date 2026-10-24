# CarbonShift — household electricity implementation plan

23 October 2026 · U34 approves the written design and requests the build. The user reviewed this plan and selected “Proceed sequentially in this chat.” X00 alignment is complete; subsequent task evidence is recorded in the status log.

## Outcome and execution

Deliver three connected, separate workspaces: activity simulation, one/multiple-task planning, and whole-day planning. Include useful reports, current GB grid data, reviewed energy assumptions, optional Gemini/Groq assistance and versioned evidence. Preserve existing accounts, v1 plans and Sepolia receipts. “Winning project” is the quality ambition; competition results cannot be promised.

Use the existing application and dependencies. Execute sequentially in this chat, one working slice at a time; no additional agents, new service accounts, paid activation, Git commits or push are part of this plan. Existing permission for development Supabase work and dedicated Sepolia checks covers necessary incremental integration; it does not permit destructive database resets or unrelated wallet transactions. Do not redeploy the contract unless a demonstrated incompatibility requires a separately reviewed change.

Design: [household electricity design](../specs/2026-10-23-household-electricity-design.md). Authoritative details remain in the fourteen numbered documents; their new U34 sections supersede conflicting washing-only restrictions for new features. Historical v1 sections remain applicable to v1 records. Read all fourteen plus index/status/guidance at each phase start, then inspect affected code before edits.

## User-visible delivery contract

| Requirement | Delivered behavior | Build tasks |
|---|---|---|
| Everyday electrical activities | Washing, dishwashing, drying, TV, computing, lights, fans, vacuuming, ironing, powered car cleaning, charging and custom input; clarify equipment and energy basis | X01.01–.03, X02.02–.04 |
| Real-time simulation | Current applicable grid factors with retrieval time; editable inputs; interval breakdown; unavailable CO₂ when grid data is absent; no claim of measurement | X01.04, X02.01–.05 |
| Plan one or several tasks | Reviewed baseline, individual windows, fixed activities, blocked times, resources, dependencies and up to three alternatives | X03.01–.05 |
| Helpful failures | Too-short window, conflicting constraints, unavailable data, no improvement and incomplete search are different outcomes; optional wider-window proposal requires review | X03.01–.03 |
| Plan an entire day | Separate calendar-day editor and timelines, up to twelve tasks, London DST handling, atomic save and per-task completion | X04.01–.05 |
| Full report | Electricity and CO₂ for baseline/recommendation, per-task differences, data/source assumptions, search limits, subsequent reports and corrections | X03.04–.05, X04.03–.05 |
| Useful AI | Editable source-backed interpretation and grounded explanation selection; both manual and deterministic template fallbacks work | X02.02–.03, X03.05 |
| Real blockchain | Versioned exact-consent export and real worker/chain status; v1 evidence still verifies; no claim that a hash measures electricity | X05.01–.04 |
| Rich, restrained pages | Home, three workspaces, saved reports, history, methodology, privacy, public receipts and local verifier | X02.04, X03.05, X04.01, X05.05, revised M10 |

No route, named model or table is evidence of completion. A task passes only after its stated behavior works and its check outcome is recorded.

## X00 — align the approved expansion

Work area: documentation only. Dependencies: U34 approval of the written design. Output is an implementation plan and aligned owner documents, with plan review completed under U34.

| Task | Concrete output | Check |
|---|---|---|
| X00.01 | Record U34; retain GB national coverage, London time, twelve-task ceiling, five-minute candidates, 50,000-node search bound; distinguish these design defaults from measured performance | No remaining current-direction paragraph calls the written design unapproved |
| X00.02 | Align 01–05: feature/page IDs, workflows, layout, domain/server/UI seams and proposed files | Every requested workflow has a page, server path and acceptance test |
| X00.03 | Align 06–11: exact units/rounding, v2 inputs, persistence, API outcomes, AI qualification, proof version and privacy | No v1 schema or hash is reinterpreted as v2; unavailable differs from zero |
| X00.04 | Align 12–14: focused evidence, these executable tasks, setup/deployment boundaries | Tests address observed risks; no new mandatory secret invented |
| X00.05 | Check links/fences/conflicts; present this plan and record execution choice | Plan reviewed before product code under the brainstorming workflow |

Exit: approved design, consistent owner contracts, reviewable implementation plan. Documentation checks do not pass X01 or later gates.

## X01 — activity data and deterministic calculation

Read especially 06/08/12. New work area: `src/domain/activities/`, `src/contracts/activities.ts`, `src/data/activity-profiles.ts`; extend `src/domain/time.ts` only with compatible calendar/range helpers. Keep existing `src/domain/method.ts`, v1 schemas and calculation outputs unchanged.

| Task | Implementation and interfaces | Required evidence |
|---|---|---|
| X01.01 | Strict `ActivityInputV2`, energy-basis/provenance and `ScheduleInputV2` schemas; frozen `ACTIVITY_METHOD`; exported `resolveActivity`, `estimateActivity` interfaces | Missing power/energy and unknown profile versions reject; custom activities need sufficient inputs; no AI-generated watts become authoritative |
| X01.02 | Decimal-to-integer parser, mW/mWh conversion, quantity handling, rational segment integration, per-task rounding, nullable coverage | Independent known answers for small/short loads, boundary overlap, quantity and cycle conservation; zero-factor vs missing-factor distinction |
| X01.03 | Versioned reviewed manufacturer reference records, with exact model/mode and maximum/rated/average distinction; editable manual path for every category | Source URLs and conditions inspected; named tasks never silently receive a generic measured profile; car-cleaning method clarified |
| X01.04 | Floor/ceil grid coverage for minute-level activities; explicit London ambiguity and day boundaries; freshness wrapper using existing grid adapter | Winter/summer, 23/25-hour day, non-half-hour starts and incomplete first/last interval checks |
| X01.05 | Freeze v2 descriptor/known-answer fixtures and validate unchanged v1 examples | Focused domain tests plus v1 golden compatibility; actual file/check evidence in status |

Exit: user inputs and trusted profile records produce reproducible estimates with honest provenance. No UI/AI/DB dependency in the pure engine.

## X02 — live simulator and activity interpretation

Read especially 02/03/07/09/11. Work area: `src/server/activities/`, `src/app/api/v2/activities/`, `src/app/app/simulate/`, `src/components/activities/`, `src/lib/activity-api.ts`, existing AI runtime with explicit version dispatch.

| Task | Implementation and interfaces | Required evidence |
|---|---|---|
| X02.01 | Authenticated profile/simulation handlers; server resolves source versions and computes authoritative results; existing same-origin/shared admission; bounded forecast acquisition and partial result | Handler checks for unknown profiles, foreign/sessionless requests, fake totals, stale/missing feed; one real current-grid simulation |
| X02.02 | `activity-v2` interpreter schema/prompt and deterministic source-span/unit validation; role/variant-bound fingerprints and qualification; bounded explanation variant contract | Isolated assertions for unknown wattage, multiple activities, ambiguous cleaning, DST, contradictory times and injection; old v1 qualification does not enable v2 |
| X02.03 | Reviewed authored evaluation set and minimal justified free live checks of each candidate being enabled; reuse policy buckets, two-attempt cap and manual fallback | Actual model/variant outcomes recorded; failures remain disabled or visibly experimental under stated policy; no broad unchanged-model sweep |
| X02.04 | Dedicated simulator form, AI review/clarification, energy-source editor, accessible time breakdown, current-data labels and explicit “Use in planner” handoff | Desktop/mobile interaction; fast edits cannot display an old response; no model call per keystroke |
| X02.05 | Five-minute visible-page refresh, request cancellation, empty/loading/error/partial states and input preservation | Real typed/select task → review → estimate journey; service failure preserves inputs; v1 planner still usable |

Exit: actual current-grid estimates work for the named activities and custom inputs, with working manual recovery. Expanded AI capability is separately evidenced, never inferred from old washing results.

## X03 — one/multiple-task scheduling and private persistence

Read especially 06/07/08/11. Work area: new activity candidate/constraint/optimizer modules, `src/server/schedules/`, `src/app/api/v2/schedules/`, additive SQL migration following 009, generated DB types, task planner components.

| Task | Implementation and interfaces | Required evidence |
|---|---|---|
| X03.01 | Normalize windows/blocks; require feasible explicit baseline; task resources, fixed starts, attention and acyclic dependencies; enumerate five-minute and boundary candidates | Exact-fit and too-short windows, touching vs overlapping resources, unknown/cyclic predecessor, fixed start preservation |
| X03.02 | Independent-task shortcut and deterministic bounded coupled search with stable ties; keep feasible baseline incumbent; retain three distinct alternatives | Tiny coupled cases agree with an independently exhaustive reference; bounded adversarial case returns best-found/incomplete honestly; twelve-task elapsed time recorded |
| X03.03 | Explicit broader-window proposal, same energy and valid baseline, immutable original constraints; never silently accept the proposal | No-improvement case differs from missing data; quantified relaxation works only with covered forecast and subsequent re-review |
| X03.04 | Expiring comparison persistence, atomic accepted schedule/tasks, RLS, owner checks, idempotency and paginated history; apply incremental dev migration after isolated checks and regenerate types | Two-user denial, expiry, duplicate/conflicting save, transaction rollback and reload; no destructive reset of current records |
| X03.05 | Broaden `/app/plan/new`; shared task editor, baseline review, alternative schedule display, detailed report and optional grounded explanations; preserve v1 detail renderer | Browser one-task and two-task save/reload using API results; baseline/source/estimate labels; old plan URL still opens |

Exit: one or multiple tasks can be compared, reviewed and saved immutably. Solver status states exactly what was searched and proven.

## X04 — whole-day planning and task lifecycle

Read especially 02/03/06/08/11. Work area: `src/app/app/day/new/`, day timeline/editor components, shared schedule domain, schedule lifecycle server/API and a new additive lifecycle migration.

| Task | Implementation and interfaces | Required evidence |
|---|---|---|
| X04.01 | Separate day workspace with calendar date, tasks, per-task free windows, blocks, fixed appointments, attention and dependencies; no twelve-task mega-form on simulator | Keyboard/mobile task editing; incomplete tasks have actionable field errors; local day boundaries visible |
| X04.02 | Compare complete baseline and selected timeline; per-task and total electricity/CO₂; use same joint engine and atomic acceptance | Mixed wash/dry/TV/cleaning day retains fixed TV, dependency and resource rules; save/reload includes every task |
| X04.03 | Per-task ran/non-run reports, append-only corrections, actual-factor refresh and nullable whole-schedule coverage; account/private deletion updated | Partial/missing/non-run tasks never earn savings; latest revision counted once; owner isolation and correction conflict checks |
| X04.04 | Detailed saved report, completion controls and history entry across single/multi/day plans; stable version dispatch | User can understand forecast vs reported estimate, missing tasks, changed profile and negative difference without technical terms |
| X04.05 | Live mixed-day save/reload and one task report/refresh; focused day/lifecycle regression | Exact observations recorded; no invented appliance measurement or full-day completion |

Exit: the whole-day flow is independently usable and reporting does not overstate impact.

## X05 — v2 proof, integration and useful home content

Read especially 10/11/12 and actual M08/M09 source before touching proof/worker behavior. Work area: `src/domain/proof/v2/`, proof builders, publication repository/worker adapters, new incremental publication migration, owner report UI, home and dashboard.

| Task | Implementation and interfaces | Required evidence |
|---|---|---|
| X05.01 | Exact v2 manifest schemas, method digest, canonicalization and explicit verifier dispatch; sanitized public task identities and reproducible energy/grid inputs | Pinned v1 bytes/hash unchanged; v2 known-answer bundle verifies; tampered/unknown/mixed-version data fails with correct status |
| X05.02 | Schedule publication identity/preview/consent and append-only results; earliest-task cutoff, routine disclosure and exact payload digest; private/public history links | Consent mismatch, late day, foreign schedule, partial report, deletion and replay checks; raw text/custom labels/account IDs excluded |
| X05.03 | Adapt fenced outbox/worker to v2 hashes and timings while preserving prepared-byte persistence and reconciliation; reuse deployed contract if compatible | Local-chain full v2 plan/result verification and v1 worker regression; no signer in web environment |
| X05.04 | One bounded dedicated Sepolia v2 commitment and result/check with actual identifiers and downloaded verification bundle | Actual confirmed transaction/status/reproducibility; pending or failure recorded honestly; no unnecessary redeployment |
| X05.05 | Richer home: three clear workflows, timestamped GB summary, supported activities, real methodology and receipt explanation, useful FAQs; dashboard/history and reports connected | Current-data unavailable state works; all navigation useful; no fabricated counters; integrated checks below |

Exit: v2 private and consented public evidence work with the existing chain infrastructure, and v1 remains reproducible. Public receipt/verifier pages are finished in revised M10, not silently counted here.

## Revised M10 and M11

M10 keeps its existing task IDs. M10.01 public receipt data projections support both versions with anonymous-read rate limits; M10.02 public receipt page explains each evidence layer and per-task coverage; M10.03 browser verifier safely imports either version and verifies chain observations separately; M10.04 methodology/privacy/demo/navigation describe all three workflows and current source boundaries; M10.05 checks public/private access, cross-version exports and desktop/mobile paths. Demo data remains visibly authored and isolated from live acceptance.

M11 keeps its release tasks: check complete feature/route coverage; run one combined regression/build/security pass; resolve public AI profile, privacy contact and host/worker availability; configure deployment only within explicitly agreed budget/account choices; verify deployed OAuth, source refresh, manual/AI planning, report/publication/export; hand off exact commands, limitations and evidence. Do not equate a local worker with always-on hosting. No public deployment or billing choice is inferred from this local implementation plan.

## Focused verification policy

During a slice, run the named domain/API/SQL/component cases affected by it. Re-run after new edits/failures, not simply to generate larger totals. Use isolated authored fixtures for normal tests. Live AI runs use existing free quota reservations and require the expanded labels/enablement evidence in document 12; current-grid and testnet checks are separate from mocked tests.

At the integrated boundary run the existing applicable commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm contracts:test`, `pnpm test:e2e`, `pnpm build`. Inspect `package.json` before citing or adding new commands. Do not rerun historical M00 scaffold rejection as a current application gate. A green suite does not replace actually using each new route.

Minimum integrated user journeys:

1. TV/manual watts and duration → real grid simulation → planner handoff → private save/reload.
2. “Clean my car” → equipment clarification → powered-device energy basis → result with source limits.
3. Two tasks with a short/conflicting window → useful correction → valid comparison; no-improvement and optional wider-window proposal.
4. Mixed day with fixed TV, wash before dryer and attention conflicts → save → one completion, one non-run and correction → honest incomplete aggregate.
5. One v1 record/export still works; one v2 consented plan/result passes local and actual Sepolia verification; public view/import respects consent and source boundaries.
6. Missing grid, exhausted AI, repeated submissions, expired comparison and wrong-owner access retain correct states without fabricated data.

## Resume and handoff

Use document 13's handoff format after every phase: tasks passed, exact files, commands and outcomes, local vs live evidence, remaining issues, next ready task and exact resume action. Record blocked external checks while continuing independent authorized work; never mark their phase passed early. Keep each slice reviewable in the existing dirty tree without mixing unrelated edits or silently publishing it.

First product task after plan review: X01.01. Inspect existing domain schemas/time/grid and create the separate v2 activity contract and method descriptor. Do not replace v1 calculation code or open every new route as an empty placeholder.

U35 execution correction (24 October 2026): finish remaining implementation before one combined end-to-end/static/domain/SQL/contract/build verification pass. Do not repeat prior checks during implementation; diagnose earlier only when a concrete error blocks progress. This changes check timing, not acceptance criteria or honest completion requirements.

Final execution state (24 October 2026): X00–X05 and revised local M10 passed the scoped combined acceptance. See status section 27 and research/household/final/README.md for actual files/checks, AI qualification limits and testnet identifiers. M11 public release remains outside this completed local execution; do not restart this plan or repeat its testnet commitments.
