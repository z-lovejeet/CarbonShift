# CarbonShift — repository guidance for Codex

## Start here

At the start of every phase, read `docs/README.md`, `docs/decisions-and-status.md`, and all fourteen numbered documents, as the user requested on 21 October 2026. Within the phase, revisit the sections linked by the current task in `docs/13-development-roadmap-and-codex-tasks.md`. Read existing code before editing it.

The user selected CarbonShift, builds solo, and has authorized M07 after M00–M06. Check the status log, existing code, and package.json for actual implementation and checks. Installed tools and tested modules do not imply configured accounts, keys, working later integrations, deployments, or completed feature acceptance.

The documented scope is the working baseline for the authorized phase. Follow subsequent user corrections and record consequential changes. Complete M07.01–M07.05 in roadmap order, preserve the manual planner and Google/GitHub accounts, and stop at G07. M07 passed locally; use the current G07 handoff and wait for explicit M08 authorization. Later phases and paid activation remain unauthorized. U29 authorizes only committing and normally pushing the current M04–M07 source batch; it does not authorize future automatic publication.

M06 is complete locally under the documented manual-first experimental quality policy; current evidence and next-phase boundaries are in the status log. Follow documents 09/11 and the task breakdown in 13. Key presence/catalog visibility is not role qualification. The policy loader/template/local setup have migrated to AI_POLICY_JSON; legacy model fields are rejected with enabled AI. Keep the two bounded roles. Current local evaluated routes are enabled; new/unevaluated routes must remain excluded until their own evidence exists. Timing assistance remains visibly experimental with explicit review. Keep the public UK profile unresolved until its deployment decision. Extra agents/features and paid activation remain outside scope.

## Product boundaries

- Primary track: Renewable Energy & Energy Trading.
- Working MVP baseline: one washing cycle, GB national signal, Europe/London scheduling, assumed energy profile, self-reported execution.
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

## Verification and handoff

Roadmap version 2 divides the build into phases `M00`–`M11` and tasks `Mxx.01`–`Mxx.05`. Execute ready tasks sequentially within the authorized scope. Check the phase's entry conditions, required reading, work area, and exit gate. Do not mark a phase passed while required live checks are pending; continue eligible independent work when an external dependency is unavailable.

Document 05 distinguishes implemented foundation scripts from later targets. Inspect `package.json` before running or citing commands. Run checks appropriate to the change and inspect their output. Normal tests use isolated fixtures/services, not paid APIs. The M00 research verifier is historical and intentionally rejects a scaffolded application.

Before marking a task done, record actual changed files, executed checks, observed outcomes, and remaining issues in the status log. Distinguish local tests, live provider checks, and testnet evidence.

Use the roadmap's task handoff format, including the next ready task and exact resume action. Preserve the existing interfaces and completed work when starting a fresh coding session.

Do not invent model access, benchmarks, transaction hashes, deployment URLs, or successful tests. Preserve user edits and existing research. Make focused changes and keep interface/document updates with the implementation.
