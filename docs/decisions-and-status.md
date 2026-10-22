# CarbonShift — decisions and implementation status

Updated 22 October 2026.

## 1. Confirmed user instructions

| ID | Instruction | Status |
|---|---|---|
| U01 | Build direction is CarbonShift | Confirmed by user |
| U02 | Solo builder, using AI coding agents; latest stated development choice is Codex with GPT-6.1 Sol | Confirmed by user |
| U03 | Product AI uses Gemini API and Groq API with current models | Both providers integrated and evaluated for the current local roles at G06; additional models/roles remain excluded until independently evaluated |
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
| U14 | Complete all of M03 correctly and check existing M00–M02 behavior | Completed M03.01–M03.05 at G03; no account, paid API or M04 work |
| U15 | Commit and push M03, announcing the commit count before pushing | Announced nine new commits, three files each, bringing published history to 41; use existing global Git identity and normal push |
| U16 | Install the Supabase CLI; use Google and GitHub sign-in instead of application email/password authentication | CLI installed and login checked; OAuth-only correction supersedes the earlier email/password baseline. Builder completed provider configuration; enabled flags, client-ID presence and application URLs verified read-only. Affected specifications aligned during M04; builder confirmed both real provider sign-ins and sign-out on 21 October |
| U17 | Create the CarbonShift Supabase project so the builder can configure Google/GitHub in its dashboard | Development project created and independently listed as ACTIVE_HEALTHY on the existing Free organization; this setup request alone did not start M04 |
| U18 | Start and complete all of M04 after reading its required documents; preserve functional backend and UI quality | M04.01–M04.05 and G04 passed; the M04 request stopped before M05. No source publication or paid upgrade requested |
| U19 | Start and complete M05 after analyzing its required documents, with correct functional execution | M05.01–M05.05 and G05 passed locally; stop before M06. Builder explicitly deferred personal usability review. No purchase or Git publication requested |
| U20 | Research the best free Gemini/Groq models while the builder obtains keys; plan fallback, rate limiting and parallel processing only if needed | Public-source research and proposed configuration documented below; no live model call, M06 implementation, purchase or deployment authorized by this research request |
| U21 | Use a 17/day local cap for a reported 20-RPD Flash allowance; builder identifies Gemini 3.5 Flash-Lite with 500 RPD, requests quota-aware selection across available Gemini versions, login/submission throttling and advice on additional agents/features | Both key fields present; corrected the old local Argon pin to 3.8 Flash with AI disabled. Quotas are builder-reported, not authenticated account evidence. Expanded routing, protection and feature design remain pending M06/spec work; no inference call or new feature implemented |
| U22 | Modify the documents for implemented/proposed changes before proceeding to M06 | Pre-M06 specification/roadmap/setup alignment completed below; this request does not start M06, activate AI or authorize purchases/Git publication |
| U23 | Start and complete M06 according to the documents | Completed locally at G06 under the documented manual-first experimental policy; no M07+, paid activation or Git publication |
| U24 | Both model accounts are free; supplied Groq plan screenshots during M06 | Developer table excluded. Free Plan table shows GPT-OSS 120B/20B at 30 RPM / 1,000 RPD / 8,000 TPM / 200,000 TPD. Supplied plan evidence is distinct from observed account headers; Gemini limits and label approval subsequently supplied under U25/U26; exact sharing remains unverified |
| U25 | Supplied Gemini 3.5 Lite at 15 RPM / 250k TPM, 3.8 Flash at 5 RPM / 250k TPM; earlier daily limits remain 500/20 | Conservative shared project budgets plus Flash-only 17/day; 3.6 stays disabled. Builder's suspected discontinuation of 3.6/3.7 is not independent evidence |
| U26 | Explicitly reviewed and approved the expected example labels | Exact hashes and actual approval-recording UTC time in research/phase-6/review-{development,holdout,explanation}.json; no dataset bytes changed by recording approval |
| U28 | Start and complete M07 according to all documents | Completed M07.01–M07.05 locally at G07; all fourteen numbered documents, index and status read first; no M08+, publication or paid activation |
| U29 | Commit the current work professionally, normally 1–3 files per commit; increase group size if necessary to stay within 50, then push after the tree is clean | Current M04–M07 publication batch authorized; 209 changed files require 70 commits at three files each, so 50 focused groups are used with larger related groups as permitted |
| U27 | Reduce unnecessary test repetition; focus on real testing and finish M06 promptly | Reused passing broad regression; completed only remaining reviewed live cases, known-case repeats, explanation checks, targeted changed UI/static checks and one real assisted planning journey |

## 2. Working baseline decisions

The existing D01–D12 defaults are adopted as the working baseline under the user's instruction to start the documented M00 phase. This records implementation intent, not separate approvals of every default, service purchases, or passing product checks. Model access/performance and package compatibility still require the specified later checks.

| ID | Decision | Reason / trade-off | Owner document |
|---|---|---|---|
| D01 | National GB signal and Europe/London scheduling | Accessible feed with comparable national actual series; limited geography | 01, 08 |
| D02 | One washing cycle, assumed uniform energy profile | Bounded build; cannot claim measured appliance energy | 01, 08 |
| D03 | Self-report only; no meter/CSV/device control | Avoid unavailable integrations; execution remains unverified | 01, 06 |
| D04 | Manual-first workflow with two bounded AI roles | Useful during provider outages; evaluate whether AI reduces effort | 09 |
| D05 | Eligible-development interpreter pool: Gemini 3.8 → available/qualified 3.6 → 3.5 Lite; Groq 120B recovery; explanation prefers Groq then Lite | U21/U22 supersede single-primary proposal; skip capped models before dispatch, maximum two attempts; actual account/role qualification pending; public UK profile remains unresolved | 09 |
| D06 | Recent Groq preview candidates evaluated separately | Honors current-model research while exposing preview risk | 09 |
| D07 | Next.js/Supabase modular application | Compact web deployment and relational state | 04, 05 |
| D08 | Optional operator-issued Sepolia commitments | Public history without user wallet friction; operator remains trusted for input claims | 10 |
| D09 | Local single-instance ledger worker for prototype | Protect signer and durable retries; laptop availability limits publication | 04, 14 |
| D10 | Public data only after exact preview/consent | Reproduction discloses timings/assumptions; copies cannot be recalled | 10, 11 |
| D11 | Append-only private reports/results and consented public revisions | Preserves changed assumptions/history; adds implementation work | 06 |
| D12 | Exact package/compiler versions resolved and smoke-tested in M01 | Avoid invented compatibility claims | 05 |
| D13 | M06 implemented: atomic shared user/application/provider/model admission, 17/day Flash cutoff and 425/day Lite ceiling | User quota reports are not account verification; global 200/day still applies; native Postgres supports limits/leases without a new service | 06, 09, 11 |
| D14 | M06 implemented: independent OAuth start/callback and private-mutation ingress controls | Engineering threshold defaults are recorded for testing, preserving PKCE/shared-network recovery and stable save idempotency | 07, 11, 12 |
| D15 | M06 implemented: migrated four legacy model fields to strict server-only AI_POLICY_JSON | One routing authority with code-owned model/provider registry; loader supports evaluated pools; current local roles enabled; unevaluated routes excluded | 05, 09, 14 |

## 3. Open dependencies and evidence gaps

| Item | Next action | Blocks |
|---|---|---|
| Reviewer need / differentiation | Obtain feedback on frozen-baseline and portable-receipt utility; compare prior art | Strong novelty/usefulness claim, not writing a prototype |
| Scope review | M00.01 adopts the bounded baseline under U10; future consequential changes update the owning documents | Resolved for M00; no expansion authorized |
| Model account access | Current Lite/Groq roles have user-reported free quotas, access/schema/quality evidence and a real integrated journey. Flash/3.6/extra roles remain excluded; sharing remains conservatively pooled | Additional candidates and public release; no remaining current G06 live check |
| Budget | U20 requests free model candidates; verify account tiers/quotas and resolve UK release profile; no paid spend authorized | Paid calls and optional paid services |
| Runtime/dependency compatibility | M01 foundation matrix resolved and checked; pin deferred SDKs when their consuming phases begin | Resolved for foundation and M04 DB/Auth; M06 Gemini/Groq SDKs pinned and current routes checked |
| OAuth provider verification | M04 local URLs/configuration, two-user API/RLS isolation and builder-observed Google/GitHub sign-in/sign-out verified | Deployment callbacks must be retested in M11; no public onboarding claim yet |
| Testnet RPC/faucet | Verify chain and fund dedicated issuer | Actual ledger deployment |
| Privacy contact | Builder supplies actual operator contact | Inviting real users |
| Real user/partner evidence | Collect consented feedback if available | Field usefulness/independence claims |
| Public UK AI profile | Select explicitly approved paid Gemini or Groq-only public routing before public activation; no billing approval exists | Public UK Gemini availability/deployment |

No partner, external reviewer, benchmark result, deployed URL, or contract address is invented to close these gaps.

## 4. Work status

Documentation: fourteen numbered specifications and guidance remain the working baseline. M07 lifecycle implementation/evidence and the current handoff are in section 20. M06 role evaluation and its experimental timing policy are preserved in section 19. Historical phase evidence remains separately recorded.

Roadmap version 2 preserves phase IDs with five tasks each. M00–M07 passed locally: forty tasks completed; M06 timing uses the documented experimental quality policy. G-DB is verified for the hosted development project/local application. M06/G06 is complete locally with measured quality limitations and manual-first controls. M08–M11 remain unstarted. G-AI is available for the evaluated local Lite/Groq roles; unverified/unavailable roles are excluded, and no public UK profile is implied. Task evidence below is authoritative; do not duplicate the whole backlog in another tracker.

| Milestone | State | Evidence |
|---|---|---|
| M00 Scope/access | Passed | G00 passed: scope, workspace, dependencies, public-source evidence and offline verification recorded in section 7 |
| M01 Repository/dependencies | Passed | G01 passed: pinned scaffold, web/worker config, 34 unit/component checks, local contract tooling smoke, nine browser checks, and clean reproduction |
| M02 Pure scheduler | Passed | G02: schemas/time/math/optimizer/updated-result projection; 122 domain checks plus 34 foundation checks, 2,300 property cases and six new browser checks; clean reproduction passed |
| M03 Grid integration | Passed | G03: real national forecast/range reads, immutable snapshot identity, bounded cache/transport, 73 adapter/replay checks; complete 229-test/local-contract/build/browser regression passed |
| M04 Auth/data | Passed | G04: two applied migrations, OAuth-only account flow, owner RLS and transactional private APIs; 275 unit/component, 33 SQL and 21 browser checks passed, hosted dev/API check and both provider sign-ins observed |
| M05 Planner UI | Passed locally | G05: manual task/review/real comparison/save/detail/dashboard, immutable recovery and local demo; 305 unit/component, 33 SQL, 33 browser checks and real two-user desktop/mobile journey; builder review deferred |
| M06 Product AI | Passed locally — experimental/manual-first | 60 reviewed timing cases, nine separate repeats, 4/4 explanation cases per provider and real assisted compare/cache/save/reload passed; timing targets missed, so explicit review/experimental labeling remain mandatory |
| M07 Completion/history | Passed locally | G07: 426 unit/component checks, 67 isolated SQL checks, 45 browser checks, real private lifecycle and in-memory historical fixture + live actual factors |
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
- 21 October 2026: completed M03.01–M03.05 and G03 under U14. Implemented and tested real national grid reads, strict validation, immutable snapshot records, bounded cache/coalescing/retry, outage handling and replay evidence. Existing domain/math and frontend behavior were preserved.
- 21 October 2026: completed M04.01–M04.05 and G04 under U18, with OAuth-only scope U16. Applied incremental migrations to the prepared development project, verified private API/RLS/transaction behavior, and recorded both builder-observed provider sign-ins.
- 21 October 2026: implemented all M05 tasks under U19 and verified G05 locally; real browser save/reload/ownership checks passed, with user usability review deferred by the builder.
- 22 October 2026: aligned pre-M06 documents under U22 with quota-aware candidate selection, native shared admission, Auth/submission hardening, two-role workflow, staged evaluation and explicit legacy configuration migration. No M06 runtime implementation started.
- Current phase: M07 complete locally at G07, with M00–M06 preserved and M06 timing still experimental/manual-first. U29 packages M04–M07 into a focused source batch, preserving the prior 41 published commits; see section 21 for publication verification.
- Current next action: wait for explicit M08 authorization. No later phase, paid activation or deployment has begun. U29 separately authorizes source publication; use the M07 handoff and publication record below.

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

