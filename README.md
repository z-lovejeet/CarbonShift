# CarbonShift

Thoughtful timing for everyday electricity use. CarbonShift is a ClimateChain project in the Renewable Energy & Energy Trading track.

**Current build:** M02 deterministic domain engine plus the M01 application foundation. Shared validation, London/UTC time handling, feasible scheduling, exact carbon arithmetic, and updated-result projections exist. The public shell still says recommendations are unavailable: the planner UI, accounts, live grid integration, AI assistance, and receipts belong to later phases.

## Run locally

Use Node **24.11.1** and pnpm **10.34.4**, pinned in `.nvmrc`, `.node-version`, and `package.json`. Both were already available on the builder's machine. On another machine, install those versions with your preferred manager first.

```sh
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm check:env
pnpm dev
```

Visit `http://127.0.0.1:3000`. The foundation needs no API key, database, wallet, or environment file.

For a local production preview:

```sh
pnpm build
pnpm start
```

`GET /api/v1/health` reports application liveness and a generated request ID. It does not attest to database, provider, or worker readiness.

## Configuration

When a consuming phase needs services, copy `.env.example` to the ignored `.env.local`, then enter values securely. Keep `AI_ENABLED=false` and `LEDGER_ENABLED=false` until their integrations/configuration are ready. Blank optional fields are unconfigured, never fake defaults.

The web environment rejects signer material and unapproved `NEXT_PUBLIC_` variables. A configured Supabase pair also needs a quota HMAC secret of at least 32 characters; enabled AI needs both providers and its four explicit model IDs. Account-backed production capabilities require an HTTPS `APP_ORIGIN`. Validation checks shape/completeness; it does not establish that credentials work.

The separate `.env.worker.example` is for M09. Copy it to `.env.worker.local` only when preparing the worker, and keep it out of the web host. `pnpm check:env --target worker` intentionally fails until the worker is enabled and all required settings exist. No ledger worker/deployment command is implemented in M01.

Configuration errors list field names without values. Keep keys and wallet recovery material out of chat, source, logs, and model prompts. Both real environment files are ignored by Git.

## Current checks

```sh
pnpm lint
pnpm contracts:test
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

- Lint includes transitive client-import/environment checks and a domain purity check that rejects outside imports and direct ambient clock/network operations. Server configuration also uses Next's `server-only` marker; the worker wrapper imports Node-only APIs.
- Typecheck generates Next route types and checks web/tooling plus contract configuration/tests.
- Unit/component tests cover the foundation plus domain schemas, timezone/DST rules, full-window coverage, integer energy/carbon math, optimizer reference cases and updated-result states. Fixed-seed property tests exercise 2,300 generated cases. This is scoped T03/T06 and T09-domain evidence, not completed F01–F12 acceptance.
- Contract tests compile a clearly labeled **tooling fixture**, deploy it on an isolated local EVM, and exercise OpenZeppelin ownership through viem. They use the lockfile-pinned local solc package, with optimizer 200 and Cancun target; no testnet access or wallet key is needed. The product `ShiftReceipt` contract belongs to M08.
- Browser tests use a production build on `127.0.0.1:3100`, start/stop their own server, and cover the shell at 360/768/1440 px. M02 additionally bundles the real domain modules in memory and checks London/DST handling in an India-timezone browser and exact browser/server calculation agreement. No test route is added to the app. Run `pnpm build` first. Results are in ignored `test-results/` and `playwright-report/`.

Run a fresh-copy reproduction without copying secrets, dependencies, or build artifacts:

```sh
pnpm verify:clean
```

It runs the strict frozen install, environment check, lint/boundaries, local contract test, both typechecks, unit/component tests, and production build in a temporary directory, then removes only that directory. Browser checks are separate. Tests make no paid API calls.

The GitHub workflow runs the implemented foundation/domain checks. Its actions are pinned to public upstream commit references. The source repository is [z-lovejeet/CarbonShift](https://github.com/z-lovejeet/CarbonShift); `origin` uses its HTTPS URL. Source publication is separate from application deployment and hosted CI verification. Generated Next declarations (`next-env.d.ts`) are ignored and recreated by `dev`, `build`, or `typecheck`. Automatic framework edits to repository agent guidance are disabled with `agentRules: false`.

## Continue development

Read [repository guidance](AGENTS.md), the [documentation index](docs/README.md), and [current status/handoff](docs/decisions-and-status.md). The user requires all fourteen numbered documents to be read at each phase start. The [roadmap](docs/13-development-roadmap-and-codex-tasks.md) owns task scope and exit gates.

The next phase is M03, the real grid adapter. Supabase is needed for M04, Gemini/Groq for M06, and funded Sepolia/RPC access for M09. Detailed ownership and timing are in the [manual setup guide](docs/14-manual-setup-guide.md).

## Domain interfaces

`src/domain/scheduling.ts` takes confirmed constraints, a validated snapshot and supplied snapshot references, plus an explicit UTC clock. It returns a frozen comparison. `src/domain/results.ts` takes the accepted comparison and report/snapshot inputs and returns an updated estimate projection. Neither fetches data, persists records, controls appliances or calls a model. Both reject invalid inputs; missing actual factors remain unavailable.

`src/domain/time.ts` owns London disambiguation and UTC arithmetic; `profile.ts` converts decimal kWh text exactly to Wh and allocates the assumed energy bins; `carbon.ts` uses exact integer intermediates with one final rounding step. Shared schemas and `method.ts` define the versioned contracts/constants for later consumers.

The authored fixtures in `src/fixtures/demo/` are explicitly synthetic, with a fixed demo clock and a test reference that is **not** a computed digest or chain proof. Domain modules cannot import fixtures. Live handlers must supply a server clock and real snapshots; a fixture is never an outage fallback. Canonical hashing belongs to M08.

To reproduce the local, synthetic scheduler benchmark:

```sh
pnpm exec tsx scripts/benchmark-domain.ts
```

It measures 200 comparisons after 20 warmups for each of the 30- and 180-minute profiles over the full horizon, including validation. It reports hardware/runtime and local timing only, with no service latency or achieved climate-impact claim.

The dated `research/phase-0/verify-readiness.py` is historical M00 evidence and intentionally rejects a scaffolded app. Do not use it as the current app test suite. Preserve all earlier research as background rather than a competing implementation specification.
