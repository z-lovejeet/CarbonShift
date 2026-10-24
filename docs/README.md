# CarbonShift documentation

Prepared 20 October 2026; household acceptance revision 24 October. This is the index and reading guide for **14 project documents plus three guidance files**. M00–M09 passed their scoped gates; G09 includes actual Sepolia and exported-proof verification. M06 timing assistance remains experimental/manual-first after measured quality misses. U34 household simulation/planning/reporting and revised local M10 public receipt/verifier pages are implemented and passed their scoped acceptance; M11 public release remains pending. See the root README and status log for actual evidence.

## Start here

**Latest direction, U33/U34:** the user has requested a household electricity simulator plus separate task and day planners, replacing washing-only as the product target. Read the [approved expansion design](superpowers/specs/2026-10-23-household-electricity-design.md), PRD section 0 and status section 25 before further phase work. X00–X05 and revised local M10 are implemented; status section 27 and the final household evidence distinguish isolated checks, real service journeys and Sepolia confirmations. Each owner now has an approved U34 target section alongside historical v1 contracts. The [implementation plan](superpowers/plans/2026-10-23-household-electricity-plan.md) was reviewed and sequential execution approved; the sequence is in roadmap section 10. This supporting design does not recreate removed documents 15/16.

For product review, read [01 — PRD](01-prd-and-blueprint.md), [08 — calculation methodology](08-scheduling-and-carbon-methodology.md), and [10 — blockchain/evidence](10-blockchain-and-evidence-specification.md) first. They contain the most consequential scope and trust choices.

At the start of every phase, read [AGENTS.md](../AGENTS.md), [decisions and status](decisions-and-status.md), and all fourteen numbered documents, following the user's 21 October instruction. Within that phase, revisit the specifications linked by the current task in [13 — roadmap](13-development-roadmap-and-codex-tasks.md).

The documents form the **working implementation baseline** adopted during M00 under the user's instruction to start that phase. Individual defaults were not separately approved one by one. Scope, quality expectations, external dependencies, and the phase stopping point are recorded in the status log; a specification is not evidence of implemented behavior.

## Document index

| # | Document | Authoritative subject |
|---|---|---|
| 01 | [PRD and product blueprint](01-prd-and-blueprint.md) | Intent, audience, scope, differentiating hypothesis |
| 02 | [Features, pages, and flows](02-features-pages-and-flows.md) | Feature IDs, page inventory, user journeys |
| 03 | [UI/UX and design system](03-ui-ux-and-design-system.md) | Layouts, components, copy, visual/accessibility rules |
| 04 | [Architecture and system design](04-architecture-and-system-design.md) | Module boundaries, data flow, worker, failure handling |
| 05 | [Tech stack and folder structure](05-tech-stack-and-folder-structure.md) | Dependencies, proposed file tree, version policy |
| 06 | [Data model and state machines](06-data-model-and-state-machines.md) | Types, tables, ownership, transitions |
| 07 | [API and integrations](07-api-and-integrations.md) | Endpoint contracts, provider adapters, errors |
| 08 | [Scheduling and carbon methodology](08-scheduling-and-carbon-methodology.md) | Time rules, formulas, baselines, evidence limits |
| 09 | [AI agents, models, and workflow](09-ai-agents-models-and-workflow.md) | AI responsibilities, prompts, models, fallback |
| 10 | [Blockchain and evidence](10-blockchain-and-evidence-specification.md) | Manifests, hashes, contract, verification claims |
| 11 | [Security, privacy, and abuse](11-security-privacy-and-abuse.md) | Authorization, secrets, publication, retention |
| 12 | [Testing and AI evaluation](12-testing-and-ai-evaluation.md) | Acceptance tests, fixtures, metrics, release evidence |
| 13 | [Development roadmap and Codex tasks](13-development-roadmap-and-codex-tasks.md) | 12 build phases, 60 focused tasks, dependencies, checks, and session handoffs |
| 14 | [Manual setup guide](14-manual-setup-guide.md) | Builder accounts, keys, environment, essential deployment |

The other guidance files are this index, root `AGENTS.md`, and `docs/decisions-and-status.md`. Standalone documents 15 and 16 were removed at the user's request and have not been created.

## Task-specific reading

| Task | Read |
|---|---|
| Understand the product | 01, 02, decision log |
| Implement pages/components | 02, 03, relevant API schemas in 07 |
| Build scheduler/carbon math | 06, 08, tests in 12 |
| Add database/auth | 04, 06, 07, 11 |
| Add Gemini/Groq | 07, 09, 11, AI tests in 12 |
| Add contract/public receipts | 06, 07, 10, 11, contract tests in 12 |
| Configure environment/deployment | 05, 14, current milestone in 13 |
| Resume after an interruption | Decision/status log, current task, relevant source files and latest test evidence |

## How documents stay consistent