### M01 handoff (historical)

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

### M02 handoff (historical)

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

## 11. M03 execution record — 21 October 2026

U14 authorizes the complete phase through G03. All fourteen numbered documents and repository guidance were reread. Entry tree was clean at published `c04891a`; G02 was passed. Current official national API docs confirm the national 48-hour and range endpoints, UTC inputs, no authentication and CC BY 4.0. Provider facts are separate from the actual implementation checks below. Existing research is preserved; the historical M00 verifier is not a current application test.

### M03.01 — passed

- Changed files: `src/server/grid/errors.ts`, `provider.ts`, `transport.ts`, `snapshot.ts`, `client.ts`, `index.ts`; `src/test/fixtures/grid-provider.ts`, `src/test/unit/grid-provider.test.ts`, `grid-client.test.ts`; authorization/guidance and document 07's internal integration contract.
- Implemented national-only URL construction, strict canonical input bounds, minute-to-second normalization, typed forecast/actual reads and server-only product entry. No request accepts a destination URL, no fixture import exists in the adapter, and no account or key is required. Snapshot normalization reuses the M02 schema.
- Executed both targeted suites: 36 checks passed, exit 0; `pnpm typecheck` and `pnpm lint` exited 0. These tests include the M03.02 validation cases below; live evidence remains M03.05.
- Next ready task: M03.02.

### M03.02 — passed

- The same targeted suites verified duplicates, gaps, overlap, invalid lengths/dates/offsets, negative/decimal/unsafe/nonfinite/string factors and incompatible regional responses. Missing forecast ends, null required forecast and empty forecast fail clearly; extra contiguous edges are retained.
- Actual nulls and partial edge coverage remain explicit; an adapter-to-updated-calculator test returned `actual_pending` with all amounts null. Empty actual data returns null rather than an invented zero snapshot. No method formula or existing domain interface was changed.
- Next ready task: M03.03 — timestamped snapshot identity, cache, coalescing and provenance checks.

### M03.03 — passed

- Changed files: `src/server/grid/client.ts`, `snapshot.ts`, `src/test/unit/grid-cache.test.ts`. Implemented per-request five-minute LRU cache with 32 retained records and coalesced in-flight reads. A hit retains the original retrieval time, server UUID, digest and deeply frozen snapshot; actual and forecast keys remain separate.
- Executed `pnpm exec vitest run src/test/unit/grid-cache.test.ts`: eight checks passed. `pnpm typecheck` exited 0. Cases include boundary expiry, simultaneous callers, eviction, failed-flight removal, empty actual data, incomplete forecast rejection, clock rollback, key-order-stable digest and independent copied contents.
- The storage digest is versioned and includes source/time/license plus ordered factors. It is not the public JCS manifest proof and does not establish source truth. Persistent database storage remains M04. Next ready task: M03.04.

### M03.04 — passed

- Changed files: `src/server/grid/transport.ts`, `errors.ts`, `src/test/unit/grid-transport.test.ts`.
- Executed the targeted transport suite: 24 checks passed; `pnpm typecheck` and `pnpm lint` exited 0. Verified eight-second attempt/body timeout even for ignored abort, stream cancellation, at most two network attempts, total deadline, retryable/permanent HTTP handling, bounded Retry-After, malformed JSON/schema/UTF-8, response byte caps and static redacted errors.
- Expired cached data are never served during an outage; concurrent failed callers share the same retry budget; failures do not poison the next flight. No demo fallback exists. Tests use fake transport and timers, not actual outages or paid services. Next ready task: M03.05 — real forecast/range read and frozen replay evidence.

### M03.05 — passed

- Changed files: `scripts/check-grid.ts`, `package.json` (`check:grid` only; no dependency/lockfile change), `src/fixtures/grid/neso-national-recorded-v1.json`, `src/test/unit/grid-replay.test.ts`; final range validation in client/provider and transport cleanup regression; root guidance/README/index, specifications 01/04/05/06/07/12/13/14, and this status log.
- Executed `pnpm check:grid --capture`: exit 0. Actual live run started `2026-10-21T09:05:37Z` and completed `09:05:41Z`. Forecast URL `https://api.carbonintensity.org.uk/intensity/2026-10-21T10:00Z/fw48h` returned 97 normalized contiguous intervals, retrieved at `09:05:39Z`, with complete required coverage `10:00–16:00Z`. Provider issuance is null. Actual URL `https://api.carbonintensity.org.uk/intensity/2026-10-21T05:00Z/2026-10-21T07:00Z` returned five intervals, all with actual factors. Extra provider edge intervals were retained.
- The live forecast reached the unchanged scheduler: illustrative 1000 Wh/60-minute cycle, baseline `10:00Z` at 116,000 mg, selected `12:30Z` at 89,500 mg, difference 26,500 mg. These are forecast estimates under authored energy assumptions, not a user's executed plan or measured avoided emissions. No plan/account/model/testnet write occurred.
- The capture is a sanitized normalized projection, not an exact raw HTTP response. It is explicitly historical/replay-only and cannot be imported by live grid modules. SHA-256 of the frozen file: `17104136e47e5225bfd4d6708b3aef39cc1f8eb0f87c67a7dc0c0386af6b48e7`. The capture includes source, license, retrieval, server IDs, actual snapshot and reproducible comparison. Normal tests use its captured clock; the live command has no fixture/clock override.
- Executed replay/client suites: 13 checks passed. Exact captured snapshot/digest and the complete comparison reproduced through a fake provider transport; a removed required forecast factor failed. Actual-range factors/digest reproduced separately. Normal tests made no live API requests.
- Review found a late-header cleanup race: if a transport resolved only after abort, the body could remain open because the abort listener was installed too late. Added a regression; observed one failure with zero body cancellations, diagnosed the already-aborted signal, then added an immediate cancellation check after headers. The transport rerun passed all 25 cases. This extends M03.04's earlier 24-case evidence; no unresolved failure remains.
- Executed `pnpm build && pnpm test:e2e`: exit 0, production build passed and all 15 existing Chromium checks passed at 360/768/1440 px, including India-timezone domain parity and shell keyboard/automated-accessibility checks. No new screen was added; full future planner/receipt UX, other browsers and screen-reader checks remain later work.
- Executed `pnpm verify:clean`: exit 0. Fresh strict frozen install, environment validation, lint/client/domain boundaries, one local contract tooling test, both TypeScript projects, all 229 unit/component checks and production build passed. This includes the existing 156 foundation/domain cases and 73 grid cases, with the original 2,300 generated property cases preserved. The temporary copy excluded real secrets, Git/dependency/build artifacts and was removed afterward. Public-feed access is not part of ordinary tests/CI.
- Documentation/source assertions passed: eighteen guidance/spec files, 102 local links, numbered documents exactly 01–14 with no 15/16, all seven earlier research hashes unchanged, recorded capture digest unchanged, no fixture imports in server/grid and no whitespace errors. The historical M00 verifier was intentionally not rerun against a scaffolded app. No previous source/test was removed or weakened.

**G03:** passed. All five phase tasks have implemented outputs and required local/live evidence. Current M00–M03 regression checks have no remaining failures. Accounts/Auth/RLS, persisted plans, AI, public proof/contract/ledger and hosting are still outside these completed phases. The visible shell correctly keeps recommendations unavailable until M04/M05 integrate the live journey.

### Current handoff — M03

```text
Task: M03.05
Status: passed; G03 passed; stop here under U14
Scope/spec version used: roadmap 2.3; PRD 1.4; architecture/data 1.2; stack/tests 1.3; API/manual setup 1.1; unchanged carbonshift-gb-uniform-v1 method
Dependencies and external gates: G00–G03 passed; public national grid read observed above; G-DB/G-AI/G-CHAIN/G-HOST remain unverified. S05/S06 isolated Supabase/Auth preparation is required for M04's real integration gate.
Changed files: src/server/grid modules, grid provider fixture helper and five grid test suites, recorded provider fixture, scripts/check-grid.ts, package script and affected root/spec/status files listed above
Checks run and observed results: targeted adapter/cache/failure/replay suites passed; fresh-copy install/lint/typechecks/229 unit-component checks/local contract tooling/build passed; root production build and 15 Chromium checks passed; live forecast and actual reads passed; preserved research/documentation/capture hashes checked
Manual/live checks and environment: macOS arm64, Node 24.11.1, pnpm 10.34.4; real national API URLs/retrieval timestamps and assumptions recorded above; no authenticated model/DB/testnet/hosting check
Unresolved failures or decisions: no M00–M03 check failure. M04 needs isolated DB/Auth access; account/email/provider budgets and later service gates remain unverified. Cache is process-local; database durability is M04. A snapshot hash proves storage-byte integrity, not input truth or physical execution.
Next ready task: M04.01 (local implementation can begin on authorization; live migration/RLS evidence needs G-DB)
Exact command/action to resume: On M04 authorization, read AGENTS.md, index/status and all fourteen numbered documents. Inspect current gridClient entry, shared schemas, environment loader and docs 06/07/11. Check presence of isolated Supabase configuration without printing values. Implement incremental migrations and ownership/immutability constraints in M04.01, with isolated DB tests when available. Never reset a deployed database, trust client owner IDs/totals, use captured grid data as live fallback or bypass an unverified DB gate. Stop at G04.
Relevant commit or reviewable diff: M03 follows c04891a in nine focused commits under U15; inspect git log c04891a..main, git status and origin/main for publication state. The initial 32-commit history is preserved; no M04 work is included.
```

## 12. M03 source publication — 21 October 2026

The user authorized committing and pushing M03, requesting the count be announced before pushing. Announced nine new commits with three files each (27 changed/new files), for 41 total commits on main. Messages describe the adapter, failure handling, replay verification and documentation changes. This extends the published history normally; it does not reconstruct or force-push the earlier commits.

Fresh pre-commit verification: `pnpm lint`, `pnpm typecheck` and `pnpm test` exited 0, with all 229 unit/component checks passing. The M03 execution record retains the separately observed clean-install/build, browser, contract and live-read evidence. Git identity is read from the user's global configuration. Publication checks cover the exact changed-file set, nine commit/file counts, clean working tree and matching local/remote main after a normal push. Phase authorization still stops at G03; M04 is not started.

## 13. Supabase project preparation — 21 October 2026

The builder replaced the planned application email/password flow with Google and GitHub OAuth only, requested CLI installation, completed CLI login, and then authorized creating the development project. Provider application creation and Supabase provider configuration remain the builder's next actions. This is account preparation, not authorization to implement M04 or purchase services.

- Supabase CLI `2.121.0` installed through the official Homebrew tap; the installed version and login help were executed. Authenticated organization/project reads succeeded. The current CLI command is `supabase orgs list`, not `supabase organizations list`.
- A Management API organization read verified organization `Luv` (`qgdwnykmvjnubfawmhlo`) has plan `free`; no existing project was present. Created `CarbonShift` in London (`eu-west-2`) through the Management API with a newly generated database password, without changing the organization plan or selecting paid compute/add-ons.
- Project reference: `vfpcmbmaymzzhkkowhiv`. Dashboard: <https://supabase.com/dashboard/project/vfpcmbmaymzzhkkowhiv>. Project URL: <https://vfpcmbmaymzzhkkowhiv.supabase.co>. Provider callback: `https://vfpcmbmaymzzhkkowhiv.supabase.co/auth/v1/callback`.
- Creation returned `ACTIVE_HEALTHY`. A separate subsequent `supabase projects list --output-format json` succeeded and confirmed the same name/reference/region and `ACTIVE_HEALTHY` state. The CLI listing correctly reports `linked: false`; local initialization/linking has not been performed.
- Generated database credentials and non-secret project identifiers are stored only in ignored `.env.supabase.local`, with owner-only mode `0600`. Verified that the file exists, has those permissions and is ignored by Git, without printing its contents. No credential is recorded in this document; the CLI account credential was used only for authorized Supabase API calls and was not copied into project files.
- Changed tracked file: this status log. No application code, dependency manifest, migrations, access policies, application environment values or provider settings were changed. No application regression suite was rerun for account provisioning; the fresh checks above cover the actual work.

