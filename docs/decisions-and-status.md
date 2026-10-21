# CarbonShift — decisions and implementation status

Updated 21 October 2026.

## 1. Confirmed user instructions

| ID | Instruction | Status |
|---|---|---|
| U01 | Build direction is CarbonShift | Confirmed by user |
| U02 | Solo builder, using AI coding agents; latest stated development choice is Codex with GPT-6.1 Sol | Confirmed by user |
| U03 | Product AI uses Gemini API and Groq API with current models | Confirmed; authenticated availability/evaluation still required |
| U04 | Prepare the 14 project documents and three guidance files, sequentially | Confirmed |
| U05 | Remove standalone deployment/operations and demo/submission documents 15/16 | Confirmed; essential deployment retained inside 13/14 |
| U06 | Project must fit ClimateChain themes and be useful, understandable, and competitively differentiated | Confirmed; winning is not guaranteed |
| U07 | Divide the entire build into phases optimized for coding agents and write them in the development roadmap | Confirmed; roadmap version 2 supplies 12 phases and 60 tasks |
| U08 | Read all project documents before starting every phase | Confirmed 21 October; all fourteen numbered documents and guidance read for M00 |
| U09 | Premium, modern, clean, minimal frontend/UI/UX without generic AI-generated styling; backend behavior must be real and functional | Confirmed; quality requirements recorded in 01, 03, 04 and AGENTS.md |
| U10 | Start and complete M00 only for now | Confirmed 21 October; stop at G00, with M01 prepared as the next phase |
| U11 | Move to M01 according to the documents | Completed at G01 |
| U12 | Move to M02 — Phase 2 | Completed M02.01–M02.05 at G02; no M03 execution authorized |
| U13 | Publish current source to z-lovejeet/CarbonShift using global Git identity, with focused commits | User revised the limit to allow 32 commits, each touching 1–3 files; no larger initial-commit exception |

## 2. Working baseline decisions

The existing D01–D12 defaults are adopted as the working baseline under the user's instruction to start the documented M00 phase. This records implementation intent, not separate approvals of every default, service purchases, or passing product checks. Model access/performance and package compatibility still require the specified later checks.

| ID | Decision | Reason / trade-off | Owner document |
|---|---|---|---|
| D01 | National GB signal and Europe/London scheduling | Accessible feed with comparable national actual series; limited geography | 01, 08 |
| D02 | One washing cycle, assumed uniform energy profile | Bounded build; cannot claim measured appliance energy | 01, 08 |
| D03 | Self-report only; no meter/CSV/device control | Avoid unavailable integrations; execution remains unverified | 01, 06 |
| D04 | Manual-first workflow with two bounded AI roles | Useful during provider outages; evaluate whether AI reduces effort | 09 |
| D05 | Gemini 4 Argon and Groq GPT-OSS 120B primary pins, documented fallbacks | Current catalog-backed choices; account access, latency, cost untested | 09 |
| D06 | Recent Groq preview candidates evaluated separately | Honors current-model research while exposing preview risk | 09 |
| D07 | Next.js/Supabase modular application | Compact web deployment and relational state | 04, 05 |
| D08 | Optional operator-issued Sepolia commitments | Public history without user wallet friction; operator remains trusted for input claims | 10 |
| D09 | Local single-instance ledger worker for prototype | Protect signer and durable retries; laptop availability limits publication | 04, 14 |
| D10 | Public data only after exact preview/consent | Reproduction discloses timings/assumptions; copies cannot be recalled | 10, 11 |
| D11 | Append-only private reports/results and consented public revisions | Preserves changed assumptions/history; adds implementation work | 06 |
| D12 | Exact package/compiler versions resolved and smoke-tested in M01 | Avoid invented compatibility claims | 05 |

## 3. Open dependencies and evidence gaps

| Item | Next action | Blocks |
|---|---|---|
| Reviewer need / differentiation | Obtain feedback on frozen-baseline and portable-receipt utility; compare prior art | Strong novelty/usefulness claim, not writing a prototype |
| Scope review | M00.01 adopts the bounded baseline under U10; future consequential changes update the owning documents | Resolved for M00; no expansion authorized |
| Model account access | Builder supplies keys securely; run bounded schema smoke requests | Live AI integration/evaluation |
| Budget | Builder chooses provider limits/plans | Paid calls and optional paid services |
| Runtime/dependency compatibility | M01 foundation matrix resolved and checked; pin deferred SDKs when their consuming phases begin | Resolved for foundation; DB/model integrations still unverified |
| Email delivery | Verify external tester confirmation/recovery | Public onboarding claims |
| Testnet RPC/faucet | Verify chain and fund dedicated issuer | Actual ledger deployment |
| Privacy contact | Builder supplies actual operator contact | Inviting real users |
| Real user/partner evidence | Collect consented feedback if available | Field usefulness/independence claims |

No partner, external reviewer, benchmark result, deployed URL, or contract address is invented to close these gaps.

## 4. Work status

