# CarbonShift — repository guidance for Codex

## Start here

Latest user correction U33 requests a household electricity simulator, one/multi-task planning, a separate whole-day planner, broader electrical activities and richer real-data content. Washing-only is the implemented v1 baseline, not the revised product target. Read PRD section 0, status section 25, roadmap section 10 and `docs/superpowers/specs/2026-10-23-household-electricity-design.md` and the approved implementation plan before continuing. U34 approved the written expansion design and the executable plan in `docs/superpowers/plans/2026-10-23-household-electricity-plan.md`, selecting sequential execution of X01–X05 and revised local M10 in this chat. All fourteen owner documents have U34 target sections. X00–X05 and revised local M10 passed scoped acceptance on 24 October; consult status section 27 and research/household/final/README.md. Preserve existing v1 calculations/records/receipts and distinguish final v2 evidence from historical M00–M09 checks. User scope corrections override the older no-new-pages/appliances restrictions below; they do not authorize paid activation or Git publication.

At the start of every phase, read `docs/README.md`, `docs/decisions-and-status.md`, and all fourteen numbered documents, as the user requested on 21 October 2026. Within the phase, revisit the sections linked by the current task in `docs/13-development-roadmap-and-codex-tasks.md`. Read existing code before editing it.

The user selected CarbonShift, builds solo, and has authorized M09 after M00–M08. Check the status log, existing code, and package.json for actual implementation and checks. Installed tools and tested modules do not imply configured accounts, keys, working later integrations, deployments, or completed feature acceptance.

The documented scope is the working baseline for the authorized phase. Follow subsequent user corrections and record consequential changes. M08.01–M08.05 passed locally at G08; U32 now authorizes M09 publication, worker and dedicated Sepolia deployment/testing plus integration checks. Preserve the manual planner, Google/GitHub accounts and private lifecycle. M09.01–M09.05 passed G09 locally/on Sepolia; use status section 24. U34 subsequently authorized revised local M10, now complete. Public release, paid activation and automatic source publication remain separate decisions. U29's source publication batch finished before M08.

M06 is complete locally under the documented manual-first experimental quality policy; current evidence and next-phase boundaries are in the status log. Follow documents 09/11 and the task breakdown in 13. Key presence/catalog visibility is not role qualification. The policy loader/template/local setup have migrated to AI_POLICY_JSON; legacy model fields are rejected with enabled AI. Keep the two bounded roles. Current local evaluated routes are enabled; new/unevaluated routes must remain excluded until their own evidence exists. Timing assistance remains visibly experimental with explicit review. Keep the public UK profile unresolved until its deployment decision. Extra agents/features and paid activation remain outside scope.

## Product boundaries

- Primary track: Renewable Energy & Energy Trading.
- Current product: separate household simulator/task/day workspaces, up to twelve tasks, GB national signal, Europe/London scheduling, confirmed energy assumptions and per-task self-reports. Existing washing-only records retain v1.
- Gemini and Groq are product providers. Codex's development model is separate.
- Scheduling, carbon arithmetic, authorization, and verification are deterministic software.
- No hidden appliance automation, tariffs, tokens, credits, global coverage, or new pages beyond the approved scope.
- Standalone documents 15/16 were removed by the user. Essential deployment instructions live in documents 13/14.

## Sources of truth

- Scope: 01. Features/routes: 02. UI: 03. Architecture: 04. Stack/layout: 05.
- Data/states: 06. API: 07. Carbon/time math: 08. AI: 09.
- Proof/contract: 10. Security: 11. Tests: 12. Tasks: 13. Manual setup: 14.
- Earlier `research/` files are background, not a competing implementation specification.

Resolve contradictions in the authoritative document and affected tests before implementing incompatible behavior. Keep stable feature/test/task IDs.

## Implementation rules

The frontend must follow the user's premium, modern, clean, minimal direction in document 03. Use deliberate typography, spacing, responsive behavior, and accessible states; avoid generic decorative layouts. Live values must come from validated inputs/services and deterministic calculations, never hardcoded success/impact data. Named, versioned method constants, UI copy, and explicitly labeled test/demo fixtures remain valid.