G-DB remains partially prepared: a healthy hosted development project and management access are observed, but database migration access, RLS, application sessions and real OAuth sign-ins remain unverified. G04 has not passed. The builder can now configure Google/GitHub in the dashboard. Use `http://127.0.0.1:3000` for the eventual local application Site URL and `http://127.0.0.1:3000/auth/callback` for its redirect allowlist; these values have not been pushed to Supabase in this setup request.

Before implementing M04, read the index/status and all fourteen documents, then align the authoritative feature/page, architecture, stack/layout, API, security, test, roadmap and manual setup sections with U16. Preserve F02/P02/T02 and the technical callback identity; replace password/confirmation/recovery-specific acceptance checks with Google/GitHub OAuth success, cancellation/error, validated session and sign-out checks. Keep two-user ownership/RLS tests, including two distinct Supabase users rather than assuming two providers imply two users. Reconcile any remaining email-auth references across all specifications; do not implement the superseded password-recovery form.

```text
Task: Pre-M04 Supabase project preparation (U16/U17)
Status: requested project creation verified; M04 not started
Dependencies and external gates: project/management access observed; OAuth providers, migration access and full G-DB remain unverified
Changed files: docs/decisions-and-status.md; ignored .env.supabase.local contains administration credentials
Checks run and observed results: CLI version/help, authenticated org/project reads, explicit Free-plan read, successful project creation, independent ACTIVE_HEALTHY listing, owner-only credential permissions and Git ignore checks
Unresolved failures or decisions: Google/GitHub provider setup and live sign-in are pending; numbered auth specifications must be aligned with U16 before implementation
Next ready task: builder configures Google/GitHub OAuth; M04.01 implementation still awaits phase authorization
Exact action to resume: after provider preparation and M04 authorization, read all phase-entry documents, reconcile U16, securely inspect configuration presence, then start M04.01 against the isolated project without a destructive reset
```

### Provider configuration readiness check — 21 October 2026

The builder reported disabling Email, configuring Google/GitHub and setting the local Site/redirect URLs. A subsequent read-only Management API check independently observed `CarbonShift` as `ACTIVE_HEALTHY`, Email disabled, Google and GitHub enabled, and both provider client IDs present. Verified Site URL `http://127.0.0.1:3000` and redirect allowlist `http://127.0.0.1:3000/auth/callback`. Only allowlisted configuration fields and credential-presence booleans were printed; no provider credential was displayed or changed. Configuration presence does not establish valid provider secrets or a successful browser sign-in.

`pnpm check:env` exited 0 with `Database: unconfigured. AI: disabled. Ledger: disabled.` The ignored administration file is present; the application `.env.local` does not yet exist. Preparing the application keys/HMAC secret, initializing/linking local Supabase configuration, applying migrations, implementing OAuth/session handling and checking RLS are Codex's M04 work, not additional manual account setup requested of the builder. All these checks remain pending; G-DB/G04 are not passed.

No further service account or API key is required from the builder to begin M04 under the revised OAuth-only scope. During M04, actual Google/GitHub browser sign-ins and two distinct test users are needed. The builder should ensure any provider audience restrictions permit the accounts used for testing. M05 follows G03/G04 and requires review/testing of the implemented planning journey, not another external service. Gemini/Groq access remains due for M06, and testnet/hosting setup remains in its later phases. M04/M05 implementation has not been started by this readiness question.

## 14. M04 execution — 21 October 2026

U18: the user authorized all M04 tasks through G04, preserving the OAuth-only correction U16. All fourteen numbered documents and guidance were read at entry. Pre-existing setup/status changes are preserved. The written blueprint and phase plan govern implementation; no M05 planner build, paid service or source publication is authorized. Auth-related specifications were aligned before code changes.

### M04.01 — passed

- Changed files: `supabase/config.toml`, `supabase/.gitignore`, migrations `20261021000100_private_planning.sql` and `20261021000200_acceptance_guards.sql`, `src/server/db/{clients.ts,database.types.ts}`, `scripts/test-integration.mjs`, `vitest.integration.config.ts`, `src/test/integration/private-planning.test.ts`, dependency manifest/lockfile. Created only the six M04 tables; no completion/publication/ledger schema.
- Applied both incremental migrations to the isolated hosted development project `vfpcmbmaymzzhkkowhiv`, with dry-run inspection before each push. Both completed successfully without reset. CLI `2.121.0` initialized/linked local config. Auth dashboard settings were not overwritten. Generated public schema types from the linked migrated schema; SDK consumers typecheck.
- `pnpm test:integration` passed all 33 assertions after both migrations on a freshly created native PostgreSQL 17.10 cluster. Covered FK/uniqueness/hash/required-field/immutability constraints and transaction behavior. A targeted test initially exposed that a privileged direct insert could change accepted payloads; observed failure led to the second migration's exact-payload guard, then the entire 33-case suite passed. Applied migration files are now append-only history.
- Credentials were obtained and written only to ignored owner-readable `.env.local` (mode 0600); no key value was printed. `pnpm check:env` now reports Database configured, AI disabled, Ledger disabled. No purchase/upgrade occurred. Next ready task after this boundary: M04.02.

### M04.02 — passed

- Changed files: `src/server/auth/{policy.ts,session.ts}`, `src/app/auth/{sign-in,callback,sign-out}/route.ts`, `src/proxy.ts`, `src/app/login/page.tsx`, `src/components/auth/provider-sign-in.tsx`, `src/app/globals.css`, `src/components/layout/app-shell.tsx`, `next.config.ts`, auth/session unit suites and `src/test/e2e/accounts.spec.ts`. OAuth-only correction synchronized across root guidance/README and documents 01/02/03/05/07/11/12/13/14.
- Implemented Google/GitHub SSR PKCE, strict provider/origin/body validation, fixed callback destination, validated `getUser()` identity, refresh cookies for protected pages, approved cancellation/error messages and sign-out. No application password/email-OTP route exists. Incoming Next development request logging is disabled to avoid callback-code logging.
- Unit checks cover both providers, unsafe redirects, invalid/duplicate form/code fields, cancellation, exchange failure/replay, expired/missing/forged identity, provider outage and sign-out. Final complete unit suite: 275/275 across 21 files. Browser suite: 21/21 across 360/768/1440 widths, including six account checks. A test locator initially matched both the app alert and Next's route announcer; scoped it to the approved app message and reran the complete suite successfully. No product behavior was weakened.
- **Builder-observed live evidence:** the builder tested `http://127.0.0.1:3000/login`, Google sign-in → “You’re signed in” → sign-out, then repeated with GitHub, and replied **“Both Google and GitHub succeeded.”** This is independent of the seeded administrative test sessions below. Google/GitHub provider flags, client-ID presence and exact local URLs were independently inspected earlier.
- A fresh anonymous configured browser context also verified enabled buttons, Google→GitHub keyboard order, axe with zero violations and 200% zoom without horizontal overflow. Initial standalone axe invocation required an explicit browser context; reran with that documented API usage successfully. A final pending-state probe prevented native navigation only in its fresh test context and verified “Opening Google…”, disabled duplicate actions and restoration on `pageshow`; an initial attempt to hold an active navigation encountered Playwright navigation waiting, so the corrected probe inspected the same component before navigation. This did not call the OAuth endpoint or change account state. Desktop/mobile account screenshots were visually inspected. No authenticated-user screenshot or OAuth code was collected. Screen-reader/production-callback acceptance remains M11. Next ready task after this boundary: M04.03.

### M04.03 — passed

- Changed files: migration policies and restricted functions above, `src/server/auth/session.ts`, `src/server/plans/repository.ts`, SQL integration suite and `src/test/unit/plan-repository.test.ts`.
- Members have only owner SELECT access, with private snapshot access through an owned comparison. Anonymous reads, direct INSERT/UPDATE/DELETE and all privileged mutation functions are denied. Repository owner filters and a user-scoped comparison lookup precede elevated acceptance; database composite FKs/functions enforce ownership again. No client-provided owner ID is accepted.
- Executed the 33-case SQL suite with two distinct isolated users, including direct operations across all M04 tables, private function denial, ownership constraints and response projections. The hosted dev/API check separately observed foreign detail/acceptance 404, foreign list/RLS absence, denied member mutation and denied privileged RPC using legitimate sessions. Existing real OAuth users were not used as fixtures or modified. Next ready task after this boundary: M04.04.

### M04.04 — passed

- Changed files: `src/server/http/{request.ts,errors.ts}`, `src/server/plans/{contracts.ts,handlers.ts,repository.ts,index.ts}`, comparison/plan/list/detail route handlers under `src/app/api/v1/`, API/repository/body unit suites and `scripts/check-accounts.mjs`; exact public DTOs documented in 07.
- Live comparison creation supplies the server clock, real grid adapter and deterministic scheduler; all client fields are strict. Persists exact normalized snapshots and immutable comparison payloads, then atomically accepts by comparison ID/version and retry key. No fake clock/fixture switch exists in the production entry. Missing coverage/errors do not become successful plans. Owner summaries use validated lossless cursor pagination; detail rechecks saved snapshot identity. Null report/result and empty revision fields truthfully represent M04's initial state.
- Locked acceptance checks expiry, start buffer, forecast age and version. Same request/key returns the same plan; changed body/key conflicts; concurrent different keys still resolve to one plan per comparison. Transaction failures roll back plan/idempotency or snapshot/comparison together and cannot return success. Comparison quota uses an HMAC identity and atomic database counter.
- **Fresh hosted integration:** `pnpm check:accounts` exited 0 after migration 002 and typed clients. Real national grid → local HTTP API → hosted Supabase save/read/retry/concurrent acceptance/pagination and foreign-user API/RLS/RPC denials all passed. Evidence reference: ephemeral plan `3290b546-752a-490e-b4f3-ad76c4c3872f`, snapshot `9eaf3a04-8152-48d9-9913-3a00104c4ea2`, digest `0xd2d81cde15327d64954d0a69130f18ee262e643c4739268f56106df728fb1b5f`. Fixture Auth users and their cascaded private plans/comparisons were deleted in cleanup. Immutable orphan snapshots may remain under the retention policy; no fabricated grid data were stored. This plan is not a user's executed cycle or measured climate impact. Next ready task after this boundary: M04.05.

### M04.05 — passed

- Changed files: new auth/API/session/body/repository unit suites, isolated SQL suite/runner/config, account browser suite, server-only test marker and Vitest aliases, Playwright offline environment, `.github/workflows/ci.yml`, clean-copy exclusions and `package.json` commands; root/index/architecture/data/API/stack/security/test/roadmap/manual/status documentation.
- Final verification on macOS arm64, Node 24.11.1, pnpm 10.34.4: `pnpm lint` and `pnpm typecheck` exited 0; `pnpm test` passed **275** checks across **21** files, preserving the existing M00–M03 checks and 2,300 generated property cases. `pnpm test:integration` passed **33** SQL checks. The CI fresh-loopback branch also passed all 33 in a separate disposable fixture; a second run correctly refused the nonempty database without resetting it. Hosted GitHub CI has not been observed for this unpushed diff.
- `APP_ORIGIN=https://carbonshift.local.invalid pnpm build` exited 0 with real local credentials present; the reserved origin was a build-only override satisfying production HTTPS validation, not a deployment/sign-in URL. `pnpm test:e2e` passed **21** Chromium checks across desktop/tablet/mobile against its separately unconfigured production server. Configured local OAuth continues to use `pnpm dev` on port 3000.
- `pnpm verify:clean` exited 0: fresh frozen strict-peer install, unconfigured environment validation, lint/boundaries, local Solidity tooling fixture, both TypeScript projects, all 275 unit/component tests and production build passed. No real environment files, ignored CLI linkage, dependency/build/test artifacts were copied; temporary reproduction files were removed. This does not certify the M08 product contract.
- Public grid/hosted DB calls are confined to the explicit live command. Normal tests/CI require no hosted account, paid API or testnet. The CI PostgreSQL 17 service is digest-pinned; actual GitHub execution remains a publication-stage check. No model SDK/integration, wallet, chain transaction, web deployment, contact/user study or M05 planner was created.
- Final review: 18 guidance/spec files and 103 local links validated; exactly 01–14 numbered docs retained; research/domain/fixture source unchanged; source scan found none of the real DB/HMAC/admin credentials; both credential files remain ignored and mode 0600; `git diff --check` passed. A final `supabase db push --dry-run` returned `upToDate:true`, no pending migrations. Added visible provider progress/duplicate-submit protection and cache-restore reset, then reran lint/types/275 tests, production build, all 21 browser checks and clean-copy reproduction successfully.

