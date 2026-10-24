# CarbonShift — tech stack and folder structure

Version 2.0 · 23 October 2026 · M09 runtime worker/viem, generated schema correction, deployment/reconciliation scripts and actual testnet integration implemented; evidence is in the status log.

**U34 target revision · 23 October 2026:** the approved household expansion at the end of this document supersedes conflicting washing-only restrictions for new v2 work. Earlier sections retain v1 contracts and historical implementation evidence. New capabilities are not passed until recorded in status.

## 1. Selected stack

| Concern | Choice | Reason and boundary |
|---|---|---|
| Web/server | Next.js App Router, React, TypeScript strict mode | One codebase for pages and authenticated server routes |
| Styling | Tailwind CSS and small accessible components | Consistent tokens; no large animated component library |
| Validation | Zod + explicit JSON Schemas | Shared boundary validation; provider-specific schemas derived and tested |
| Data/auth | Supabase Postgres + Auth + SSR integration | Relational transactions and row-level ownership |
| Grid data | Server adapter for NESO Carbon Intensity API | National GB inputs; native Node fetch, schema/coverage, cache and live read verified in M03 |
| AI | Official `@google/genai` 2.30.0 and `groq-sdk` 1.6.0 | Bounded adapters, code-owned model registry and strict server policy; no agent framework |
| Dates | `@js-temporal/polyfill` behind one time module | Explicit timezone/disambiguation and elapsed-time handling |
| Charts | Recharts, dynamically loaded | One intensity chart with separate accessible HTML table |
| Canonical data | `canonicalize` 5.1.0; `@noble/hashes` 2.4.0 SHA-256 | Reproducible manifest digests across server and browser |
| EVM client | viem | Read contract state, encode calls, worker signing |
| Contract | Solidity + OpenZeppelin `Ownable2Step` | Small non-upgradeable operator-issued registry |
| Contract tools | Hardhat | TypeScript-oriented build, local network, contract tests |
| App tests | Vitest + Testing Library + Playwright | Pure-domain, interaction, and complete-browser verification |
| Web hosting | Vercel | One web deployment; verify chosen runtime limits |
| Ledger processing | Single Node worker | Durable outbox processing; explicit local process during prototype |
| Repository | Git + GitHub; pnpm | Reproducible dependency lockfile and source history |

No Redis, vector database, agent framework, Kubernetes, Python service, IPFS dependency, Supabase Storage bucket, or appliance SDK is required for this scope. Bundles are small JSON records in Postgres; local verifier imports do not upload files.

## 2. Version policy

At task M01 in the roadmap, inspect the available Node runtime and select a supported Node LTS compatible with the current stable Next.js, Supabase SDKs, and Hardhat. Resolve exact package versions from official/package metadata and record them below before implementation proceeds beyond scaffolding. Commit `pnpm-lock.yaml`; use frozen-lockfile installs thereafter.

This document intentionally does not pretend a compatibility matrix has been tested. Do not install a compiler from a `-develop` documentation page merely because that page says “latest.” Select and pin a released Solidity compiler compatible with the chosen OpenZeppelin release, and record optimizer/EVM target settings.

| Item to record at M01 | Current evidence |
|---|---|
| Node and pnpm versions | Node `24.11.1`, pnpm `10.34.4`; pinned in `.nvmrc`/`.node-version` and `packageManager`; fresh frozen install passed |
| Next.js, React, TypeScript | Next `16.4.2`, React/React DOM `19.3.1`, TypeScript `5.9.3`; initial production build passed, including a clean copy |
| CSS and validation | Tailwind/PostCSS `4.3.3`, Zod `4.6.7`; exact manifest/lockfile pins |
| Lint | ESLint `10.13.0`, official Next plugin `16.4.2`, typescript-eslint `8.72.0`, React Hooks plugin `7.1.1`; direct plugins avoid the aggregate preset's incompatible legacy peers |
| App test tools | Vitest `5.0.5`, Vite `7.3.7`, React Vite plugin `5.2.0`, jsdom `27.4.0`, Playwright `1.64.1`, axe Playwright `4.14.0`; versions selected to support the pinned Node runtime |
| Hardhat, Solidity, OpenZeppelin, viem | Hardhat `3.20.0`, released solc `0.8.37`, OpenZeppelin `5.6.1`, viem `2.57.7`; local compiler/OpenZeppelin/chain smoke passed; Cancun EVM target and optimizer 200 |
| M02 date and property-test libraries | `@js-temporal/polyfill` `0.5.1`, fast-check `4.10.2`; exact registry-selected pins, unit/property and Chromium parity tests executed |
| M04 database/Auth | `@supabase/ssr` `0.12.7`, `@supabase/supabase-js` `2.118.0`; exact compatible pins; generated public schema types; local and hosted integration checked |
| M04 database testing/CLI | Dev `postgres` `3.4.9`; native PostgreSQL `17.10` isolated tests; Supabase CLI `2.121.0`; CI PostgreSQL 17 service image pinned by digest |
| M05 chart | Recharts `3.10.1`, matching React-is `19.3.1`; exact compatible peer/runtime metadata inspected; strict install/build and browser rendering checked |
| Provider SDKs/canonicalizer | Gemini/Groq SDK pins and local evaluated routes implemented in M06; M08 pins canonicalize 5.1.0 and @noble/hashes 2.4.0; strict install, browser/server goldens and clean-copy checks recorded in status |
| Gemini/Groq models | Evaluated local Lite/Groq roles in [09](09-ai-agents-models-and-workflow.md); timing experimental/manual-first; public profile unresolved |