Documentation: the fourteen substantive drafts and the guidance files have been written and passed the documentation checks recorded below.

Roadmap version 2 preserves phase IDs with five tasks each. M00, M01 and M02 passed: fifteen tasks completed. M03.01 is `ready`; the other 44 downstream tasks are `not_started`. Task evidence below is authoritative; do not duplicate the whole backlog in another tracker.

| Milestone | State | Evidence |
|---|---|---|
| M00 Scope/access | Passed | G00 passed: scope, workspace, dependencies, public-source evidence and offline verification recorded in section 7 |
| M01 Repository/dependencies | Passed | G01 passed: pinned scaffold, web/worker config, 34 unit/component checks, local contract tooling smoke, nine browser checks, and clean reproduction |
| M02 Pure scheduler | Passed | G02: schemas/time/math/optimizer/updated-result projection; 122 domain checks plus 34 foundation checks, 2,300 property cases and six new browser checks; clean reproduction passed |
| M03 Grid integration | Not started | Official API documentation inspected; no application adapter |
| M04 Auth/data | Not started | No project/migrations created |
| M05 Planner UI | Not started | Wireframes specified in Markdown only |
| M06 Product AI | Not started | Catalogs inspected; no evaluation |
| M07 Completion/history | Not started | State model specified |
| M08 Contract/proof | Not started | Interface specified; no Solidity implementation |
| M09 Testnet publication | Not started | No deployment or key generated |
| M10 Receipt/verifier UI | Not started | Page behavior specified |
| M11 Release checks | Not started | Foundation/core run locally; full product/deployment acceptance remains pending |

## 5. Documentation review record

Observed on 20 October 2026 using a local read-only Python verification:

- PASS: 17 requested files, numbered documents exactly 01–14; excluded 15/16 absent.
- PASS: 44 local Markdown links resolve; one title per file; balanced code fences; consistent table columns; no unresolved placeholder markers.
- PASS: 12 feature-to-test mappings, 12 page IDs, and 12 milestone IDs.
- PASS: six arithmetic assertions reproduce the worked examples.
- PASS: three timezone assertions establish the 50-half-hour autumn day, 46-half-hour spring day, and distinct repeated 01:30 instants in Europe/London.
- PASS: original Claude source document SHA-256 matches the previously recorded value.
- Manual consistency review aligned the profile-confirmation field across UI/data/API/manifests, cancellation/publication races, account-deletion links, model pins, and chain identifiers.

An initial table-column check found a formatting issue in an API type union; it was corrected and the full check passed. Diagram rendering, application builds, paid API calls, database policies, and deployed contracts were not tested. Product-test results must not be inferred from these documentation checks.

Roadmap version 2 review, observed on 21 October 2026 using local read-only Python assertions:

- PASS: all 17 files remain present, with numbered documents exactly 01–14; 88 local Markdown links resolve after the roadmap expansion.
- PASS: 12 ordered phases and 60 unique tasks; each phase includes its goal, required reading, entry conditions, work area, five tasks, exit gate, and human dependencies.
- PASS: the dependency graph has 16 edges and no cycles; all P01–P12 page IDs and four external dependency gates are covered.
- PASS: three reusable execution prompts and an exact resume-action field are present; Markdown titles, code fences, table columns, and placeholder checks pass.
- Changed files for this revision: `docs/13-development-roadmap-and-codex-tasks.md`, `docs/README.md`, root `AGENTS.md`, and this status log.
- These checks validated documentation structure and references at that review. Application, authenticated-provider, deployment, and testnet checks were unperformed; all implementation tasks were then `not_started`. The later M00 execution record supersedes that task state.

## 6. Change log and handoff

- 20 October 2026: authored the full requested documentation package. The 60–80-hour engineering estimate supersedes the earlier concept-stage estimate for the expanded evidence/robustness requirements.
- 20 October 2026: expanded document 13 into 12 phases and 60 focused tasks, with work boundaries, prerequisite gates, phase acceptance, task prompts, and interruption recovery. Missing credentials now block only dependent live checks. Updated the index and repository guidance to use that workflow.
- 21 October 2026: completed the roadmap consistency checks and recorded their observed results above. The requested documentation revision is complete; implementation has not started.
- 21 October 2026: user authorized M00 and added full-document reading, premium minimal UI/UX, and functional backend requirements. Adopted the existing bounded scope, inspected the workspace/runtime, captured a public grid response, rechecked official model catalogs, and recorded external setup timing. Final G00 verification is recorded below.
- 21 October 2026: completed M01.01–M01.05 and G01. Added the pinned application foundation, typed environment boundaries, real checks/CI configuration, responsive shell, and verified local setup/reproduction instructions. No service account, remote repository, deployment, or paid API call was created.
- 21 October 2026: completed M02.01–M02.05 and G02 under U12. Added shared pure contracts, explicit London/UTC time rules, exact integer accounting, deterministic optimization, updated-result projection, labeled versioned fixtures, import/ambient-capability checks, browser parity tests and a reproducible local benchmark. No live grid/service integration, account, key or deployment was added.
- Current stopping point: M02 complete at G02; no M03 work started.
- Next implementation task: M03.01 on next-phase authorization; use the latest handoff at the end of this file.