**G04:** passed. A real development test member saved and retrieved a plan through the HTTP API; a second distinct member could not access it. Both real OAuth providers were separately confirmed by the builder. No remaining M00–M04 test failure is known from the executed checks. Full product acceptance and production hosting remain later phases.

### Current handoff — M04

```text
Task: M04.05
Status: passed; G04 passed; stop before M05 under U18
Scope/spec version used: roadmap 2.4; PRD 1.5; architecture/data 1.3; stack/tests 1.4; API/manual 1.2; unchanged carbonshift-gb-uniform-v1 method; OAuth-only U16
Dependencies and external gates: G00–G04 passed; G-DB verified for local application + hosted development project. S05/S06 locally complete. G-AI/G-CHAIN/G-HOST remain unverified. No new external key required for M05.
Changed files: incremental Supabase config/migrations; server Auth/DB/HTTP/private-plan modules; OAuth/login/private API routes and proxy; restrained account styles/navigation; dependency pins; isolated unit/SQL/browser/live-check scripts/config; affected root and numbered docs. Inspect git status/diff for the exact set.
Checks run and observed results: lint and both typechecks passed; 275 unit/component checks plus existing property cases passed; 33 isolated SQL checks passed in native and CI-fixture modes; refusal of a nonempty CI database observed; production build and 21 browser checks passed; clean-copy frozen install/static/unit/local-contract/build passed; real hosted grid/API/save/owner isolation/retry/concurrency/pagination/RPC checks passed; configured anonymous accessibility/keyboard/zoom and visual review passed; builder confirmed Google/GitHub sign-in/sign-out.
Manual/live checks and environment: macOS arm64, Node 24.11.1, pnpm 10.34.4, CLI 2.121.0, native PostgreSQL 17.10; dev project vfpcmbmaymzzhkkowhiv (London, existing Free plan); local http://127.0.0.1:3000; .env.local/.env.supabase.local ignored and mode0600. Never print their values or use the earlier chat-shared Mac passcode. Local CLI config must not overwrite hosted OAuth settings.
Unresolved failures or decisions: no known M00–M04 check failure. Manual planner remains unbuilt; login confirms readiness. Full T01–T12/deletion/completion/publication/AI/testnet/hosting and production OAuth callbacks remain their owning phases. Cache is process-local; snapshots may remain orphaned after fixture cleanup until retention maintenance. Hash equality attests storage bytes, not input truth or physical execution. Hosted GitHub CI has not run for this diff. No source commit/push authorized by U18.
Next ready task: M05.01 on user authorization
Exact command/action to resume: On M05 authorization, read AGENTS.md, docs/README.md, this status and all fourteen numbered documents. Inspect document 13 M05, document 03 layouts, current domain/time/profile and private schemas in src/server/plans/contracts.ts. Preserve existing APIs/auth/storage; implement the manual P04 form with London ambiguity handling and exact Wh conversion, then continue M05.02–M05.05 and stop at G05. Keep live fixtures separate and AI/ledger disabled; no further account purchase/key is needed.
Relevant commit or reviewable diff: uncommitted M04 work on main after 298d3a3a79e376f6c9c3b8a6d68f00bd423afbdd; existing 41-commit history and remote are preserved. Use git status/diff before any later publication; do not force-push or reconstruct history.
```

## 15. M05 execution — 21 October 2026

U19 authorizes the complete M05 phase through G05, preserving the completed M04 work and OAuth-only scope. All fourteen numbered documents, index/guidance and complete status log were reread at entry. The approved written blueprint and five-task phase plan govern this architectural implementation; no new approval cycle or scope expansion is needed. The entry diff contains uncommitted M04 work; it is preserved. No M06 AI, M07 completion/cancellation, M09 publication, paid upgrade or Git publication is authorized by this request.

### M05.01 — passed

Work: functional P01 navigation and P03 owner dashboard, preserving the existing restrained design tokens and truthful database/error/empty states. Follow with P04 manual fields/review, comparison/chart/table, immutable save/detail, and the labeled public P12 demo. The chart requires an owner-only read of the comparison's already-persisted snapshot; document 07 will define this additive read without changing the existing comparison POST or refreshing its inputs. Checks will cover domain/form conversion, UI state/failure paths, isolated database regression, offline demo/browser behavior and an explicit real hosted manual planning browser journey.

- Changed files: P01 landing, P03 dashboard, `components/plans/plan-list.tsx`, shared `contracts/planning.ts` (M04 server imports remain a compatibility re-export), `lib/planning-api.ts`, `lib/presentation.ts`, `server/plans/page-context.ts`, navigation/account integration and restrained product styles. Landing links now lead to existing routes; no impact totals or fabricated user rows.
- Checks: the real hosted browser journey observed fresh owner empty states, save → detail → dashboard and cross-user 404 on both desktop/mobile. `plan-list.test.tsx` passed 2 cases: truthful empty state and failed-page recovery preserving/deduplicating earlier plans. Existing auth/shell targeted suites passed 20 cases; production build passed. A formerly broad shell selector matched both the new mobile-menu summary and estimate disclosure; scoped it to the original disclosure, then all 9 shell browser regressions passed. Next task: M05.02.

### M05.02 — passed

- Changed files: `lib/task-input.ts`, `components/planner/{task-form,date-time-field,constraint-review,planner-flow,live-planner}.tsx`, P04 route, shared UI styles. Fields use explicit London date/time/offset choices and exact decimal-text kWh conversion, validated through the existing pure domain rules. The server remains authoritative for time, identity and totals. Constraints are reviewed and confirmed before a comparison; the resulting exact baseline gets a second review before saving. Recoverable errors retain form fields.
- Checks: `task-input.test.ts` passed 12 conversion/precision/DST/block/horizon/baseline cases. Initial 4 flow checks passed for reviewed constraints, provider failure with preserved fields, expiry and same-key uncertain-save retry. Live browser checks independently observed 0.875 kWh → 875 Wh and a blocked initial half-hour shifting the earliest baseline without silently ignoring the block. Both viewport journeys saved successfully. Next task: M05.03.

### M05.03 — passed

Implemented frozen comparison/source rendering, lazy Recharts chart, accessible data table, explicit schedule windows, alternatives and no-improvement state. Added owner-only `GET /comparisons/{id}` to read the same persisted snapshot without a provider refresh; existing POST semantics are unchanged. The real browser flow passed on desktop/mobile, including zero axe violations on comparison pages. Chart review identified numeric auto-ticks at arbitrary minutes; ticks now use actual half-hour data points. Zero-result, keyboard-only and 200% zoom cases have passed in the 33-check production-browser suite across all three viewport projects. A zoom regression first measured 741 px content in a 720 px viewport; DOM bounds isolated the desktop navigation, and wrapping corrected it to 720/720 without hiding content. Source retrieval remains truthful; no new provider issuance timestamp is invented.

- Changed files: `components/planner/{forecast-view,intensity-chart}.tsx`, shared comparison-view contract, owner repository/handler/GET route and related API/repository/view tests. Recharts 3.10.1 plus React-is 19.3.1 pinned from actual compatible metadata; strict install and production build passed.
- Checks: four additional owner-read/API/repository cases passed inside existing suites; real foreign-user comparison read returned 404. Domain numbers/factors, zero-baseline percentage suppression and normal no-improvement rendering are tested. Demo and live comparison screenshots inspected; chart/tables use only the exact stored snapshot. Next task: M05.04.

### M05.04 — passed

- Changed files: live/shared planner controller, P05 saved plan page, page data context, client API helper and flow tests. Save sends only comparison ID/version/key; server rechecks expiry/ownership/freshness. A successful result must equal the reviewed comparison and snapshot before navigation. The same key survives uncertain failure/expiry; a definite expiry/version rejection requires another comparison and acknowledgment. Back/forward review preserves the retry identity. Inputs stay in browser memory, never local storage or model prompts.
- Tests: `planner-flow` passed six cases, including wrong device clock, required review, failed comparison retaining fields, expired proposal, uncertain-save retry after expiry and refusal of a mismatched save response. An adversarial regression first observed one success callback for a different comparison ID; added equality checks, then the full flow suite passed. The monotonic clock initializer initially violated React render-purity lint; moved initialization into its effect, then lint/typechecks and six targeted tests passed. No clock/authorization rule was moved from the server.
- Live protected page/API journeys independently observed exact reviewed-versus-accepted equality, reloadable private detail, owner dashboard linkage and foreign plan page/API 404. Latest completed run: desktop plan `ae7f22f8-597f-4e59-a8c3-85f857f7db20` / comparison `1371970a-d1e3-4617-bcba-536f1f3426b1`; mobile plan `a5894d22-6f05-49e1-aa8d-38d9762abcaf` / comparison `166af25d-5a62-4820-a107-7077b96af32d`; both referenced real snapshot `236c13cc-603e-441a-9028-8a7b1001cb6f`. These ephemeral fixture users/plans/comparisons were cleaned up. Neither is a user’s executed wash or a measured climate benefit. Next task: M05.05.

### M05.05 — passed

- Changed files: P12, dedicated demo controller, existing shared planner/view components, new browser suite, explicit `scripts/check-planner.mjs` and its dev-only identity helper, test registration, docs and README. The demo imports only frozen authored data and its fixed clock; it has no save adapter, never posts model/database requests, and finishes with a local preview. Reset restores the initial fixture.
- Latest completed production suite: 33/33 browser checks across 360/768/1440 widths, including reviewed demo flow, no network mutations, precise invalid-input/impossible-window states, accessible forecast table and alternatives, zero improvement, keyboard-only completion and 200% zoom. Prior 21 M00–M04 browser checks remain covered; the legacy shell disclosure selector was narrowed after the mobile menu added another summary element.
- Builder review: the primary journey was offered at `http://127.0.0.1:3000/app/plan/new`. The builder replied **“I’ll review it later.”** Record personal usability feedback as explicitly deferred; do not invent approval, a user study or screen-reader testing. G05 functional evidence uses two fresh seeded test accounts driving ordinary live pages/API, independently of this deferred review.
- Final verification: `pnpm verify:clean` exited 0 after a fresh strict frozen install, unconfigured environment validation, lint/import/domain boundaries, local Solidity tooling smoke, both TypeScript projects, **305 unit/component tests across 26 files** and production build. The earlier clean-copy attempt correctly stopped on the clock initializer’s render-purity error; the successful rerun used the corrected effect-based initialization. Temporary copies excluded real environment/linkage/build files and were removed.
- `APP_ORIGIN=https://carbonshift.local.invalid pnpm build && pnpm test:e2e` exited 0 on the final functional implementation: all **33 Chromium checks** passed across desktop/tablet/mobile, including keyboard/zoom; the reserved HTTPS origin was build-only, not a deployment URL. Final copy clarified the demo chart as authored factors and shortened the baseline option; affected view/flow tests (8 cases) and typecheck were rerun successfully. The local configured journey continues to use `pnpm dev` on port 3000.
- `pnpm test:integration` passed **33** isolated PostgreSQL checks after the new repository read path, with the existing M04 migrations unchanged. Real hosted manual journeys and comparison/page ownership denials are recorded above; no hosted CI or production deployment pass is inferred. The original 2,300 fixed-seed domain property cases remain included, and the pure domain/frozen research/fixtures were not changed.
- Final documentation/source audit validated 18 guidance/spec files and 103 local links, exactly numbered docs 01–14, no 15/16. Source and built browser bundles contained none of the checked real Supabase secret, database password or HMAC values. Both credential files remain ignored and mode 0600. Live server/planner imports exclude fixtures; `git diff --check` passed. This limited scan is not a security certification.
- Recharts/React-is are the only M05 production dependency additions. No model SDK/call, completion/report/cancel/delete service, public proof, testnet signer/transaction, paid upgrade, web deployment or Git commit/push was created. M06 and later functionality remain unimplemented. The builder’s personal review and manual screen-reader/other-browser/external deployment checks remain unperformed; automated local G05 evidence does not claim user validation.