Update this table with actual versions and command evidence, not guessed versions.

TypeScript 5.9 remains within typescript-eslint's declared support range; its latest major was not selected blindly. jsdom 27 and Vite 7/React plugin 5 support the pinned Node runtime. Registry metadata plus actual installs/builds/tests establish the foundation matrix; they do not validate deferred model integrations. The local solc JavaScript compiler is resolved from the lockfile-pinned package rather than downloaded at test time.

## 3. Proposed repository tree

This is the full target tree. M01 creates the foundation/configuration/tooling/shell subset; M02 adds domain modules, schemas, authored fixtures and tests; M03 adds `server/grid/`, recorded grid replay, adapter/failure tests and the explicit grid check script. M04 adds `server/auth`, `db`, `http`, `plans`, login/OAuth/API routes, `src/proxy.ts`, incremental migrations, and isolated database/Auth/API tests. M05 adds shared `contracts/`, browser-safe `lib/`, planner/demo components, protected dashboard/form/detail pages, and explicit live browser checks. M06 adds bounded AI/admission; M07 adds lifecycle contracts/services, migrations, completion/settings screens and reauthentication/deletion. M08 adds `domain/proof.ts` and `domain/proof/`, `server/proof/`, generated ABI/build fingerprints, golden fixtures, local contract and browser parity checks. Publication remains M09/M10 work. Check the filesystem and status log for actual files. Keep research intact. `src/config/` contains environment parsing without ambient reads; server/worker wrappers supply the relevant process environment. Contract-tool smoke fixtures are separate from the M08 product contract.

```text
AGENTS.md
docs/
  README.md
  decisions-and-status.md
  01-prd-and-blueprint.md ... 14-manual-setup-guide.md
research/                         # Existing background; not executable scope
src/
  config/
    environment.ts                # Current typed web/worker loader
    ai-registry.ts                # Allowlisted model/provider capabilities
    ai-policy.ts                  # Strict AI_POLICY_JSON parser, no ambient reads
  app/
    page.tsx
    login/page.tsx
    auth/callback/route.ts
    auth/sign-in/route.ts
    auth/sign-out/route.ts
    app/
      page.tsx
      plan/new/page.tsx
      plans/[planId]/page.tsx
      plans/[planId]/complete/page.tsx
      settings/page.tsx
    receipts/[receiptId]/page.tsx
    verify/page.tsx
    methodology/page.tsx
    privacy/page.tsx
    demo/page.tsx
    api/v1/                       # Route contracts from document 07
    layout.tsx
    error.tsx
    not-found.tsx
    globals.css
  contracts/planning.ts           # Shared runtime API schemas; server path re-exports
  lib/                            # Browser-safe API/entry/presentation helpers
  components/
    ui/                           # Accessible generic controls
    planner/
    receipts/
    layout/
  domain/
    constraints.ts
    time.ts
    profile.ts
    scheduling.ts
    carbon.ts
    grid.ts                       # Pure snapshot normalization/coverage policy
    results.ts                    # Pure updated-result projection, not persistence
    method.ts
    errors.ts
    proof.ts
    schemas/
  server/
    auth/
    db/
    grid/
    ai/
      providers/gemini.ts
      providers/groq.ts
      prompts/
      router.ts
      validation.ts
    plans/
    publication/
    receipts/
    limits/                       # Shared atomic admission, reservations and request identities
    env.ts
  worker/
    ledger.ts
    reconciliation.ts
  fixtures/
    demo/
    grid/
    ai/
  test/
    unit/
    integration/
    e2e/
    fixtures/
contracts/
  ShiftReceipt.sol
  test/
  scripts/
supabase/
  migrations/
  config.toml                     # Local CLI config; do not push over hosted OAuth
scripts/
  check-env.ts
  evaluate-ai.ts
  check-integrations.ts
  check-planner.mjs                # Explicit hosted dev/browser check
  reconcile-ledger.ts
public/
.env.example
.gitignore
package.json
pnpm-lock.yaml
README.md                         # Generated during build from verified setup
```

