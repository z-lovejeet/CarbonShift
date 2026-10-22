# CarbonShift — tech stack and folder structure

Version 1.8 · 22 October 2026 · M07 private lifecycle and pinned M06 provider SDKs implemented; phase evidence is in the status log.

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
| Canonical data | RFC 8785-compatible canonicalizer; SHA-256 | Reproducible manifest digests across server and browser |
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
| Provider SDKs/canonicalizer | Gemini/Groq SDK pins and local evaluated routes implemented in M06; canonicalizer remains M08 work |
| Gemini/Groq models | Evaluated local Lite/Groq roles in [09](09-ai-agents-models-and-workflow.md); timing experimental/manual-first; public profile unresolved |

Update this table with actual versions and command evidence, not guessed versions.

TypeScript 5.9 remains within typescript-eslint's declared support range; its latest major was not selected blindly. jsdom 27 and Vite 7/React plugin 5 support the pinned Node runtime. Registry metadata plus actual installs/builds/tests establish the foundation matrix; they do not validate deferred model integrations. The local solc JavaScript compiler is resolved from the lockfile-pinned package rather than downloaded at test time.

## 3. Proposed repository tree

This is the full target tree. M01 creates the foundation/configuration/tooling/shell subset; M02 adds domain modules, schemas, authored fixtures and tests; M03 adds `server/grid/`, recorded grid replay, adapter/failure tests and the explicit grid check script. M04 adds `server/auth`, `db`, `http`, `plans`, login/OAuth/API routes, `src/proxy.ts`, incremental migrations, and isolated database/Auth/API tests. M05 adds shared `contracts/`, browser-safe `lib/`, planner/demo components, protected dashboard/form/detail pages, and explicit live browser checks. M06 adds bounded AI/admission; M07 adds lifecycle contracts/services, migrations, completion/settings screens and reauthentication/deletion. `domain/proof.ts` and publication remain later work. Check the filesystem and status log for actual files. Keep research intact. `src/config/` contains environment parsing without ambient reads; server/worker wrappers supply the relevant process environment. Contract-tool smoke fixtures are separate from the M08 product contract.

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
| `pnpm contracts:test` | Local contract tests; no testnet key required |
| `pnpm contracts:deploy` | Explicit target-chain deployment after checks |
| `pnpm ai:evaluate` | Implemented interpreter runner; dry-run default, one-request budget default; explicit live mode needs reviewed fixture hashes and verified free limits |
| `pnpm ai:evaluate-explanation` | Implemented code-selection checks against the deterministic template baseline, same accounting and explicit live mode |
| `pnpm ai:access` / `pnpm ai:smoke` | Explicit catalog GETs / exactly one admitted access-schema probe; not ordinary tests or model qualification |
| `pnpm ai:policy` / `pnpm ai:maintenance` | New disabled policy template / aggregate retention preview; maintenance mutates only with `--apply` |
| `pnpm check:env` | Presence/format checks; never print secrets |
| `pnpm check:integrations` | Bounded authenticated smoke tests, summary only |
| `pnpm worker:ledger` | Single leased worker with clean shutdown |
| `pnpm ledger:reconcile` | Compare persisted operations against chain without duplicate issuance |

M01 implements `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `contracts:test`, and `check:env`, plus `verify:clean`. M03 adds `pnpm check:grid` for explicit live forecast/range smoke checks; `--capture` writes the first immutable replay fixture and refuses overwriting it. Inspect `package.json` for exact command bodies. M04 adds `pnpm test:integration` for isolated PostgreSQL migration/RLS/transaction checks and explicit `pnpm check:accounts` for the selected hosted dev project and local HTTP API. M05 adds `pnpm check:planner` for the real manual desktop/mobile browser journey. These explicit live checks use real public grid data and temporary test Auth users; it is excluded from ordinary tests/CI. M06 adds the explicit AI operator commands listed above; deployment, broader integration checking and ledger worker/reconciliation remain future targets. The contract test covers a tooling fixture; it does not certify the M08 registry. Normal tests and CI never execute live grid/account/planner/AI commands or require public API access.

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