**G05:** passed locally. Two fresh development test users entered reviewed manual constraints in normal protected pages, received real grid comparisons, saved the exact reviewed inputs and snapshot, reloaded private detail and saw their owner dashboard. The other user’s plan/comparison/page remained inaccessible. This worked with AI and ledger disabled. Scoped accessibility includes zero observed axe violations, keyboard-only completion, responsive layouts and 200% zoom. Personal usability review is explicitly deferred by the builder; it is not fabricated or treated as completed.

### Current handoff — M05

```text
Task: M05.05
Status: passed locally; G05 passed; stop before M06 under U19
Scope/spec version used: roadmap 2.5; PRD 1.6; features 1.2; UI/architecture 1.4; stack/tests 1.5; API/manual 1.3; method 1.2 documentation with unchanged carbonshift-gb-uniform-v1 calculation; OAuth-only U16
Dependencies and external gates: G00–G05 passed locally; G-DB verified with hosted development project and normal local pages/API. G-AI/G-CHAIN/G-HOST remain unverified. S03/S04 model access and chosen usage budget are required before live M06 evaluation; do not infer their presence/absence from disabled AI.
Changed files: P01/P03/P04/P05/P12 and integrated P02/navigation; shared API schemas with M04 server re-export; browser-safe entry/API/presentation helpers; planner/review/chart/table/demo/dashboard components and styles; owner comparison/snapshot repository/handler/read route; exact Recharts/React-is pins; scoped unit/browser/live-check scripts and affected guidance/specs/README. Existing uncommitted M04 work is preserved; inspect git status for the exact combined diff.
Checks run and observed results: clean-copy strict frozen install/env/lint/contract tooling/both typechecks/305 unit-component tests/build passed; 33 isolated SQL checks passed; final functional production build and 33 browser checks passed; final copy's affected 8 tests/typecheck passed; two fresh-user live desktop/mobile (India timezone) grid/save/reload/dashboard journeys and foreign comparison/plan/page 404 passed; demo has no network mutations; snapshots/form/comparison screenshots inspected; documentation/secret/import/whitespace audits passed. Existing domain property cases preserved.
Manual/live checks and environment: macOS arm64, Node24.11.1, pnpm10.34.4; localhost http://127.0.0.1:3000; Supabase vfpcmbmaymzzhkkowhiv on existing Free plan; ordinary SSR/Auth/HTTP paths used with temporary seeded test sessions, not provider impersonation. All created fixture users were removed; real OAuth users untouched. Both provider sign-ins retain their separately builder-observed M04 evidence. Builder chose “I’ll review it later” for M05 usability. No manual screen-reader, public callback or hosted release test performed.
Unresolved failures or decisions: no known M00–M05 check failure after the recorded fixes. Builder usability feedback deferred. UI timer is advisory/server-referenced and may lag by network delay; API/database recheck server time. Source remains a forecast estimate under assumed energy, never measured avoided emissions or appliance operation. Completion/cancellation/private deletion, evaluated AI, proofs/ledger/hosting and full F01–F12 acceptance remain later phases. Hosted CI has not run for this unpushed diff.
Next ready task: M06.01 on user authorization
Exact command/action to resume: On M06 authorization, read AGENTS.md, docs/README.md, this complete status and all fourteen numbered documents. Follow revised roadmap M06.01a–d: schemas/prompts, strict registry/AI_POLICY_JSON migration, shared admission/task-key/lease substrate, separated reviewed fixtures. Inspect current code/environment without printing values; preserve Supabase credentials, manual input, explicit confirmation, deterministic math, API envelopes and immutable save recovery. Use docs06/07/09/11/12/14 and the latest pre-M06 handoff below; current four model fields do not implement the pool. Verify actual free access/limits and SDKs before any smoke; stage 17/day Flash evaluation honestly with G06 pending until required evidence exists. Never silently enable billing; resolve the UK-facing profile before public activation. Do not add autonomous tools/extra agents, infer energy, move clocks/totals into AI, enable ledger or implement M07+. Stop at G06.
Relevant commit or reviewable diff: uncommitted M04/M05 work on main after 298d3a3a79e376f6c9c3b8a6d68f00bd423afbdd; prior 41 published commits unchanged. No Git publication authorized by U19; inspect working tree before later commits and never reconstruct/force-push existing history.

```

## 16. Free-model research — 21 October 2026

Under U20, used the research skill with a background Groq source audit and a primary-agent Gemini/source/integration review. Sources were official model catalogs, pricing, schema, quota, terms and data-control pages; full citations and recommendations are in [the research note](../research/ai/2026-10-21-free-model-selection.md). This is research/setup preparation, not the start or completion of M06.

- Findings: Gemini 3.8 Flash has a published standard API free tier; Gemini 4 Argon does not. Groq GPT-OSS 120B/20B are production strict-schema free-plan candidates. Gemini Flash-Lite/20B remain separately evaluated efficiency options rather than additional live attempts. Current Groq Llama 3.3/3.1 entries are Enterprise/contact-sales, so do not recommend them from historical free lists.
- Consequential constraint: Google's current terms require Paid Services for API clients available to UK/EEA/Swiss users. CarbonShift targets GB adults. Free Gemini can be evaluated in eligible local development with authored non-personal inputs, but a UK public release needs explicitly approved paid access or an explicitly resolved public routing/scope change. No billing was enabled, no provider requirement was silently removed, and neither location nor eligibility is inferred from the scheduling timezone.
- Proposed M06 controls: preserve two provider attempts/task and absolute deadlines; atomic shared Postgres user/application quotas, provider/model request and token reservations, honest cooldown/reset/circuit-breaker states, bounded leases and inspected SDK retry behavior. Preserve 5 tasks/minute and 20/day/user plus 200 outgoing calls/day/application. Interpret/review/calculate/explain remain sequential dependencies; parallelism is limited to independent admitted users or measured evaluation capacity. These are still unimplemented.
- Changed files for U20: new research note; docs09 owning model/workflow specification; docs14 setup guide; `.env.example` proposed eligible-development pin/comments; existing environment test's authored model fixture; this status log. Active `.env.local`, provider accounts, runtime implementation and existing research were not modified. All prior uncommitted M04/M05 work remains preserved.
- Executed checks: `pnpm exec vitest run src/test/unit/environment.test.ts` passed **25/25**; read-only Python checked three updated Markdown documents, all four relative links, balanced fences, free-development template fields, disabled AI default and absence of a worker signing key field in the web template; `git diff --check` passed. These checks do not establish authenticated access, successful fallback, quota enforcement, model latency/accuracy or a completed G-AI/G06. No full application regression was rerun for this documentation/example-only change.

Next ready implementation task remains M06.01 on user authorization, using the exact resume action above. Keys are being obtained by the builder; actual provider access/quotas remain unverified. No Git commit/push, paid request, purchase or public deployment occurred.

## 17. Quota and workflow discussion — 22 October 2026

- U21 supplies the builder's reported 20-RPD Flash allowance, requested 17/day application cutoff, and Gemini 3.5 Flash-Lite identity with a reported 500 RPD. These are not independently read account limits. Current official Gemini documentation directs users to active project/model limits and identifies Pacific-midnight daily resets. The requested candidate preference is 3.8 Flash, then 3.7 if available, 3.6 if available, then 3.5 Flash-Lite. The checked catalog lists 3.8/3.6/3.5-Lite but has no 3.7 entry. Only accessible, compatible, evaluated candidates can be enabled. [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [catalog](https://ai.google.dev/gemini-api/docs/models).
- Distinguish pre-dispatch model eligibility selection from failure retries. Skipping a locally exhausted/disabled candidate consumes no inference call; an actual attempted fallback does. The existing two-attempt/task deadline bound remains the working baseline. A multi-candidate registry, shared project/model budgets and provider-specific cooldowns need owning specification/configuration/tests updated during M06; simply adding model environment fields would not implement the router. A 425/day Lite safety cap is a proposed 15% headroom example, not an approved/account-tested limit; the current 200-call application-wide daily ceiling still applies.
- Read-only code review observed a client login submission guard, same-origin/body/provider restrictions, and 10 comparisons/minute/user in Postgres. There is no CarbonShift-specific server login-start limiter in the inspected route. Supabase's upstream Auth controls do not establish that this local route is throttled. Broader login/submission safeguards require explicit implementation and concurrent/retry/shared-network checks; no such protection was fabricated. [Supabase Auth limits](https://supabase.com/docs/guides/auth/rate-limits).
- The builder asked whether more agents/content/features would improve the project. This remains a design discussion, not adoption of new autonomous roles, pages or scope. Recommend distinct useful AI roles, deterministic validation/calculation/proof services, explicit human confirmation, failure observability and completion of already-planned receipt/history features before adding extra model calls merely to increase agent count.
- Local setup change: securely inspected only key presence and recognized model IDs; both Gemini/Groq fields are populated, without proving validity/access. Corrected exactly `AI_CONSTRAINT_PRIMARY_MODEL` from `gemini-4-argon` to `gemini-3.8-flash` in ignored `.env.local`; retained its other content, credentials, owner-only mode and disabled AI flag. No key value was printed, transmitted or copied into tracked files. Active multi-model routing remains unimplemented.
- Verification: `pnpm check:env` reported valid web configuration, database configured, AI/ledger disabled. Existing environment unit suite passed **25/25**. Reproduced an earlier documentation-formatting mistake: section 16 had been appended inside the M05 handoff code fence. Moved the existing closing fence before that section and checked it is now normal Markdown; handoff and research content preserved. No app runtime code, dependencies, provider account, live evaluation, migration, commit or deployment changed in this discussion.

M06/G-AI remain unverified and unstarted as implementation gates. Next phase still requires the documented full reading and explicit phase authorization; the builder's provided keys do not imply paid-spend approval or model quality.

## 18. Pre-M06 documentation alignment — 22 October 2026

U22 authorizes updating the existing owning documents for the previous changes/proposals before implementation. The revision adopts the quota-aware pool as the target, retains two AI roles and manual-first boundaries, and marks engineering defaults/deferred release decisions explicitly. It does not claim the additional controls already work or independently approve all proposed numbers.

- Updated numbered documents: 01/02 scope and feature/page behavior; 03 assistance/retry UX; 04 service/admission boundaries; 05 target modules and configuration; 06 operational records/retention; 07 AI task keys/explanation/cache/error contracts; 09 candidate/policy/routing; 11 login/submission/quota controls; 12 tests/staged evaluation; 13 sequential M06 tasks/substeps; 14 actual manual readiness. Math and public-proof methods in 08/10 did not require a change.
- Updated guidance: index, root AGENTS and this log; clarified the current `.env.example` comments; marked the earlier research recommendation as superseded by owning specs. No implementation file, active environment value, SDK, migration or account was changed by U22. Existing uncommitted M04/M05 work and prior research remain preserved.
- Working target: interpreter 3.8 → qualified/available 3.6 → 3.5-Lite eligibility, Groq recovery, no invented 3.7 entry; explanations prefer Groq then qualified Lite. Skip locally capped entries without dispatch, with at most two actual calls/task. Flash's requested local ceiling is 17/day against a reported 20; proposed Lite ceiling 425/day against reported 500; global 200/day remains. Actual access, minute/token/shared-bucket evidence and model qualification remain pending.
- Added target controls: atomic shared admission/task keys/token reservations/concurrency/circuits; separate OAuth start/callback and private-mutation ingress policies; retained PKCE, ownership and stable uncertain-save recovery; no new product page or autonomous agent role. Extra receipt/chat agents remain deferred. Public UK paid-Gemini versus Groq-only release selection is explicitly unresolved, with no billing authorization.
- M06.01 now builds its shared admission substrate before M06.02/03 smoke calls. The operator evaluation runner can test unpromoted candidates while web AI stays off, under finite run/global/provider budgets. At 17/day, a 60-case Flash sweep needs at least four quota days; do not mark G06 complete or enable untested candidates to avoid this delay.
- Verification: read-only checks passed across 17 canonical guidance/specification files plus the research supersession note: 102 local links resolve, 56 Markdown tables have consistent columns, fences/titles pass, 12 phases/60 unique primary tasks and F/P/T01–12 remain intact. Cross-document quota/profile/migration assertions passed; no configured key/HMAC appeared in checked documents/template and the active environment remained owner-only with AI disabled. `pnpm check:env`, all 25 existing environment unit tests and `git diff --check` passed. The first literal policy assertion expected “at most two”; made the owning policy state that bound explicitly, then reran the complete checks successfully. These are documentation/legacy-configuration checks, not working AI/quota/login hardening or G06 evidence. No full app regression was needed/run for this documentation/comment-only revision.