Keep route handlers thin: validate/authenticate, invoke service, serialize response. Component files cannot import privileged database clients or provider SDKs. Put the shared pure verifier/scheduler below both browser and server so arithmetic is identical.

## 4. Required scripts to implement

| Proposed command | Required behavior |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Local app, production build, production server |
| `pnpm lint` / `pnpm typecheck` | Static checks independent of development server |
| `pnpm test` | Domain and component tests, no paid network calls |
| `pnpm test:integration` | Isolated DB/API integration tests |
| `pnpm test:e2e` | Browser journeys against known local/test services |
| `pnpm contracts:test` | Product/tooling local contract and full proof tests plus generated ABI/fingerprint check; no testnet key required |
| `pnpm proof:artifacts` | Compile and deliberately regenerate version-1 ABI/build fingerprints; review changes |
| `pnpm contracts:deploy` | Explicit target-chain deployment after checks |
| `pnpm ai:evaluate` | Implemented interpreter runner; dry-run default, one-request budget default; explicit live mode needs reviewed fixture hashes and verified free limits |
| `pnpm ai:evaluate-explanation` | Implemented code-selection checks against the deterministic template baseline, same accounting and explicit live mode |
| `pnpm ai:access` / `pnpm ai:smoke` | Explicit catalog GETs / exactly one admitted access-schema probe; not ordinary tests or model qualification |
| `pnpm ai:policy` / `pnpm ai:maintenance` | New disabled policy template / aggregate retention preview; maintenance mutates only with `--apply` |
| `pnpm check:env` | Presence/format checks; never print secrets |
| `pnpm check:integrations` | Bounded authenticated smoke tests, summary only |
| `pnpm worker:ledger` | Single leased worker with clean shutdown |
| `pnpm ledger:reconcile` | Compare persisted operations against chain without duplicate issuance |