Historical feature IDs `F01`–`F12` map to tests `T01`–`T12`; U34 adds `F13`–`F20`/`T13`–`T20` and `P13`/`P14`. Existing pages retain their IDs; implementation phases preserve milestone IDs `M00`–`M11`. Each phase has tasks `.01`–`.05`, such as `M02.03`, and a specific exit gate.

Use one focused task at a time. The roadmap specifies required reading, work areas, expected outputs, checks, external dependencies, and prompts for starting or resuming work. Record task evidence in the decision/status log; an unavailable API key blocks its dependent integration, not unrelated local development.

Each subject has one owner above. Other documents link to it instead of redefining it. A code-driven change to a schema, method, role, or scope must update the owning document and affected tests.

### 22 October pre-M06 revision

Document 09 now owns the quota-aware Gemini 3.8 → available/qualified 3.6 → 3.5 Flash-Lite candidate order, Groq recovery and two-call bound; an exhausted candidate is skipped before dispatch. The requested Flash ceiling is 17/day, Lite's safety ceiling is 425/day against a builder-reported 500. Minute/token limits are now supplied; exact provider bucket sharing remains unverified and conservative shared buckets apply. Documents 06/07/11 specify shared admission, task-key deduplication, login/submission throttling and privacy; 12/13 specify tests and phased execution. Document 14 describes the completed migration from legacy model fields to server-only `AI_POLICY_JSON`. No new product page or autonomous AI role was added.

M06 is now complete locally under its documented manual-first experimental policy. Policy migration, shared admission, provider adapters, private AI endpoints, reviewed UI and Auth/submission controls are implemented; use the status log for current verification. Both authenticated catalogs were read and bounded Groq/Gemini Lite smokes passed. The builder approved the labels. Current local roles are enabled after actual evaluation and a passed assisted save/reload journey; unevaluated roles remain excluded and unknown sharing uses conservative common buckets. The 17/day Flash evaluation budget may span several quota days. Free Gemini eligibility for a public UK audience remains an explicit deployment decision, never an assumed billing upgrade. Historical research/proposals do not override the revised owners.

“Proposed” means a design decision. “Verified source” means an official reference was inspected. “Implemented” and “passed” require code and actual execution evidence. No benchmark, account access, deployment, or integration result has been established merely by writing these files.

The [earlier build guide](../research/wave-2/top-three-build-guide.md) and [project assessment](../research/wave-2/project-ideas-claude-analysis.md) remain background. Their alternative projects, rough estimates, and broader ideas do not override this bounded CarbonShift specification.

### M07 private lifecycle implementation

M07.01–M07.05 implement append-only reports/results, actual-factor refresh, corrections/history, cancellation and recently reauthenticated private/account deletion. Versioned envelopes and commands are in 06/07. Public/chain-aware deletion remains M09/M11. The status log distinguishes isolated, live and authored-fixture evidence. M08 local proof/verifier/contract is implemented under U30; publication, funded signer and deployment require M09 authorization.

### M08 local proof boundary

The browser-safe entry is `src/domain/proof.ts`; server-only allowlist builders are in `src/server/proof/`. Document 10 version 1.1 owns exact exported fields, pinned method, separate verification states and trusted-observation boundary. The generated versioned contract ABI/build fingerprints and authored goldens are checked by ordinary local tests. No public routes, wallet setup, publication table or hosted/testnet transaction was added. See status section 22 for actual G08 evidence and the next handoff.

### M09 publication gate

Exact previews/consent, private/public revision mapping, fenced outbox worker, persistence-before-broadcast, canonical reconciliation and owner UI/export are implemented. The real Sepolia plan and separately consented cancellation result passed all seven independent checks; see status section 24 and `research/phase-9/`. Current Groq explanation/cache passed live; two Gemini timing requests timed out and manual recovery remains available. This is historical M09 evidence. Revised local M10 pages subsequently passed for v1/v2 under U34; M11 release remains pending.

### Household acceptance — 24 October 2026

[Status section 27](decisions-and-status.md#27-household-expansion-and-revised-local-m10--final-acceptance) records X02–X05 and M10.01–M10.05 gates, exact checks, live AI and testnet identifiers. [Final evidence](../research/household/final/README.md) describes the actual mixed-day journey and its self-report/pending-factor limits. The three entry pages are `/app/simulate`, `/app/plan/new` and `/app/day/new`; no new account, paid service or source publication was introduced.


### U37 interface alignment — builder review

The builder approved the new landing appearance and requested the same visual quality and detail across the rest of the app. Shared page/form/report styles and page-specific guidance are implemented; see document 03 and status section 29. Compilation/lint checks passed. Browser and functional testing of this presentation update are intentionally left to the builder, so earlier acceptance evidence is not a new visual pass for these changes.

### M11 current release work

The builder authorized final release checks, the 40–50 commit GitHub publication batch, and GitHub-based Vercel deployment. They will connect the repository in the existing project dashboard. Privacy contact and local OAuth port alignment are configured; production billing/profile, deployment OAuth and worker availability require actual evidence. See status section 31 and the M11 section of document 14. Earlier no-publication/testing-deferral notes remain historical.