### Current handoff — pre-M06 documentation

```text
Task ID: U22 documentation revision, not M06 implementation
Status: documentation revision complete; implementation remains stopped after G05
Dependencies and external gates: G00–G05 remain passed under their recorded scope. G-DB verified for local/development use; G-AI/G-CHAIN/G-HOST unverified. Both AI key fields are populated; actual free quota/model/evaluation evidence remains missing. No paid-spend approval.
Changed files: docs01–07/09/11–14, docs/README.md, docs/decisions-and-status.md, AGENTS.md, .env.example comments and the research/ai supersession note. Existing app/runtime changes are from earlier work.
Tests/checks run: PASS 17 canonical files plus one research note; 102 local links; 56 tables/fences/titles; 12 phases/60 primary task IDs/F-P-T01–12; policy/migration/secret assertions; pnpm check:env; 25/25 existing environment unit tests; git diff --check. No new runtime control or live inference was tested.
Manual/live checks and environment: public official catalogs/limits/terms rechecked; no authenticated inference, provider settings change, migration, deployment or user study. Active AI and ledger remain disabled.
Unresolved failures or decisions: account quota/access, human example labels and role-quality results; public UK AI profile; builder M05 review remains deferred. Configuration still uses the legacy loader until M06 migration.
Next ready task: M06.01a after user authorizes M06; M06.01 remains the stable parent task
Exact command/action to resume: Read root guidance/index/full status/all fourteen docs. Begin schemas/prompts, then the strict policy/registry and shared admission substrate in revised roadmap order; migrate parser/template/local model fields together while preserving keys and disabled manual startup. Verify actual free limits before any bounded smoke/evaluation. Stop at G06; no M07+ or paid activation implied.
Relevant commit or reviewable diff: uncommitted work after 298d3a3a79e376f6c9c3b8a6d68f00bd423afbdd; preserve the existing 41 published commits. No commit/push requested by U22.
```


## 19. M06 execution — 22 October 2026

U23 authorizes M06 only, through G06. The index, complete status, all fourteen numbered specifications, root guidance and existing implementation were read before phase work. Existing M04/M05 changes and published history are preserved. The approved design governs two bounded AI roles; no autonomous agent, new product page, paid activation, ledger work or Git publication is included.

### M06.01 — passed locally; reviewed fixtures ready

- Changed files: `src/config/ai-{registry,policy}.ts`, `environment.ts`, `src/contracts/ai.ts`, `server/ai/{prompts,validation,identity,store}.ts`, `server/limits/{budgets,identity,store}.ts`, three new operational migrations 003–005, generated DB types, 20 development / 40 held-out / four explanation fixtures, policy/evaluation tools and isolated unit/SQL tests.
- Strict allowlisted policy replaces the four legacy model fields in templates and ignored local configuration; disabled startup is preserved. Provider URLs are code-owned. Known model/version IDs do not establish account access. Each role filters unqualified candidates before dispatch.
- Durable HMAC task identity, immutable policy binding, atomic all-bucket admission, conservative token reservations, bounded application/user leases, circuit state, metadata-only runs and owner-only explanation code cache are implemented. Same-key changed comparison identity is rejected even on cache hits; cache hits make no provider call or AI quota charge. No raw timing text/model interpretation is stored.
- Retention: task keys/input fingerprints clear after 24 hours, metadata after seven days, cache at most 24 hours. Unexpired usage survives lease expiry and retention cleanup. Admission prunes opportunistically; explicit operator maintenance remains necessary while idle. No scheduler is configured.
- Hosted development migrations 003/004/005 were each dry-run reviewed and applied incrementally; types regenerated after 005. No hosted reset or OAuth configuration push. Disposable native PostgreSQL tests passed **55** cases, including concurrency, all-or-none reservations, shared limits, earliest sufficient reset, two-call/lease/circuit bounds, RLS denial, retention and cache command identity.
- Builder approval U26 is bound to exact fixture hashes by three review receipts. Fixture `humanReviewed:false` is the immutable authored-file state; external receipts are the current approval authority. No human review was invented or inferred from model answers. Holdout labels remain unchanged.

### M06.02 — Gemini adapter implemented; live checks/evaluation in progress

- Changed files: pinned `@google/genai` 2.30.0 SDK, bounded official Interactions adapter (`store:false`, JSON schema, no tools/stream, zero SDK retries), one-fetch guard, static error mapping, request abort/size limits, provider tests and explicit access/smoke scripts.
- Authenticated catalog GET listed 3.8 Flash, 3.6 Flash and 3.5 Lite. One initial 3.8 smoke failed transiently; no retry was hidden. Two Lite constraint smokes returned structured fields but invalid source offsets and were rejected. Diagnosis used boolean checks/status only, never raw outputs. V3 supplies a server-derived UTF-16 bound and permits full-text support when narrow offsets are uncertain; a subsequent Lite smoke passed with 279 input / 275 output / 554 total tokens. Dataset labels were not edited.
- U25 supplies model RPM/TPM; earlier daily limits remain. Policy uses a common conservative 4 RPM / 212,500 TPM / 425 per Pacific day plus Flash-only 17/day. Exact account sharing remains unverified. 3.6 stays disabled; 3.7 is unlisted/unconfigured. No provider discontinuation claim is made from speculation.
- Per-model reviewed evaluation is in progress; access/schema smoke is not quality qualification. No Gemini role is promoted yet.

### M06.03 — Groq adapter/access smoke passed; role evaluation pending

- Changed files: pinned `groq-sdk` 1.6.0, strict JSON-schema Chat Completions adapter, no tools/stream, zero retries/one-fetch bounds, quota observations and tests.
- Three admitted Groq 120B smokes passed: explanation-v1 (818 total tokens), constraints-v1 (2,796), constraints-v2 (3,024). Live headers confirm 1,000 RPD and 8,000 TPM. Free Plan screenshot supplies 30 RPM / 200,000 TPD; this differs from independently verified account overrides. All Groq roles/models conservatively share organization buckets: app 24 RPM / 850 rolling-day requests / 8,000 TPM / 170,000 rolling-day tokens. The TPM cap equals the provider allowance because the intentionally conservative request reservation did not fit a 6,800-token cap; no actual limit was raised. Billed cost is unknown, not zero.
- Actual report files retain timestamps/model/prompt/latency/usage/allowlisted headers; no raw response body or credentials. Current v3 interpreter evaluation remains required; no quality qualification is inferred from earlier prompt smokes.

### M06.04 — implemented and verified locally; live integrated AI acceptance pending

- Changed files: `server/ai/{router,handlers,index}.ts`, two private AI routes, `server/limits/ingress.ts`, existing OAuth start/callback and comparison/save handlers, client AI API/draft helpers, TimingAssistant/ExplanationPanel/SavedExplanation and existing planner/detail wiring, styles and related tests.
- Router freezes policy/task identity, reserves before dispatch, skips caps without a call, bounds primary/whole-task time and at most two attempts, prefers independent provider recovery after Gemini failure, preserves known/unknown usage and rejects configuration/refusal/abandoned-work retry paths. Shared circuits/half-open probes are durable. Provider Retry-After, exhausted Groq reset durations and bounded Google RetryInfo are honored without persisting error messages.
- OAuth start/callback controls use separate signed browser HMAC budgets and optional explicitly trusted proxy IP metadata; arbitrary forwarded headers are ignored. Generic 429 restart preserves safe PKCE recovery. Private ingress precedes expensive work; stable immutable plan-save idempotency is unchanged. User 5/minute and 20/day plus application 200 provider attempts/day are independent limits. Sign-out and reads remain available.
- Assistance is opt-in, source-backed, explicitly checked/applied, editable and reviewed again before deterministic comparison/save; energy is unchanged. Missing/ambiguous fields require manual attention. Explanation cannot invent arithmetic or claims; validated eligible codes choose deterministic text and templates remain usable on failure. Pending/limited states show truthful retry countdowns without automatic retries.
- Browser suite passed **45** Chromium checks at 360/768/1440 widths, including 12 new real-component AI harness checks: source/consent/apply/edit, unsupported/manual/error/limited/pending states, axe zero violations, 200% zoom and no unwanted network calls. Authored harness inputs are separate from live provider evidence and add no product route. Desktop/mobile AI screenshots were visually inspected: readable stacked mobile fields, no overflow and preserved restrained typography/spacing. The full browser pass preceded the cache identity fix; its targeted unit/SQL regressions passed subsequently.

### M06.05 — local regression verified; reviewed live quality evaluation in progress

- Latest full clean-copy reproduction passed frozen strict-peer install, disabled/unconfigured startup, lint/import boundaries, local Solidity tooling fixture, both TypeScript projects, **394** unit/component tests and production build. Later provider reset tests passed targeted **34** cases with lint/typecheck. Final integration counts will be recorded after those changes; neither command calls real AI in ordinary tests.
- Real hosted M00–M05 regression after rate controls passed `pnpm check:planner` (desktop/mobile manual form/review → real grid comparison → save/reload/dashboard; foreign-owner 404) and `pnpm check:accounts` (RLS/immutable retry/concurrency/pagination/ownership). Temporary fixture users were deleted. Planner desktop plan `4a6a3a45-45fc-47d1-926e-cd807fa92c6f`, mobile `737a75d7-a036-4c87-b7bf-53f0a1a68715`; API plan `d8af978b-78c1-4db4-8727-e1971bd11084`; shared live snapshot `4c8cd312-b538-436b-9502-06c676b688fd`. These are test-created development records, not executed appliance cycles or measured climate benefit.
- Evaluation commands require an exact-hash human receipt, verified free policy, explicit live flag and finite maximum. Sequential pacing is optional and bounded to 60 seconds between cases; any quota/error stops the run. Inclusive `--start-at` supports deliberate continuation without rerunning earlier cases. Results persist after every case, without raw interpretations. No automatic daily continuation or promotion exists.
- Manual corrections are an automated count of mismatched expected fields, not measured human work. Explanation baseline benefit, user usability, screen-reader/other browser and public deployment evidence remain unmeasured. Builder's M05 review is still deferred. Hosted GitHub CI has not run for this unpushed diff.

**G06 remains in progress.** Normal web AI stays disabled with empty qualified roles until reviewed per-model evidence and integrated live acceptance are assessed. Pending live quality cannot be replaced with local tests, catalog listings or access smokes. M07–M11 remain unauthorized/unstarted under this request.


### M06 checkpoint after builder feedback on test volume

The builder questioned repeated testing. Reduce future verification to changed behavior and the remaining required live qualification; reuse fresh passing broader evidence rather than repeat full suites without a new concern. No new provider request or broad test run was started in response to that question.

- Latest completed regression: **395** unit/component, **55** isolated SQL and **45** Chromium browser tests passed; lint/boundaries, both typechecks, configured disabled-AI environment and production build passed. Clean-copy reproduction passed at the earlier 394-test checkpoint, before the added provider-reset case. It must not be described as a 395-test clean-copy run.
- Lite constraints-v3 development evidence: first run covered dev-01–14, with dev-14 rejected as invalid; a separately reported dev-14 repeat passed. Continuation covered dev-15 (passed) and dev-16 (schema rejection), then stopped. Keep all initial failures and repeat counts. Neither the 20-case development suite nor 40-case holdout is complete; no holdout inference has started. No model is quality-qualified.
- The already in-flight second Flash smoke finished with HTTP **503**, a recorded transient failure and no hidden retry. Both Flash smokes consumed the same durable daily allowance; do not claim inference availability or provider discontinuation. 3.6 remains unverified/disabled.
- Added `scripts/check-ai-flow.mjs` and `pnpm check:ai-flow` for the eventual explicit live browser/API journey, guarded by already qualified enabled routes. This new check has not run; its code passed lint/typecheck only. Do not count it as live AI acceptance.
- No evaluation process is left running at this checkpoint. Normal local development server remains available. AI and ledger are still disabled; real manual planning remains usable. M06/G06 remain in progress. No M07 or source publication has begun.