Future decision entries should include date, change, reason, user authorization when applicable, affected files, and verification evidence.

## 7. M00 execution record — 21 October 2026

### Scope and authorization

The user's instruction to start M00 supplies authorization for this phase's scope review, read-only probes, and readiness/documentation updates. All fourteen numbered documents, the index, root guidance, and status log were read before phase work. The working baseline is Renewable Energy & Energy Trading; one washing cycle; national GB data; Europe/London scheduling; user-confirmed estimated energy; self-reported execution; manual-first planning; Gemini/Groq assistance; optional operator-issued Sepolia receipts. F01–F12 and P01–P12 remain unchanged.

The new frontend quality brief is recorded in document 03. Real service responses, persisted owner records, deterministic arithmetic, and honest unavailable states are required by document 04. The ban on hardcoded outcomes does not prohibit versioned method constants, ordinary UI copy, or labeled isolated test/demo fixtures. No generic template UI, fabricated impact totals, or pretend backend success satisfies these requirements.

No scope question prevents foundation work. Spending limits, account access, privacy contact, and external reviewer feedback remain future dependencies. The draft ₹5,000 ceiling has not been accepted. No purchase or authenticated paid request was made. This turn ends at M00 and does not begin M01.

### Workspace and runtime evidence — M00.02

The [saved workspace inspection](../research/phase-0/2026-10-21-workspace-readiness.json) records presence checks and pre-edit hashes. Observed commands and results:

| Check actually executed | Observed outcome |
|---|---|
| `rg --files` with dependency/secret exclusions; Python filesystem inspection | Existing guidance, fourteen specs, and earlier research; no `package.json`, lockfile, `src/`, `contracts/`, `supabase/`, or `node_modules/` |
| `git --version` | `git version 2.54.0 (Apple Git-157)` |
| `git rev-parse --show-toplevel`; `git status --short` | Both exit 128: directory is not a Git repository; no commit, branch, or tracked diff exists |
| `node --version` | `v24.11.1` |
| `pnpm --version` | `10.34.4` |
| `npm --version` | `11.6.2` |
| `python3 --version` | `Python 3.9.6` |
| Optional tool path checks | Corepack and Docker executables present; Supabase CLI and GitHub CLI absent; Docker daemon/local DB not tested |
| Environment presence-only check; local `.env*` filename check | Listed project variables absent in this process; no local environment file; no secret values read or printed |

Version inspection disabled Corepack network/download behavior. No packages were installed, Git initialized, remote connected, or application files created. These are available tool versions, not a tested compatibility matrix; M01.01 must select/pin compatible releases. Accounts or secrets outside this workspace/session were not inspected and cannot be declared absent.

### External dependency inventory — M00.03

All four gates are `unverified`. Local configuration is absent, but actual account ownership/availability is unknown. Missing gates do not block G00 or local foundation/domain work.

| Gate | Builder supplies securely | Codex prepares/verifies | Needed by |
|---|---|---|---|
| G-DB | S05 isolated development Supabase project/access; S06 email-auth settings; project URL/public key and required server credential | Migrations, SSR auth, ownership/RLS and two-user tests | M04 real database/Auth integration and G04; external email checked again at M11 |
| G-AI | S03 Gemini and S04 Groq keys, account model permissions, chosen usage limits/budget | Provider schemas/adapters, account-visible model checks, bounded smoke requests and held-out evaluation | M06.02/M06.03/M06.05 and G06; prepare during M04–M05 |
| G-CHAIN | S07 dedicated issuer wallet/faucet test ETH; S08 Sepolia RPC; signer entered only in worker secrets | Local contract/worker tests, chain/owner checks, deployment and confirmed evidence | M09.05 and G09; prepare during M07–M08 |
| G-HOST | S09 host account and spending decision; working external email; S10 actual privacy contact | Host configuration, exact redirects, deploy/build checks, worker instructions, fresh-user flow | Contact for M10.04/public invitation; hosting/email for M11.04/G11 |

S01's baseline is recorded above. S02 local workspace access is available; remote GitHub access is unverified and can wait until source publishing/deployment. Document 14 now maps every S01–S10 action to its preparation window and required phase. Keys/recovery material must never be pasted into chat or committed.

### Public-source observations — M00.04