M01 implements `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `contracts:test`, and `check:env`, plus `verify:clean`. M03 adds `pnpm check:grid` for explicit live forecast/range smoke checks; `--capture` writes the first immutable replay fixture and refuses overwriting it. Inspect `package.json` for exact command bodies. M04 adds `pnpm test:integration` for isolated PostgreSQL migration/RLS/transaction checks and explicit `pnpm check:accounts` for the selected hosted dev project and local HTTP API. M05 adds `pnpm check:planner` for the real manual desktop/mobile browser journey. These explicit live checks use real public grid data and temporary test Auth users; it is excluded from ordinary tests/CI. M06 adds the explicit AI operator commands listed above; deployment, broader integration checking and ledger worker/reconciliation remain future targets. M08 contract tests cover ShiftReceipt and a tooling fixture; generated ABI/source/bytecode fingerprints are checked, with no network/deployment claim. Normal tests and CI never execute live grid/account/planner/AI commands or require public API access.

## 5. Configuration ownership

Use one typed server environment loader. Only the Supabase public URL/publishable key and deliberately public chain metadata may be browser-visible. Gemini/Groq keys, database administrative credentials, RPC credentials, and signer keys remain server/worker-only.

The ledger signer is needed by the worker, not the web application. `APP_MODE` is not a global switch that transforms live records into demo records; each persisted manifest includes its immutable mode.

M06 implements one validated server-only `AI_POLICY_JSON` for exact candidate order, profile, qualification and bucket limits, owned by document 09. Parser/template/local configuration were migrated together; enabled web AI rejects the four legacy fields. Web AI remains disabled until role qualification. CLI evaluation has a separate strict loader for explicitly selected, unpromoted candidates and finite run budgets. Shared Postgres admission uses operational migrations 003/004 and no new service. The root manifest is authoritative for current commands; later contract deployment/worker commands in the table remain targets.

Complete variable names and setup verification are in [14](14-manual-setup-guide.md).

## 6. Official references

- [Next.js App Router](https://nextjs.org/docs/app): selected web application framework.
- [Supabase SSR integration](https://supabase.com/docs/guides/auth/server-side/nextjs) and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security): authentication and data access.
- [OpenZeppelin access control](https://docs.openzeppelin.com/contracts/5.x/access-control): contract ownership pattern.
- [Solidity documentation](https://docs.soliditylang.org/en/latest/): language reference; pin a released compiler.
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785): canonical JSON reference.

Links were inspected on 20 October 2026. A source documenting a capability is not evidence that this application's integration passes.

M02 additionally checked the installed Temporal README/types and [official Temporal conversion documentation](https://tc39.es/proposal-temporal/docs/plaindatetime.html#toZonedDateTime), plus [fast-check's property generators](https://fast-check.dev/docs/core-blocks/arbitraries/), on 21 October. Library version selection came from package registry metadata and strict install evidence, not a floating documentation version. Temporal is imported only by `domain/time.ts`. Normal tests do not call providers; the optional local benchmark command is documented in the root README.

M06 adds the explicit `pnpm check:ai-flow` development integration command. It requires evaluated role routes and locally enabled AI, creates/cleans only its own fixture member, and makes at most two ordinary two-attempt AI tasks (one interpreter, one explanation). It is excluded from normal tests/CI. Its actual execution result belongs to the status log.

M07 operator scripts: `check:lifecycle` runs the explicit temporary-member browser/API journey plus an in-memory historical fixture against live actual factors. `lifecycle:maintenance` previews expired private acknowledgement counts; `--apply` prunes expired records only. No new dependency or secret.

M08 generated artifacts: `src/generated/shift-receipt-v1.ts` and `shift-receipt-v1.build.json`. Raw Hardhat artifacts/cache remain ignored and are reproduced with the local pinned compiler. Contract test TypeScript uses ESNext/Bundler resolution so it can import the same pure modules and checked-in ABI as the web verifier; it does not require ignored generated declaration files. No secret or deployed address appears in these artifacts.

## M09 actual scripts and boundaries

`contracts:deploy` checks the compiled fingerprint and defaults to a read-only preparation; `--broadcast` performs the explicitly authorized Sepolia deployment. Its ignored `.ledger-deployment.local.json` persists signed bytes before sending and must be retained for recovery. Only verified deployment metadata enables the local web/worker ledger configuration. `worker:ledger` runs the leased local worker; `--once` runs one cycle. `ledger:reconcile` is a single observation-only cycle and cannot sign or rebroadcast. `check:publication` is the explicit real development/browser/testnet journey; ordinary tests and CI do not invoke it.

Viem 2.57.7 is now a production dependency for the worker. `server/db/database.types.ts` remains generated from the linked schema; `schema.ts` adds only the SQL-nullability corrections absent from generated function argument types. Contract test TypeScript shares the root source alias and JSON resolution so the actual worker adapter is tested against the isolated EVM. No new service or paid dependency was added.

## Household expansion — U34 proposed work areas

Use the currently pinned stack and lockfile. No new AI framework, vector database, queue service or paid appliance API is required. The following are planned additions, not implemented scripts or files:

```text
src/domain/activities/       # method, strict types, energy, integration, constraints, candidates, optimizer
src/contracts/activities.ts # versioned transport views
src/data/activity-profiles.ts # exact reviewed reference records
src/server/activities/       # profile resolution, simulation and grid coverage
src/server/schedules/        # compare, accept, history, reports, persistence
src/components/activities/   # reusable activity/energy editors and simulation results
src/components/schedules/    # task list, review, alternatives, timeline and report
src/app/app/simulate/        # dedicated simulator
src/app/app/day/new/         # dedicated day planner
src/app/api/v2/              # strict new endpoints, no changes to v1 clients
src/domain/proof/v2/         # versioned public manifests and reproducibility
src/test/unit/activities*    # independent known answers and scheduler cases
src/test/integration/activities* # isolated ownership/atomicity/lifecycle checks
src/test/e2e/activities*     # separate-workspace journeys
```

Extend existing planner/detail/history routes with explicit version dispatch; preserve historical rendering and API contracts. Add migrations after 009; never rewrite applied migration files. Regenerate database types after schema changes and keep narrowly documented nullable RPC fixes only. Update import-boundary checks if a new pure entry point needs classification. Add package scripts only when their implementation exists, and record their actual execution in status.

### Implemented household work areas (U35)

Pure schemas and calculation contracts now live in `src/domain/activities/{schemas,documents,schedule-documents,report-schemas}.ts`; `src/contracts/{activities,schedules,schedule-lifecycle}.ts` re-export them for server/UI consumers. Domain results and v2 proof import those pure owners rather than API/server modules. The purity checker permits the same selected canonicalization/hash libraries only in the two versioned canonical modules.

New workspaces live under `src/app/app/{simulate,plan/new,day/new}`. Shared household UI is `src/components/activities/`. APIs and server persistence/lifecycle/publication live under `src/app/api/v2/` and `src/server/{activities,schedules}/`. Public projections, source observations and generic receipt reads live in `src/server/publication/`. The local verifier runs heavy calculations in `src/lib/proof-worker.ts`. These are implementation locations, not acceptance claims; current evidence remains in status.