```text
Task: M06.05, with remaining M06.02/M06.03 role qualification
Status: in_progress; G06 pending
Scope/spec version used: roadmap 2.7; AI 1.4; manual setup 1.7; constraints-v3/explanation-v1; schema 1; unchanged deterministic method
Dependencies and external gates: builder free quotas and exact-label approval recorded; Groq/Lite access smoke passed; Flash returned 503; 3.6 unverified. Quality and integrated live acceptance pending.
Changed files: server-only AI config/contracts/adapters/router/validation/storage; shared SQL admission/leases/retention/cache identity migrations 003–005; Auth/mutation controls; optional reviewed UI; evaluation/smoke/maintenance/live-flow tools; fixtures/tests; owning documentation. Preserve earlier M04/M05 changes.
Checks run and observed results: latest lint/types, 395 unit/component, 55 isolated SQL, production build and 45 browser checks passed; clean copy passed with 394 tests before the last targeted addition. Real manual hosted planner/account regression passed. Real model partial outcomes are recorded separately and include failures.
Manual/live checks and environment: macOS arm64; Node24.11.1/pnpm10.34.4; hosted Free development project; loopback dev server; no paid upgrade; all secrets ignored and mode0600; fixture OAuth users cleaned up after prior live regression.
Unresolved failures or decisions: Lite dev-16 schema rejection; prior dev-14 invalid result passed only on a separate repeat; Flash HTTP503. Do not hide these failures or promote a role from smoke evidence. Other candidates remain unqualified. Builder M05 usability review deferred; no field-user benefit or billed-cost claim.
Next ready task: focused M06.05 quality diagnosis/qualification, preserving the frozen holdout and current passing regression evidence
Exact command/action to resume: Inspect the latest research/phase-6/results reports and current policy without exposing secrets. Diagnose the dev-16 schema rejection with bounded validation metadata before a targeted fix; do not rerun broad suites unnecessarily. Continue the reviewed development evaluation deliberately with finite budgets and recorded repeats, then run the untouched holdout for only candidates intended for promotion. Honor the 17/day Flash ceiling and stop on errors/quotas; no automatic quota-day continuation. After actual qualification, run the guarded live AI flow and update this handoff. Stop at G06; do not begin M07 without authorization.
Relevant commit or reviewable diff: preserved uncommitted M04–M06 work on main after 298d3a3a79e376f6c9c3b8a6d68f00bd423afbdd; 41 published commits unchanged; no commit/push requested
```


### M06 resumed under renewed completion instruction

The builder explicitly asked to finish M06 after questioning unnecessary repeated testing. Preserve fresh 395-unit / 55-SQL / 45-browser regression evidence; only changed behavior and outstanding live qualification are rechecked.

- A targeted dev-16 repeat passed; the original schema rejection is preserved. The first 20 distinct Lite development cases now have evidence, including two first-attempt rejections and separately recorded successful repeats. Do not replace initial outcomes with repeat successes.
- Flash remains disabled after two access failures (second HTTP503), 3.6 stays disabled with unknown limits, and no new models are added. With Lite as the sole active Gemini candidate, its shared RPM cap is explicitly changed from the mixed-pool 4 to 12 of the builder-confirmed 15. The same 212,500 TPM, 425 Pacific-day and 200 global-day limits remain. Reintroducing Flash requires conservative compatible shared RPM plus successful role evidence; the 17/day Flash ceiling is preserved.
- The existing interpreter is frozen at constraints-v3 before the 40-case holdout. No gold label, expected answer or prompt is changed on holdout results. Optional AI is visibly experimental, while manual input remains the default and all suggested fields require explicit review/application.
- Complete qualification only for routes intended for this development release. An unavailable model or unevaluated role remains excluded with an explicit disposition; it does not receive quality status from another role's smoke/evaluation. No daily quota-day sweep or extra model comparison is needed merely to keep an excluded candidate in the allowlist.


### M06 live qualification completed; final assisted journey in progress

- All **20 development + 40 held-out** Lite constraints-v3 cases now have actual live first-attempt evidence. Labels/prompt were unchanged on holdout results. First-attempt accuracy is **724/767 fields (94.3937%)**, **51/60 critical examples (85%)**, ambiguity recall **93.6%**, false-ambiguity rate **1.7544%**, two schema/semantic rejections, task p50 **4,456 ms** / p95 **4,954 ms**. The 40-case holdout was resumed at hold-28 after interruption; no missing case was invented.
- The two rejected development cases and seven critical holdout misses were each repeated once, reported separately. Original failures remain in first-attempt metrics; repeat successes do not replace them. No human post-review accuracy, usability benefit or billed amount is claimed.
- Quality targets (95% fields / 90% critical) were **not met**. Apply the explicitly documented manual-first/experimental policy from 09/12: manual form is the default; optional TimingAssistant is visibly experimental, opt-in, source-reviewed and explicitly applied, with a second manual constraint review. LLM output has no accepted-plan mutation path. This is experimental local qualification, not production-quality certification.
- Groq120B and GeminiLite explanation-v1 each passed **4/4** live fact combinations, using **3,666** and **848** total tokens respectively. Exhaustive local grounding/eligible-code tests were already verified separately. No explanation benefit over templates is claimed.
- Local `AI_ENABLED` is now true solely for the eligible-development profile. Qualified live roles: Lite constraints (experimental), Groq explanation, Lite explanation recovery. Groq constraints is excluded without the full current-prompt dataset evidence; Flash remains disabled after HTTP503, 3.6 unverified/disabled and 20B unselected. The candidate-order capability is preserved, but no unevaluated role is called during fallback. Public UK/production AI remains a separate deployment decision.
- Actual results, first/repeat scoring, token usage, exclusions and evidence filenames are in `research/phase-6/qualification-summary.json`. G06 remains pending only the final live assisted journey at this checkpoint; it must not be marked passed before that result is observed.


### Final M06 acceptance — G06 passed locally

The final real assisted journey exited **0** on 22 October 2026 (recorded UTC `2026-10-21T20:30:40.946Z`). It used normal local pages/private APIs, real hosted Auth/DB, actual Gemini/Groq calls and the real GB national grid. It verified explicit source review/application, unchanged 875 Wh input, deterministic comparison, finished/changed task-key rejection, grounded explanation, cache reuse, immutable save and reload. Axe reported no violations and no viewport overflow/browser error was observed. Only this run's fixture user/private records were removed; existing Google/GitHub accounts were untouched.

- Real development references: plan `57b46992-cfd8-4d67-a561-52b22f5d67a0`, comparison `6d4cc8b4-f91b-42c8-aaba-4909757f4629`, snapshot `8c3691dc-aa8f-48a3-8cc6-367d041ccf24`. These are test evidence, not executed washing cycles or measured climate benefit.
- Service-only metadata confirms exactly **two successful provider attempts** in this journey's observation window: Lite constraints-v3 **572 tokens / 2,184 ms provider latency** and Groq120B explanation-v1 **1,123 tokens / 1,971 ms**. Duplicate/conflicting extraction and explanation cache reads triggered no further provider attempt. The script's four-attempt figure is the maximum allowed across its two normal tasks, not the observed count.
- Visually inspected `test-results/live-ai-comparison.png`: real source/assumption details, readable baseline/suggested times, correctly labeled estimated difference, grounded explanation and the save review action. Existing restrained typography/layout is preserved. This screenshot is an ignored local artifact.

| Task | Final state | Actual acceptance evidence |
|---|---|---|
| M06.01 | Passed | Strict/versioned schemas/policy/prompts, exact-hash human-reviewed 20/40 fixtures, durable shared quotas/identity/leases and migration/RLS/retention/cache tests; incremental migrations 003–005 applied |
| M06.02 | Passed for current release | Lite actual access plus 60-case interpretation and 4-case explanation evidence. Flash failures/3.6 unknown limits explicitly disable those candidates, with no capacity invented |
| M06.03 | Passed for current release | Groq strict-schema adapter, observed headers, 4/4 grounded explanation cases and actual normal-route explanation; unevaluated Groq interpretation/20B remain excluded |
| M06.04 | Passed locally | Shared admission/caps/circuits/retries, OAuth/mutation controls, source-reviewed optional UI and templates; existing isolated acceptance plus actual duplicate/cache/normal-save behavior |
| M06.05 | Passed under experimental policy | Complete reviewed live datasets, original/repeat failures and tokens/latency reported, manual-first/experimental controls enforced, both explanation routes evaluated and real assisted journey passed |

**Quality limitation:** first-attempt timing scores are 94.4% fields and 85% whole-example critical accuracy, below the proposed 95%/90% targets. This is **not** a claim that the interpreter is fully accurate or production-certified. G06 uses the release behavior explicitly specified in documents 09/12: manual input remains default; timing AI is opt-in/experimental, every suggestion requires review/application, and a second constraint review precedes deterministic comparison/save. Known failed case IDs and separate repeats remain in the evidence. Human post-review accuracy and field-user benefit have not been measured. No AI output can directly accept a plan.

Current local profile is `eligible_free_development`, with AI enabled only for Lite experimental timing, Groq explanation and Lite explanation fallback. No further current-route live check is pending. Flash, 3.6, Groq timing and 20B are excluded dispositions, not falsely qualified models. A future candidate promotion needs its own evidence and correct shared caps; 17/day Flash and global 200/day remain unchanged. Public UK routing, production proxy/OAuth checks, user feedback and M07–M11 stay with their owning later decisions/phases.

Verification was deliberately focused after U27: reused the earlier 395-unit / 55-SQL / 45-browser passing baseline and 394-test clean-copy result; the later changed UI/evaluation suites passed **10 targeted checks**, with lint/boundaries and both typechecks. No fresh full-suite or clean-copy count is invented. The final live journey is new observed evidence. Normal tests contain no live inference; all actual model calls were explicit free-tier runs with shared durable accounting.

### Current handoff — M06 complete

```text
Task: M06.05
Status: passed locally; G06 passed under documented manual-first experimental quality policy; stop before M07
Scope/spec version used: roadmap 2.7; PRD1.8; features1.4/UI1.6/architecture1.6; AI1.4/manual1.7; constraints-v3/explanation-v1; schema1; unchanged deterministic method
Dependencies and external gates: G00–G06 passed locally; G-DB available; G-AI available for current evaluated local Lite/Groq roles. Flash/3.6/extra roles excluded. Public UK AI profile, G-CHAIN and G-HOST unresolved for later phases.
Changed files: server-only registry/policy/environment and AI contracts/prompts/validation/adapters/router/cache/handlers; shared quota/Auth/mutation controls; incremental DB migrations003–005/types; optional planner/detail UI and styles; explicit operator/evaluation/live-flow scripts; reviewed fixtures/tests; owning docs/index/status. Preserve all earlier M04/M05 changes.
Checks run and observed results: baseline395 unit/component,55 isolatedSQL,45 Chromium browser,production build and earlier394-test clean copy passed; later10 targeted UI/evaluation cases plus lint/boundaries/both types passed. Completed60-case live first-attempt timing coverage plus9 recorded repeats; explanation4/4 perprovider; actual assisted compare/cache/save/reload/duplicate/conflict/axe/overflow journey passed with2 successful provider attempts.
Manual/live checks and environment: macOS arm64;Node24.11.1/pnpm10.34.4;existing Free hosted development project;local http://127.0.0.1:3000;AI enabled eligible-development only;ledger disabled;ignored secrets mode0600. Original OAuth users unchanged; temporary fixture user cleaned up. Existing Google/GitHub sign-ins were builder-confirmed in M04, not newly claimed here.
Unresolved failures or decisions: timing accuracy below targets, so experimental/manual-first controls remain mandatory. No production/publicAI eligibility, actual billed-cost, post-review accuracy, field-user benefit, physical execution, model discontinuation, testnet or deployedURL claim. BuilderM05 usability review deferred. No required current G06 live check remains.
Next ready task: M07.01 only after explicit user authorization
Exact command/action to resume: On M07 authorization read AGENTS.md,index,status and all14 numbered docs. Inspect roadmapM07 and completion/report/state/API/method rules in06/07/08/12 plus existing plan repository/types. Implement the authorized completion lifecycle sequentially, preserving immutable accepted plans, current AI routes/caps and manual planner; apply only incremental reviewed migrations. Do not start M08+, purchases, deployment or Git publication without authorization.
Relevant commit or reviewable diff: uncommitted M04–M06 work on main after298d3a3a79e376f6c9c3b8a6d68f00bd423afbdd;41 published commits preserved; no commit or push performed
```