- **Grid:** an unauthenticated Python `urllib.request.urlopen` GET to the documented national `/intensity/{from}/fw48h` endpoint returned HTTP 200. The [grid readiness note](../research/phase-0/2026-10-21-grid-readiness.md), [exact JSON response](../research/phase-0/2026-10-21-grid-response.json), and [metadata](../research/phase-0/2026-10-21-grid-observation.json) preserve the observation. All 97 half-hours were contiguous, 1,800 seconds each, with complete forecast factors; the requested 48-hour span was covered plus an earlier interval. Actual factors were null in 96 rows. Document 07 records the timestamp/coverage consequence. Provider issuance time remains unknown. This does not pass M03/G03.
- **Models:** [provider research](../research/phase-0/2026-10-21-provider-readiness.md) rechecked official Gemini/Groq catalogs and structured-output documentation. Existing exact pins remain catalog-listed; Qwen stays preview/evaluation-only. Current SDK/schema caveats were added to document 09. No authenticated model request, quota check, accuracy, latency, or cost evaluation was performed; G-AI remains unverified.
- **Hackathon timing:** the [official schedule](https://ieee-climatechain-hack.devpost.com/details/dates) still lists 25 October 2026, 17:00 UTC+03 = **19:30 IST** as the closing time. The current [rules](https://ieee-climatechain-hack.devpost.com/rules) no longer display the contradictory October 25 opening sentence recorded in the older research; [updates](https://ieee-climatechain-hack.devpost.com/updates) support the October 5 opening. Historical research is preserved. The full 60–80 focused-hour estimate is not a delivery promise; the remaining calendar window is tight, and actual availability/build progress must guide later estimates without silent scope cuts.

### Task evidence and status

| Task | State | Actual files/outputs | Checks and observed result | Remaining issue |
|---|---|---|---|---|
| M00.01 | passed | This log; AGENTS.md; docs README, 01, 03, 04, 13 | All fourteen specs read; bounded scope and current authorization reconciled; frontend/backend quality requirements recorded | Default choices are a working baseline, not independent approval of every parameter or any spending |
| M00.02 | passed | Workspace-readiness JSON; this log | Actual runtime/CLI/presence checks above; no app/Git repository found; pre-existing file hashes captured | Compatibility and Git initialization belong to M01 |
| M00.03 | passed | Document 14 preparation windows; four-gate inventory here | All S01–S10 actions mapped; local configuration absent; account access explicitly unverified | Builder setup is due at the dependent phases, not before M01 |
| M00.04 | passed | Documents 07/09; grid response/metadata/note; provider note | Live public response schema/coverage checked; official catalogs rechecked; raw bytes retained | No authenticated provider, DB, hosting, or testnet evidence; M03/M06/M09 live gates remain pending |
| M00.05 | passed | This handoff; `research/phase-0/verify-readiness.py` | Offline verifier exited 0: 19 Markdown files, 97 local links, stable 60 tasks, saved grid hash/coverage and research-preservation checks pass | Stop at G00; do not scaffold M01 in this turn |

### Verification and next-session handoff — M00.05

**G00:** passed. Scope is concrete, all five M00 outputs are recorded, the real public-source probe succeeded, and the offline evidence/consistency verifier passed. Pending authenticated service gates do not block local foundation work, as specified by G00.

Executed `python3 research/phase-0/verify-readiness.py`; observed exit 0. It checked 19 Markdown files and 97 local links; 12 phases/60 stable tasks/16 acyclic dependency edges; exact retained grid bytes/hash, 97 contiguous half-hours, requested coverage and 96 preserved null actual factors; runtime/presence evidence; ten focused existing-file changes; all seven earlier research files unchanged; five task records and the M01.01 handoff. The verifier performs no network access and is not a product test suite. Also executed `python3 research/phase-0/verify-readiness.py --require-passed`; observed exit 0, including the recorded G00/five-task completion check.

```text
Task: M00.05 (phase M00 handoff)
Status: passed
Scope/spec version used: roadmap 2.0; PRD 1.1; UI 1.1; architecture 1.1; method carbonshift-gb-uniform-v1; M00 quality updates dated 21 October 2026
Dependencies and external gates: G-DB/G-AI/G-CHAIN/G-HOST unverified; none blocks local M01/M02
Changed files: AGENTS.md; docs/README.md; docs/01-prd-and-blueprint.md; docs/03-ui-ux-and-design-system.md; docs/04-architecture-and-system-design.md; docs/07-api-and-integrations.md; docs/09-ai-agents-models-and-workflow.md; docs/13-development-roadmap-and-codex-tasks.md; docs/14-manual-setup-guide.md; docs/decisions-and-status.md; six readiness artifacts under research/phase-0/
Checks run and observed results: runtime/presence checks and public-source observations above; python3 research/phase-0/verify-readiness.py and its --require-passed run exited 0 with all five readiness groups passing
Manual/live checks and environment: macOS arm64; unauthenticated national grid GET succeeded; public provider catalogs inspected; no model calls, DB tests, or chain transactions
Unresolved failures or decisions: service/account setup and budget pending at their dependent phases; package compatibility not yet resolved; no Git repository or remote; no product tests exist
Next ready task: M01.01
Exact command/action to resume: When starting M01, read AGENTS.md, the index/status and all fourteen numbered documents; inspect current files; execute M01.01 to verify compatible versions, initialize local Git as appropriate, and scaffold the minimal app without overwriting existing docs/research. Do not create a remote, purchase services, or claim unrun checks.
Relevant commit or reviewable diff: no Git repository/commit; compare current files against the pre-edit SHA-256 inventory and inspect the recorded changed files
```

## 8. M01 execution record — 21 October 2026

All fourteen numbered documents and repository guidance were reread. Before scaffolding, `python3 research/phase-0/verify-readiness.py --require-passed` exited 0 and confirmed G00. That historical verifier intentionally requires no app/Git files and must not be used as a current-phase test after M01.

### M01.01 — passed

- Changed files: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `.nvmrc`, `.node-version`, `.gitignore`, `tsconfig.json`, `next-env.d.ts`, `next.config.ts`, `postcss.config.mjs`, initial `src/app/layout.tsx`, `page.tsx`, and `globals.css`.
- Registry metadata and official Next/Hardhat requirements informed selection. Initial ESLint 9 was deprecated; the attempted ESLint 10 aggregate Next preset had incompatible legacy plugin peers. Resolved by retaining ESLint 10 and selecting its supported official Next, TypeScript and Hooks plugins directly. No peer override or suppressed compatibility warning was used.
- Executed `pnpm install --strict-peer-dependencies`, `pnpm install --frozen-lockfile --strict-peer-dependencies`, and `pnpm build`; all final commands exited 0. A separate fresh temporary copy with no `node_modules` also passed the frozen strict install and production build, then was removed.
- Executed `git init -b main`: local repository created; no remote or commit created. Existing docs/research preserved.
- Runtime/package versions are pinned in the manifests; document 05's verified matrix is updated with the phase evidence. No service account, planner, AI request or blockchain deployment was created.
- Next ready task: M01.02 — implement and test web/worker configuration boundaries.

### M01.02 — passed

- Changed files: `src/config/environment.ts`, `src/server/env.ts`, `src/worker/env.ts`, `.env.example`, `.env.worker.example`, `scripts/check-env.ts`, `src/test/unit/environment.test.ts`.
- Executed `pnpm exec vitest run src/test/unit/environment.test.ts`: 25 checks passed, exit 0. Cases cover disabled flags, missing credentials, unsafe production origins, key-role separation, invalid chain/key/block configuration, and redacted errors.
- Executed `pnpm exec tsx scripts/check-env.ts`: exit 0; database unconfigured, AI/ledger disabled. No network/credential validation claim. `node -p process.release.lts` reported Krypton.
- Public foundation can run without secrets. Enabled capabilities require their configuration; worker signer input is rejected by the web parser. Server-only/Node wrappers and the import graph check are verified in M01.03/full build rather than inferred from the parser tests.
- Next ready task: M01.03 — configure/check lint, TypeScript, Vitest, Playwright, and local contract tooling.

### M01.03 — passed

- Changed files: `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `scripts/check-boundaries.ts`, `scripts/lib/import-boundaries.ts`, `src/test/unit/import-boundaries.test.ts`, contract configuration/TypeScript/tooling fixture/test, and package scripts.
- Executed `pnpm lint`: exit 0, no warnings, transitive client boundaries pass. Executed `pnpm test`: initial 31 tests passed. `pnpm contracts:test`: pinned local solc/OpenZeppelin/viem/local-EVM fixture passed, without testnet secrets or remote RPC.
- `pnpm typecheck` initially found an unknown ABI return type; a runtime string assertion fixed the boundary without an unsafe cast. The rerun exited 0. This used the systematic-debugging skill's evidence-first diagnosis.
- Executed `pnpm exec playwright install chromium`: browser installed. The actual `test:e2e` script is exercised with the M01.04 shell suite; no empty passing suite was substituted.
- No product contract, database tests, AI eval, or worker script is implied. Next ready task: M01.04.

### M01.04 — passed

- Changed files: `src/components/layout/app-shell.tsx`, `src/app/layout.tsx`, `page.tsx`, `globals.css`, `error.tsx`, `not-found.tsx`, `api/v1/health/route.ts`; shell/health unit tests and `src/test/e2e/foundation.spec.ts`.
- Executed `pnpm test`: 34 unit/component checks passed. `pnpm lint` and `pnpm build` exited 0. Health is dynamic liveness only; no environment/service details are returned.
- Executed `pnpm test:e2e`: all nine production-browser checks passed at 360/768/1440 px. Core checks include keyboard skip/focus, disclosure, no horizontal overflow, reduced motion, automated WCAG-tagged axe checks, health output, and 404 recovery. Desktop/mobile screenshots were visually inspected; no browser page errors or automated accessibility violations were observed.
- The visible shell states planning is unavailable. No account/planner/demo controls point at unfinished routes; no generated figures imply climate impact. This is a foundation UI, not completed F01/P01 or full product acceptance. Screen-reader and other-browser checks remain later release work.
- Next ready task: M01.05 — final reproducibility, README, CI and handoff.

### M01.05 — passed

- Changed files: root `README.md`, `.github/workflows/ci.yml`, `scripts/verify-clean-install.mjs`, package script registration, current repository guidance/index and affected specifications 01/03/05/12/13/14, plus this status log. The local Git checkpoint includes source, configuration, templates, lockfile, and preserved docs/research; no remote or push is created.
- Executed `pnpm verify:clean`: exit 0. A fresh temporary copy excluded real environment files, dependency/build directories, Git state and project service variables. It passed strict frozen install, web environment validation, lint/import boundaries, one local contract-tool test, both TypeScript projects, all 34 unit/component tests, and production build. The temporary directory was removed afterward.
- Browser evidence from M01.04: `pnpm test:e2e` exited 0 with nine checks passing at three widths; screenshots remain in ignored `test-results/`. No screen-reader, Safari/Firefox, database, model, or testnet result is inferred from those checks.
- Additional observed assertions passed: real `.env.local`/`.env.worker.local` paths ignored while templates are not; the unconfigured worker CLI exits 1 with redacted field guidance; all seven earlier wave research files retain their recorded SHA-256; eighteen current guidance/spec files and 100 local links resolve; direct dependency versions are exact pins.
- Starting the local preview exposed Next's automatic managed AGENTS block. Set the supported `agentRules: false` option; the development server restarted and removed only that managed block. A subsequent HTTP check confirmed home/health return 200 and the repository guidance is preserved. Generated Next declarations are ignored and excluded from clean-copy verification; the scripts regenerate them as on a fresh checkout.
- The CI workflow uses public upstream commit pins resolved from official release/tag metadata and runs only implemented checks. Its component commands were verified locally; a hosted GitHub CI run remains unverified because no remote/push exists. This does not block G01's local reproduction gate.
- Not implemented: product scheduler, real grid adapter, Supabase/Auth/RLS, AI adapters/evaluation, product registry, ledger worker/publication, receipt pages, hosting. F01–F12/T01–T12 full-product acceptance remains pending.

**G01:** passed. The minimal app and applicable checks reproduce without service credentials. Source and documentation agree on implemented behavior, current limitations, and next task. No phase-required live service check is pending; later external gates remain unverified as planned.

### Current handoff

```text
Task: M01.05
Status: passed; G01 passed
Scope/spec version used: roadmap 2.1; PRD/UI 1.2; stack 1.1; tests 1.1; method carbonshift-gb-uniform-v1 unchanged; user authorization U11
Dependencies and external gates: G00/G01 passed; G-DB/G-AI/G-CHAIN/G-HOST unverified; no credentials are needed for M02's pure logic
Changed files: all files in the five M01 task records above; package.json/lockfile and root README describe actual installed behavior
Checks run and observed results: clean frozen install, lint/boundaries, both typechecks, 34 unit/component checks, one local contract tooling check, production build and nine browser checks passed; source-control/research/documentation checks passed
Manual/live checks and environment: macOS arm64; Node 24.11.1 Krypton, pnpm 10.34.4; desktop/mobile screenshots inspected; public metadata reads only; no authenticated service calls
Unresolved failures or decisions: no M01 check failure; hosted CI, other browsers/screen reader and all later live integrations remain unverified; builder budgets/account setup due in later phases
Next ready task: M02.01
Exact command/action to resume: On M02 authorization, read AGENTS.md, index/status and all fourteen numbered documents; inspect the existing app/configuration; implement shared domain schemas in M02.01 using documents 06/08/12, with no UI, network or provider dependencies. Preserve the completed foundation and lockfile. Do not rerun the historical M00 verifier.
Relevant commit or reviewable diff: local initial foundation checkpoint at HEAD; inspect git show --stat HEAD and git status; no remote configured; original research hashes remain unchanged
```

## 9. M02 execution record — 21 October 2026

All fourteen numbered documents and guidance were reread under U12. The working tree was clean at entry; G01 was recorded passed at local checkpoint `8035af3`. No product UI or service adapter is authorized in M02. The existing written specifications and phase plan govern implementation; no scope redesign is needed.

### M02.01 — passed

- Changed files: `src/domain/method.ts`, `errors.ts`, `schemas/primitives.ts`, `schemas/index.ts`, `src/test/fixtures/domain.ts`, `src/test/unit/domain-schemas.test.ts`; package manifest/lockfile, repository guidance and authoritative contract/method clarifications in 06/08.
- Registry metadata selected exact Temporal polyfill `0.5.1` (production) and fast-check `4.10.2` (development); both declare support for the pinned Node runtime. Executed both exact-pin installs successfully with strict peers. No provider SDK, model request, or service account was added.
- Executed `pnpm exec vitest run src/test/unit/domain-schemas.test.ts`: 38 checks passed, exit 0. `pnpm typecheck` exited 0. Cases reject invalid units, canonical dates, unexpected fields, unsafe/nonfinite factors, null misuse, inconsistent candidate amounts, and report/profile omissions.
- Next ready task: M02.02.

### M02.02 — passed

- Changed files: `src/domain/time.ts`, `constraints.ts`, `src/test/unit/domain-time.test.ts`.
- Executed `pnpm exec vitest run src/test/unit/domain-time.test.ts`: 17 checks passed, exit 0. Verified London winter/summer, India-host independence, autumn disambiguation, spring gaps, 50/46-half-hour days, elapsed 48-hour horizon, deadline equality, half-open blocks, midnight, confirmation clock and expiry boundaries.
- No ambient clock, network, database or model dependency is used. Inputs are copied/normalized, not mutated. Next ready task: M02.03 — implement exact integer profile/carbon arithmetic and property checks.

### M02.03 — passed

- Changed files: `src/domain/profile.ts`, `carbon.ts`, `grid.ts`, `src/test/unit/domain-carbon.test.ts`.
- Executed the targeted carbon suite: nine checks passed, including 1,000 energy-conservation, 500 aligned-reference, and 500 independently enumerated overlap-reference property cases with fixed seeds. `pnpm typecheck` exited 0.
- Verified 320,000/120,000 mg example, `[334,334,333]` allocation, 75,000 mg split, round-half-up, null missing coverage, zero baseline, signed negative differences and safe integer guards. BigInt intermediates remain exact even when their numerator exceeds JavaScript's safe-number range. No network is performed.
- Next ready task: M02.04 — deterministic optimizer and updated-result calculator.

### M02.04 — passed

- Changed files: `src/domain/scheduling.ts`, `results.ts`, `src/test/unit/domain-scheduling.test.ts`, `domain-results.test.ts`.
- Executed both targeted suites: 34 checks passed, including 300 generated scenarios compared with an independent brute-force optimizer. The preceding `pnpm typecheck` and `pnpm lint` passed for the implemented modules; final checks follow M02.05 fixture/boundary work.
- Confirmed intermediate-window global minimum, deterministic ties/ranks, baseline-only zero results, invalid baseline rejection, full-window null/edge coverage rejection, freshness and acceptance expiry, immutable/reordered input replay, negative updated totals, pending factors, non-run, blocked/early/late deviations and changed profiles. Report persistence/sequence/authorization remain M07.
- Next ready task: M02.05 — freeze authored versioned fixtures/constants and verify the complete phase.

### M02.05 — passed

- Changed files: named constants/shared schema refinements in `src/domain/`; versioned `src/fixtures/demo/gb-uniform-v1.json`, its frozen TypeScript export, and `accounting-v1.json`; `src/test/unit/domain-fixtures.test.ts`, `domain-boundaries.test.ts`, test-only browser entry and `src/test/e2e/domain.spec.ts`; import-boundary checker; `scripts/benchmark-domain.ts`; affected source tests. Guidance/index/status, root README and documents 01/05/06/08/12/13 were aligned with the implemented contracts and phase stop.
- Executed `pnpm test`: 156 unit/component checks passed (122 domain, 34 existing foundation), with 2,300 fixed-seed property cases inside those checks. Named authored vectors cover the eleven required calculation/result scenarios, including rounding once: 2.5 + 72.5 mg = 75 mg, not 76 mg.
- Executed `pnpm typecheck` and `pnpm lint`: exit 0. Lint inspects the current domain for outside imports and direct ambient clock/network capabilities. Normal domain dependencies are Zod plus Temporal in the time module; no fixture, UI, server, database or provider import exists.
- Two test helpers initially inferred only their default literal/empty-array shapes; TypeScript correctly rejected generated duration/null/block variations. Fixed their boundary inputs to `unknown`, matching the production parsers, without weakening domain types. The first browser attempt exposed Node's required JSON import attribute; added `with { type: "json" }`. Targeted reruns, final typecheck/lint and clean reproduction passed. No unresolved failure remains.
- Executed `pnpm test:e2e -- domain.spec.ts`: this invocation selected the full configured suite; all 15 checks passed (nine shell regressions, six new domain-browser checks across three viewports). Chromium Asia/Kolkata preserved explicit London DST behavior and reproduced the complete server comparison. Browser domain bundles are built in memory; no new app route or fixture-backed live handler exists. Shell production output is unchanged from M01; the final fresh build separately passed below.
- Executed `pnpm exec tsx scripts/benchmark-domain.ts`: macOS arm64, Apple M4, Node 24.11.1; 20 warmups and 200 samples per case. Final-code run: 30-minute/95-candidate comparison p50 1.394 ms, p95 1.831 ms, max 2.858 ms; 180-minute/90-candidate comparison p50 2.163 ms, p95 2.366 ms, max 2.556 ms. Includes schema validation; no network/UI/database. These are local observations, not web-service latency or a general hardware guarantee.
- Executed `pnpm verify:clean`: exit 0. The fresh temporary copy passed strict frozen install, environment validation, lint/client/domain boundaries, one local contract tooling check, both TypeScript projects, all 156 unit/component checks, and production build. The copy excluded real environment files, service variables, dependencies, Git and generated artifacts, and was removed afterward. No authenticated provider, database or testnet check was performed or required for G02.
- Final documentation/source checks: all eighteen guidance/spec files and 100 local links resolve; numbered documents remain exactly 01–14; direct dependencies have exact pins; all seven earlier research hashes match their M00 inventory; `git diff --check` passed. No existing UI/source behavior was replaced or research file modified.
- Inputs and output snapshots/comparisons are copied and frozen; forecast/actual missingness remains null. Snapshot digest references are supplied, not verified by M02. Fixture references explicitly say they are not computed digests/proofs. Canonical hashing/known-method digest vectors remain M08. Report revision persistence/cancellation authorization remain M07, and real grid adapter/freshness caching remain M03.

**G02:** passed. All five M02 tasks have implemented, tested outputs that run without external services. T03/T06 domain and T09 projection subsets pass; manual UI, actual service integrations and complete F01–F12/T01–T12 acceptance remain pending. The public shell continues to say recommendations are unavailable. The next ready task is M03.01; this request stops here.

### Current handoff — M02

```text
Task: M02.05
Status: passed; G02 passed
Scope/spec version used: roadmap 2.2; PRD 1.3; stack/data/method/tests 1.2/1.1/1.1/1.2; method carbonshift-gb-uniform-v1; user authorization U12
Dependencies and external gates: G00/G01/G02 passed; G-DB/G-AI/G-CHAIN/G-HOST unverified. M03 normally needs only public grid access; prepare Supabase S05/S06 before M04 live checks.
Changed files: src/domain modules/schemas, authored src/fixtures/demo assets, domain test suites/browser entry/spec, benchmark and boundary scripts, manifest/lockfile, root README/AGENTS and affected documentation listed above
Checks run and observed results: strict clean frozen install, lint/boundaries, both typechecks, 156 unit/component checks with 2,300 property cases, one local contract tooling check and fresh production build passed; 15 Chromium checks passed; local scheduler benchmark recorded above
Manual/live checks and environment: macOS arm64 Apple M4, Node 24.11.1, pnpm 10.34.4; real Chromium in Asia/Kolkata; package metadata/official library docs only; no live grid/model/DB/testnet call in M02
Unresolved failures or decisions: no M02 check failure. Snapshot hashing, provider provenance, live clock isolation in future request handlers, account ownership/persistence and full product acceptance belong to later phases; existing external setup/feedback gaps remain.
Next ready task: M03.01
Exact command/action to resume: On M03 authorization, read AGENTS.md, index/status and all fourteen numbered documents; inspect src/domain/schemas, grid.ts and scheduling.ts plus document 07's NESO provider contract. Implement the allowlisted server grid adapter in M03.01 with validated UTC URL construction and isolated response tests. Reuse the shared domain snapshot schema; do not clone its types, fetch arbitrary bundle URLs, import demo fixtures as live fallbacks, or rerun the historical M00 verifier. Stop at G03 and record the required real public-feed read separately.
Relevant commit or reviewable diff: focused local M02 checkpoint following 8035af3; inspect git log -1 --oneline, git show --stat HEAD and git status. No remote, push, account or deployment is created.
```

## 10. Source publication checkpoint — 21 October 2026

The user supplied `https://github.com/z-lovejeet/CarbonShift.git` and authorized publishing the completed M00–M02 source before M03. The initial remote lookup returned no refs. `origin` was configured to that exact URL. Git identity resolves from the user's global `.gitconfig`; no local identity override or synthetic author/date is used.

There are 95 tracked files. The user explicitly allowed up to 32 commits after being told that 30 commits with at most three files cannot cover them. Publication organizes the existing snapshot into 32 focused commits, each with 1–3 files. This is a reconstruction of unpublished history, not 32 additional product changes. The original two local checkpoints (`8035af3`, `0a4c2d2`) are preserved through a local recovery ref and their references in earlier phase evidence are historical; the published branch uses the reconstructed commit IDs. No recovery ref is pushed.

Fresh pre-publication checks: `pnpm lint`, `pnpm typecheck`, and `pnpm test` exited 0; all 156 unit/component checks passed. Tracked-file checks found neither real environment file nor a match for the checked Google/Groq/GitHub key/private-key markers. This limited scan is not a comprehensive security audit. No product implementation, account, deployment or M03 task is included in source publication.

Publication procedure: validate that all 95 files appear exactly once across the 32 commit groups; build the history with Git's normal global author/committer configuration; verify its final source tree, per-commit file counts, identity and clean working tree; push `main` with upstream tracking using a normal non-force push; compare local and remote branch IDs. If publishing is interrupted, inspect local `main` and `origin/main` before retrying; never force overwrite remote work. Hosted CI status remains separate evidence and must not be called passing merely because the push succeeds.

Next ready implementation task remains M03.01, requiring separate phase authorization and the reading/entry checks in the M02 handoff. Source publication does not open M03.