Keep pure domain modules independent of UI, database, AI, and network access. Validate every external input. Use integer units and explicit UTC instants as specified.

Accepted plan payloads and published revisions are immutable. Corrections append. Missing data are null/unavailable, never zero. Demo fixtures remain explicitly labeled and cannot enter live comparisons.

Never present an estimate as measured avoided emissions, a self-report as appliance verification, or a matching chain hash as truth of the inputs. Show pending/failed/uncertain transactions honestly.

Keep keys out of code, logs, browser bundles, and model prompts. The testnet signer belongs only in the worker environment. Use RLS plus server ownership checks; never trust client-supplied owner IDs or carbon totals.

## Current execution correction

U35 (24 October 2026) requests completing the approved expansion implementation first, followed by one combined verification/end-to-end pass. Avoid repeated per-slice testing; diagnose earlier only when an error blocks implementation. Preserve existing evidence and do not mark unfinished work passed.

## Verification and handoff

Roadmap version 2 divides the build into phases `M00`–`M11` and tasks `Mxx.01`–`Mxx.05`. Execute ready tasks sequentially within the authorized scope. Check the phase's entry conditions, required reading, work area, and exit gate. Do not mark a phase passed while required live checks are pending; continue eligible independent work when an external dependency is unavailable.

Document 05 distinguishes implemented foundation scripts from later targets. Inspect `package.json` before running or citing commands. Run checks appropriate to the change and inspect their output. Normal tests use isolated fixtures/services, not paid APIs. The M00 research verifier is historical and intentionally rejects a scaffolded application.

Before marking a task done, record actual changed files, executed checks, observed outcomes, and remaining issues in the status log. Distinguish local tests, live provider checks, and testnet evidence.

Use the roadmap's task handoff format, including the next ready task and exact resume action. Preserve the existing interfaces and completed work when starting a fresh coding session.

Do not invent model access, benchmarks, transaction hashes, deployment URLs, or successful tests. Preserve user edits and existing research. Make focused changes and keep interface/document updates with the implementation.

## Household acceptance handoff

X00–X05 and revised local M10 are complete with final isolated, real development service, AI/cache and Sepolia evidence in status section 27. Keep the U35 testing economy: do not repeat passing suites or spend model/testnet quota without changed behavior or a concrete failure. The next work is M11 release readiness; privacy contact, public AI profile and hosting/OAuth/always-on worker remain unresolved. The local app uses port 3001 while another project occupies 3000; original OAuth redirects remain 3000. Do not terminate the other project or silently reinterpret that as a new OAuth pass. No Git commit/push was made.


## Latest UI direction — U37

The builder tested/approved the U36 landing appearance and requested consistent premium, clean styling and useful detail across all pages. The presentation update is implemented; see document 03 and status section 29. The builder explicitly owns testing for this update. Run only static compilation/lint checks for this UI work; do not automatically run browser, functional, provider or blockchain tests. Do not infer that earlier U34/U36 acceptance passed the changed screens. Preserve routes, deterministic methods, backend authorization, private/public consent and the approved landing design.

## M11 current authorization — 25 October 2026

The builder authorized M11 implementation and release checks, superseding U37's earlier deferral of browser testing. Privacy contact is lovejeet1225@gmail.com. Hosting is Vercel using the GitHub repository; the builder will connect it manually after the source batch is pushed. The latest instruction explicitly authorizes 40–50 professional commits (planned batch: 45), a clean working tree and GitHub push. Do not treat older no-Git-publication statements as current prohibitions. Preserve global Git identity and existing history.

The builder selected Gemini plus Groq with qualified fallback, intends to enable Google billing and completed Vercel login. Billing activation is not yet verified; role qualification cannot be inferred from that choice. No direct CLI deployment is needed while the builder handles the Git connection. Read status section 31 for actual progress and remaining G11 gates. Local OAuth now allows 3001 without removing 3000; another project still owns 3000.