## 20. M07 — private completion lifecycle

Authorization: U28. Entry G05 passed; M06 remains locally qualified with its documented limitations. Read all fourteen numbered specifications, index/status and existing implementation. M07.01–M07.05 passed locally; checkpoint records and final acceptance follow. No M08 implementation, source publication, paid API calls or deployment is authorized.

Implementation choices: completion/report/result document envelopes are version 1; original comparison and forecast remain immutable. Plan `version` increments only on a new report, cancellation or changed result. Unchanged refreshes retain the existing result ID/sequence. Authentication uses a new, same-account provider OAuth exchange and a server-signed session-bound receipt valid for ten minutes; a refreshed access token alone is insufficient.

### M07.01 — completed locally

Changed `supabase/migrations/20261022000600_private_lifecycle.sql`, `src/contracts/lifecycle.ts`, shared planning contracts, plan hydration and the lifecycle repository; added `src/test/integration/private-lifecycle.test.ts`. Applied all migrations to a fresh, disposable native PostgreSQL fixture: **64/64 integration checks passed**, including nine M07 transaction/RLS/immutability/deletion cases. Concurrent same-key requests return one acknowledgement; concurrent corrections accept one next revision and reject stale writers. A forced acknowledgement failure rolls back both append-only records and the plan version. Historical fixtures are explicitly authored, separate from live acceptance. Initial cancellation-fixture clock construction was corrected; no product clock override added. M07.02–M07.05 remain in progress pending API/UI/live verification.

### M07.02 — passed local API/UI checks

Implemented strict reporting HTTP commands (`src/server/plans/lifecycle-handlers.ts`, lifecycle service/entry and report route), P06 (`src/app/app/plans/[planId]/complete/page.tsx`, `completion-form.tsx`), and shared versioned report contracts. The service reuses the M02 deterministic result projector, validates timing before fetching data, requires a real boolean profile answer, and appends corrections referencing the current report. Future/unfinished runs, early ordinary non-execution and untrusted owner/totals/clock inputs are rejected. Component checks exercise preserved form fields and stable retry keys after network uncertainty. Full unit/component run: **422 passed** before the additional empty-DELETE regression; targeted HTTP follow-up: **5 passed**.

### M07.03 — passed local calculation/refresh checks

The lifecycle service fetches the union of original baseline and reported windows from the existing real actual-grid adapter. Outage/missing factors preserve a report with null amounts; profile changes skip provider calls and retain `PROFILE_CHANGED`; negative estimates stay signed. `resultIdentity` compares relevant actual factors and result semantics, excluding retrieval-only metadata. SQL refresh reuses a matching result ID and version; changed factors append. New RLS invoker read functions return plan/history together in one SQL snapshot and page current statuses consistently (`20261022000700_lifecycle_reads.sql`). Latest isolated database run: **65 passed**. Both new migrations applied to the existing development project and database types regenerated; existing applied migrations left unchanged.

### M07.04 — passed state/history checks; live journey in progress

Extended saved detail and dashboard with real completion state, updated result, immutable report/result history, signed higher/lower comparisons, correction, cancellation and private deletion controls. `result-history.tsx` preserves explicit self-report/assumed-energy wording and the original forecast remains available separately. Cancellation requires an unreported plan before its selected start and creates a terminal non-run report with no numeric benefit. Deletion removes its private records/comparison/orphan snapshots and preserves a 24-hour acknowledgement for retries. SQL exercises concurrent corrections, ownership, terminal cancellation, immutable history and rollback. The live journey already observed real save/cancellation/history/retry/original forecast preservation; it exposed a zero-byte DELETE stream check, now corrected to validate actual bytes, with a targeted passing regression. Full live journey and final integration checks are pending.

### M07.05 — passed private account/settings baseline

Added P07 Account settings, reused the existing provider forms with a reauthentication intent, and preserved the fixed callback allowlist. A server-signed HttpOnly intent and a fresh same-account Google/GitHub PKCE exchange produce a ten-minute, session-bound receipt. A query parameter, normal token refresh, wrong owner, tampered/expired proof or a checkbox alone cannot authorize deletion. Sign-out/account deletion clear the receipts. The administrative deletion adapter accepts a same-account concurrent removal already completed after validated authentication; other failures stay visible. Quota reservations are retained under existing policy rather than refunded. Added explicit preview/apply retention for expired lifecycle acknowledgements; preview observed **0 expired acknowledgements**. No schedule is claimed.

Changed files include `src/server/auth/{reauth-proof,reauth,delete-account}.ts`, existing OAuth handlers/provider form, account route, `src/app/app/settings/page.tsx`, `account-controls.tsx`, navigation, shared styles, lifecycle check/maintenance scripts and the unit/component/SQL suites. Documentation owners 01/04/05/06/07/11/12/13/14, index, README and guidance were aligned with the implemented scope. No dependency/model-policy/key changes.

### G07 final acceptance — 22 October 2026

| Task | State | Final evidence |
|---|---|---|
| M07.01 | Passed | Append-only schemas, parent locks, current-report references, unique sequences, rollback and invoker owner-consistent reads |
| M07.02 | Passed | P06 and strict run/non-run commands; profile answer, future/unfinished-run rejection, corrections and immutable forecast |
| M07.03 | Passed | Actual snapshot persistence/RLS; pending nulls, signed negative comparison, unchanged refresh reuse and changed-factor revisions |
| M07.04 | Passed | Cancellation terminal/non-numeric; report/result history, owner isolation, private deletion/orphan cleanup and stable replay |
| M07.05 | Passed | P07, session-bound reauthentication proof, guarded identity/private-data deletion and complete local lifecycle verification |

Executed verification:
- `pnpm test`: **426/426** unit/component checks passed across 40 files. The final targeted handler/administrative-route selection also passed **8/8** after the empty-stream and concurrent-delete corrections.
- `pnpm test:integration`: **67/67** checks passed on a new disposable native PostgreSQL cluster. This includes actual-snapshot persistence/read isolation, semantic refresh reuse, changed factors, changed-profile correction, concurrent sequence allocation and transactional cleanup. Test fixture types were subsequently widened to represent both ran/non-run variants; no runtime SQL behavior changed.
- `pnpm test:e2e`: **45/45** Chromium checks passed across desktop/tablet/mobile against an isolated production server. These exercise the existing shell, domain parity, AI harness and manual demo; private M07 screens use the separate authenticated journey below.
- Final `pnpm lint`, `pnpm typecheck` and production build passed. The production build uses a command-only HTTPS example origin and AI disabled; ignored development configuration remains unchanged. The first build correctly rejected the local HTTP origin under production policy; no validator was relaxed.
- Explicit live development journey passed: normal manual constraints → real national forecast → immutable acceptance → P06 future-report rejection → cancellation/history → exact retry acknowledgement → terminal correction rejection → recent-confirmation deletion guard → private deletion → temporary account removal. Two-user isolation and retained unrelated member verified. Zero observed browser errors/axe violations, desktop/mobile overflow checks and completion/settings screenshots inspected. The first browser attempt used a locator that also matched Next's route announcer; narrowed it without changing the product. The actual zero-byte DELETE transport defect was fixed and regression checked before the successful journey.
- Separate actual-grid integration passed with an explicitly authored historical plan **held only in memory**. Real actual factors yielded baseline **83,999 mg**, reported **95,812 mg**, signed difference **−11,813 mg**, preserving higher emissions honestly. No authored forecast was inserted into the application DB. Evidence: `research/phase-7/live-lifecycle.json`.
- Provider-start redirects were exercised live for Google/GitHub. Callback success/session/owner checks are isolated automated tests; the temporary deletion journey uses a signed fixture receipt. **No fresh human provider reauthentication is claimed.** External human/provider/deployment verification remains M11 release evidence.
- Incremental development migrations 006/007 applied; generated schema types refreshed. Final linked dry-run passed with **no pending migrations**. Source credential scan passed without matches. `git diff --check` passed. Only this run’s temporary accounts were removed; existing real accounts/research/published history preserved. No AI inference, ledger call, paid activation, commit or push.

### Current handoff — M07 complete

```text
Task: M07.01–M07.05 / G07
Status: passed locally; stop before M08
Scope/spec version used: Roadmap 2.8; version-1 private report/result envelopes; existing carbonshift-gb-uniform-v1 method; all fourteen numbered documents and guidance read at phase start
Dependencies and external gates: G05/G06 preserved; hosted development migrations current. No new key needed for M08. G-CHAIN/funded signer due M09; public AI profile/privacy contact/deployed OAuth due M11
Changed files: shared contracts; two incremental migrations/generated types; lifecycle repository/service/routes; completion/history/actions/settings/account controls; OAuth reauthentication; styles/navigation; explicit live/retention scripts; focused tests and affected owner documents
Checks run and observed results: 426 unit/component, 67 SQL, 45 browser; lint/types/final production build; real development lifecycle; live actual factors with in-memory authored historical plan; migration dry run, credential scan, diff whitespace
Manual/live checks and environment: loopback Next development app, existing hosted Free Supabase project, real national grid. Temporary members cleaned. Real provider-start redirects; callback/receipt boundary documented; human reauthentication not repeated
Unresolved failures or decisions: no current G07 failure. Public/chain-aware deletion remains M09/M11; public UK AI profile and privacy contact unresolved. M06 timing remains experimental/manual-first. Builder's optional M05 usability review remains deferred
Next ready task: M08.01 only after explicit phase authorization
Exact command/action to resume: On M08 authorization read AGENTS.md, docs/README.md, this log and all fourteen numbered documents. Revisit roadmap M08 and docs 08/10/12. Inspect frozen src/contracts/lifecycle.ts, report/result persistence and the existing local contract tooling. Start canonical proof contracts/method descriptor in M08.01; preserve all private lifecycle interfaces and immutable history. Do not deploy, fund a signer, change product AI policy or publish source without authorization
Relevant commit or reviewable diff: M04–M07 source after 298d3a3a79e376f6c9c3b8a6d68f00bd423afbdd; U29 packages it in the source publication batch in section 21. Prior 41 published commits preserved; M08 remains unstarted
```

## 21. M04–M07 source publication — 22 October 2026

U29 authorizes professional commits and a normal push to the existing `origin/main` after the working tree is clean. The global Git identity remains `z-lovejeet <lovejeet1225@gmail.com>`; no repository identity override or history reconstruction is used. The existing 41 commits through `298d3a3a79e376f6c9c3b8a6d68f00bd423afbdd` are preserved. This is source publication, not an application/contract deployment or M08 authorization.

The publication manifest covers all **209 changed files** in **50 focused commits**. A strict three-file maximum would require 70 commits; the user explicitly permits larger groups to stay within 50. The distribution is 3 two-file, 16 three-file, 15 four-file, 8 five-file, 4 six-file, 2 seven-file, 1 eight-file and 1 nine-file commit. The largest groups collect related provider-access/evaluation evidence; source commits follow coherent modules and behaviors. No placeholder commits, artificial feature edits, backdating or author/co-author overrides are introduced.

Fresh pre-commit verification passed:
- `pnpm verify:clean`: strict frozen install, unconfigured environment validation, lint/import boundaries, the one local contract-tooling smoke, both typechecks, **426 unit/component checks**, and the production build in a temporary copy without credentials or generated artifacts. The temporary copy was removed.
- `pnpm test:integration`: **67 checks** against a fresh disposable PostgreSQL fixture. No hosted reset, inference or testnet call.
- Exact local secret-value scan and credential-shaped-literal scan found no matches in publishable files. `.env.local`, `.env.supabase.local` and Supabase CLI temporary metadata remain ignored. Existing research/evaluation artifacts were inspected as non-secret evidence.
- Before the batch, `git fetch origin` showed local and remote `main` at the same commit with zero divergence. `git diff --check` passed.

This record belongs to the batch’s final commit. The authorized push follows only after all 50 commits are checked and the working tree/index contain no remaining changes. Its acknowledgement must be verified against the remote `main` reference; Git status and the execution response are the authority for actual push completion. No subsequent phase or automatic future push is authorized.
