# CarbonShift

Thoughtful timing for everyday electricity use. CarbonShift is a ClimateChain project in the Renewable Energy & Energy Trading track.

**Household expansion:** separate activity simulation, one/multiple-task planning and whole-day planning now connect to real GB grid data, reviewed energy inputs, immutable saves, per-task reporting/corrections, versioned public receipts and a local verifier. Existing v1 washing records retain their original method. The final combined acceptance pass completed on 24 October 2026, including real development Auth/database/grid journeys, qualified local AI endpoints/cache, and one v2 Sepolia plan/result. See the [acceptance evidence](research/household/final/README.md). Public deployment remains M11 work.

Start at `/app/simulate`, `/app/plan/new` or `/app/day/new`. Saved reports use `/app/plans/[planId]`; consented public copies use `/receipts/[receiptId]`. `/verify` processes exported files locally; `/methodology` and `/privacy` describe the calculation and disclosure boundaries. The demo remains visibly synthetic.


## Run locally

Use Node **24.11.1** and pnpm **10.34.4**, pinned in `.nvmrc`, `.node-version`, and `package.json`. Both were already available on the builder's machine. On another machine, install those versions with your preferred manager first.

```sh
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm check:env
pnpm dev
```

Visit `http://127.0.0.1:3000`. Public explanatory/demo pages can run without configured accounts. Live private workspaces require the existing Supabase configuration; optional AI and receipt writes have separate qualification/configuration gates.

For a local production preview:

```sh
pnpm build
pnpm start
```

Use `pnpm dev` for local account testing. A production build with configured accounts requires an HTTPS `APP_ORIGIN`; local HTTP OAuth settings are development-only. `pnpm verify:clean` builds an unconfigured copy without local credentials.

`GET /api/v1/health` reports application liveness and a generated request ID. It does not attest to database, provider, or worker readiness.

If the development browser repeatedly reloads with no edits, stop this app's development server, remove its generated `.next/dev` directory, and restart it. This recovered an observed stale Turbopack development-cache loop on 24 October. For a focused idle check, run `node scripts/check-dev-stability.mjs http://127.0.0.1:3001` against the running server with files and browser tabs idle. It checks page loads, HMR reload/rebuild messages and runtime errors; it does not exercise accounts, AI or publication.

## Configuration

When a consuming phase needs services, copy `.env.example` to the ignored `.env.local`, then enter values securely. Keep `AI_ENABLED=false` and `LEDGER_ENABLED=false` until their integrations/configuration are ready. Blank optional fields are unconfigured, never fake defaults.

The web environment rejects signer material and unapproved `NEXT_PUBLIC_` variables. A configured Supabase pair also needs a quota HMAC secret of at least 32 characters. AI uses strict server-only `AI_POLICY_JSON`; enabled web AI rejects the four old model fields and requires qualified role routes and complete budgets. Account-backed production capabilities require an HTTPS `APP_ORIGIN`; the free-development AI profile cannot run in production. Configuration validation does not establish model quality.

The separate `.env.worker.example` is for M09. Copy it to `.env.worker.local` only when preparing the worker, and keep it out of the web host. `pnpm check:env --target worker` intentionally fails until the worker is enabled and all required settings exist. M09 implements the worker/deployer; they run separately from the web app.

Configuration errors list field names without values. Keep keys and wallet recovery material out of chat, source, logs, and model prompts. Both real environment files are ignored by Git.

## Current checks

```sh
pnpm lint
pnpm contracts:test
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

- Lint includes transitive client-import/environment checks and a domain purity check that rejects outside imports and direct ambient clock/network operations. Server configuration also uses Next's `server-only` marker; the worker wrapper imports Node-only APIs.
- Typecheck generates Next route types and checks web/tooling plus contract configuration/tests.
- Unit/component tests cover the foundation plus domain schemas, timezone/DST rules, full-window coverage, integer energy/carbon math, optimizer reference cases and updated-result states. Fixed-seed property tests exercise 2,300 generated cases. M05 also tests manual form/review, API validation, retry/expiry, zero estimates and dashboard paging. This is scoped acceptance evidence, not completed F01–F12 product acceptance.
- Isolated database tests require PostgreSQL 17 server tools (`initdb`, `pg_ctl`, `pg_config`). On macOS, `brew install postgresql@17` supplies them; use `CARBONSHIFT_PG_BINDIR` if its bin directory is outside PATH. The runner creates/removes only its own temporary cluster and never resets the hosted project. CI uses a dedicated empty loopback PostgreSQL service and refuses a nonempty database.
- Contract tests compile the product `ShiftReceipt` plus the separate tooling fixture on isolated local EVMs. They exercise commitment/revision guards, two-step ownership and full portable bundle verification against real local reads/events. They use pinned solc 0.8.37, optimizer 200 and Cancun; no testnet access or wallet key is needed. The `proof` network chain ID is a local simulation, not Sepolia RPC.
- Browser tests use a production build on `127.0.0.1:3100`, start/stop their own server, and cover the shell and account/error states at 360/768/1440 px. The isolated browser server clears database credentials; real OAuth is verified separately. M05 adds reviewed manual demo/keyboard/zoom/table/error checks. The demo makes no network mutations; real saves are checked separately. M02 additionally bundles the real domain modules in memory and checks London/DST handling in an India-timezone browser and exact browser/server calculation agreement. No test route is added to the app. Run `pnpm build` first. Results are in ignored `test-results/` and `playwright-report/`.

Run a fresh-copy reproduction without copying secrets, dependencies, or build artifacts:

```sh
pnpm verify:clean
# Include the production-browser suite after installing Chromium:
pnpm verify:clean --browser
```

It runs the strict frozen install, environment check, lint/boundaries, local contract test, both typechecks, unit/component tests, and production build in a temporary directory, then removes only that directory. Browser checks are separate. Tests make no paid API calls.

The GitHub workflow runs foundation/domain and isolated database checks, with a digest-pinned PostgreSQL service. Its actions are pinned to public upstream commit references. The source repository is [z-lovejeet/CarbonShift](https://github.com/z-lovejeet/CarbonShift); `origin` uses its HTTPS URL. Source publication is separate from application deployment and hosted CI verification. Generated Next declarations (`next-env.d.ts`) are ignored and recreated by `dev`, `build`, or `typecheck`. Automatic framework edits to repository agent guidance are disabled with `agentRules: false`.

## Continue development

Read [repository guidance](AGENTS.md), the [documentation index](docs/README.md), and [current status/handoff](docs/decisions-and-status.md). The user requires all fourteen numbered documents to be read at each phase start. The [roadmap](docs/13-development-roadmap-and-codex-tasks.md) owns task scope and exit gates.

M00–M09 remain historical evidence for their scoped v1 implementation. U34 authorizes X01–X05 and revised local M10; U35 requests completing implementation before one combined verification pass. M06 retains its manual-first experimental release policy. The builder deferred the optional M05 usability review. Dedicated Sepolia/RPC access and real publication are verified at G09. Detailed ownership and timing are in the [manual setup guide](docs/14-manual-setup-guide.md).

AI tools are explicit operator commands, excluded from ordinary tests/CI:

```sh
pnpm ai:access
pnpm ai:maintenance
pnpm check:ai-flow
pnpm ai:evaluate --model openai/gpt-oss-120b --dataset development
pnpm ai:evaluate-explanation --model openai/gpt-oss-120b
```

The evaluation examples above are dry runs and make no inference requests. Live mode additionally requires matching human-review receipts, a verified free policy, `--live` and a finite request budget (default one). `ai:smoke` deliberately makes at most one admitted access/schema request and never qualifies a role. Maintenance previews counts; `--apply` runs the documented operational retention cleanup. No automatic evaluation continuation is configured. The M11 daily retention cron is declared in vercel.json; its deployment and first invocation require verification. See [M06 evidence](research/phase-6/README.md).

## Domain interfaces

`src/domain/scheduling.ts` takes confirmed constraints, a validated snapshot and supplied snapshot references, plus an explicit UTC clock. It returns a frozen comparison. `src/domain/results.ts` takes the accepted comparison and report/snapshot inputs and returns an updated estimate projection. Neither fetches data, persists records, controls appliances or calls a model. Both reject invalid inputs; missing actual factors remain unavailable.

`src/domain/time.ts` owns London disambiguation and UTC arithmetic; `profile.ts` converts decimal kWh text exactly to Wh and allocates the assumed energy bins; `carbon.ts` uses exact integer intermediates with one final rounding step. Shared schemas and `method.ts` define the versioned contracts/constants for later consumers.

The authored fixtures in `src/fixtures/demo/` are explicitly synthetic, with a fixed demo clock and a test reference that is **not** a computed digest or chain proof. Domain modules cannot import fixtures. Live handlers must supply a server clock and real snapshots; a fixture is never an outage fallback. M08 canonical proof goldens are separate, explicitly authored tests in `src/test/fixtures/proof/`.

To reproduce the local, synthetic scheduler benchmark:

```sh
pnpm exec tsx scripts/benchmark-domain.ts
```

It measures 200 comparisons after 20 warmups for each of the 30- and 180-minute profiles over the full horizon, including validation. It reports hardware/runtime and local timing only, with no service latency or achieved climate-impact claim.

## Grid integration

`src/server/grid/index.ts` is the server-only live entry point. `getForecast({fromUtc,toUtc})` requires aligned UTC bounds and complete forecast coverage; `getActual({fromUtc,toUtc})` expands minute bounds to grid intervals and preserves missing actual data. Both use fixed national provider endpoints and return immutable snapshot records with truthful source/retrieval metadata, server IDs, storage digests and attribution. M04 persists snapshots with their private comparisons; public JCS proof hashing is implemented separately in M08.

The process-local cache retains up to 32 records for five minutes and coalesces identical in-flight requests. Reads use eight-second attempts, at most one transient retry and a twenty-second total deadline. Redirects, unexpected request fields, oversized/invalid responses, and incomplete forecast factors are rejected. An expired record or fixture never becomes a successful outage fallback.

Run the explicit public-feed check separately from offline tests:

```sh
pnpm check:grid
```

It retrieves a six-hour planning window and a completed historical range, and computes an example using explicitly illustrative energy. No key, account, paid provider, appliance operation or user-plan write is involved. The recorded fixture in `src/fixtures/grid/` is frozen historical replay evidence. `pnpm check:grid --capture` refuses to overwrite it; normal tests/CI never run a live grid read. Module contracts and failure policy are in [document 07](docs/07-api-and-integrations.md), with observed evidence in the status log.

## Accounts and private planning API

Open `http://127.0.0.1:3000/login` with the configured dev environment. Only Google/GitHub sign-in is offered. The login page links to your private plans. Open `/app/simulate` for an activity estimate, `/app/plan/new` for one or several tasks, or `/app/day/new` for a calendar-day routine. Confirm the energy basis and constraints, compare the visible baseline with proposed times, then review and save. Existing washing-only records keep their v1 renderer and method. The saved plan reloads at `/app/plans/{id}`; it does not start an appliance. `/demo` offers a persistent labeled, fixed-clock example and local preview without an account or live save. London scheduling is independent of the browser timezone. Repeated hours need an offset choice; energy uses exact decimal-to-Wh conversion. A recoverable failure keeps the draft in memory. Unsaved comparisons expire; uncertain save retries reuse the same key. Private API contracts and exact response fields are in [document 07](docs/07-api-and-integrations.md).

`pnpm check:planner` drives the normal protected manual journey on desktop/mobile with two temporary seeded users, real grid/DB calls, exact accepted payload checks, reload, ownership denials and automated comparison accessibility checks. It cleans up only its fixture users. Run it with `pnpm dev` available; ordinary tests/CI do not run it. This is functional verification, not a user study.

`pnpm check:accounts` explicitly checks the configured hosted **development** project plus the running loopback server. It creates two temporary Auth users, obtains legitimate sessions without sending email, exercises comparison/save/retry/concurrency/pagination and cross-user denials using real grid data, and removes only those temporary users. It does not target existing OAuth users. No fixture grid can enter this live command. This command is separate from normal tests and CI. Incremental migrations live in `supabase/migrations`; never reset the hosted database or push the local Auth config over dashboard provider settings.

The dated `research/phase-0/verify-readiness.py` is historical M00 evidence and intentionally rejects a scaffolded app. Do not use it as the current app test suite. Preserve all earlier research as background rather than a competing implementation specification.

## Private completion checks

`pnpm check:lifecycle` explicitly checks the loopback development app using temporary Auth members, a real manual forecast/save, future-report rejection, cancellation/history/retry, owner isolation and guarded private plan/account deletion. It checks mobile/desktop layout and axe, then removes only its temporary members. Provider-start redirects are real; callback identity tests are isolated and the deletion journey uses an explicitly injected signed fixture receipt. It does not claim a fresh human provider sign-in. A separate in-memory authored historical plan consumes live actual-grid factors; fabricated forecasts never enter the application database. See [M07 live evidence](research/phase-7/live-lifecycle.json). No AI or ledger call is made.

`pnpm lifecycle:maintenance` previews expired 24-hour private-command acknowledgements. Add `--apply` to prune expired acknowledgements; reports/results are untouched. Expired records cannot be replayed; physical removal happens on the next maintenance run. Schedule it during M11 operational setup.

## Local proof and contract checks

`src/domain/proof.ts` exports strict schemas, canonical JSON/hash functions, bounded bundle import/export and a pure verifier. It recomputes feasibility, the version-specific search result and integer updated estimates, recognizes the pinned method, and reports separate evidence states. Missing independent chain observations stay unavailable. Self-report and assumed energy remain limitations even when every content check matches.

`src/server/proof/` projects accepted private records into sanitized public manifests. It never copies private IDs, notes or raw prompts. Identity/nonce generation is server-only; M09 must persist these before preview and reuse identical bytes on retries. The builders do not grant consent or publish anything.

Run `pnpm contracts:test` for local contract/round-trip checks and stale-ABI protection; `pnpm test` includes the proof goldens/tamper checks. `pnpm proof:artifacts` deliberately regenerates the versioned ABI and build fingerprints after compiling; review their diff whenever contract code changes. Browser/server digest parity is part of `pnpm test:e2e`. This phase needs no wallet, RPC URL or paid provider. M09 implements public consent and the durable worker/RPC adapter. Public receipt/verifier pages now support explicit v1/v2 dispatch.


## Consented Sepolia publication

On a saved plan, choose **Review publication**, inspect the exact public fields and explicitly consent. The plan stays useful privately. Run `pnpm worker:ledger` separately to process queued operations; `pnpm ledger:reconcile` observes existing operations once without signing/rebroadcast. Status distinguishes queued, signing, submitted, confirmed, failed and uncertain. Every result needs separate consent; private corrections never publish automatically. A cancelled wash earns no numeric benefit.

The dedicated signer lives only in ignored `.env.worker.local`. Keep the ignored deployment journal for recovery. `pnpm contracts:deploy` defaults to preparation; only `--broadcast` sends a real testnet deployment. The verified contract is [ShiftReceipt on Sepolia](https://sepolia.etherscan.io/address/0xddc904b894669e4f00a3b4dfbaad58f90e9f7040). Local metadata is configured after actual bytecode/owner/block checks.

`pnpm check:publication` is the explicit real development/browser/testnet check, excluded from ordinary tests/CI. It uses temporary users, actual national forecasts, authored cycle energy, real consent/plan commitment and a separately disclosed cancellation result, exported-proof verification, retry/ownership checks and desktop/mobile inspection. It stops its worker and removes its temporary members while retaining the disclosed proof. [M09 evidence](research/phase-9/README.md) records actual outcomes and known limits.

The ordinary Groq explanation route/cache passed live during M09. Two Gemini timing requests hit the configured timeout and returned `AI_UNAVAILABLE`; this is an availability limitation, not a successful inference. Manual planning remains functional and timing assistance remains optional/experimental. No unevaluated fallback role or paid plan was enabled. These are historical M09 provider observations. Expanded Gemini Lite interpretation/explanation and the ordinary v2 endpoint/cache subsequently passed; the new Groq interpreter remains excluded after failed qualification. Revised local M10 public pages now work for both versions; deployment acceptance remains M11.

## Household implementation

`src/domain/activities/` owns strict activity/schedule/report schemas, exact mWh integration, feasible candidates, bounded joint search and report aggregation. Shared API contract files re-export those pure schemas. Domain code does not import UI, database, provider or server modules. V2 proof lives in `src/domain/proof/v2/`; `src/domain/proof/versions.ts` explicitly dispatches both formats.

The server owns profile lookup, source validation, owner checks, SQL transactions, consent and outbox writes. The worker retains persistence-before-broadcast and fencing for both methods. New private routine details never enter public exports without the exact preview/consent flow.

`GRID_PUBLIC_SUMMARY_ENABLED` enables cached home-page context. `LEDGER_HOUSEHOLD_ENABLED` enables verified local v2 publication writes; it is not a billing setting. These do not replace source, role or chain checks. Use `pnpm dev` with the configured local origin for free-development AI; public production eligibility remains a separate release decision.

The explicit live acceptance command is `pnpm check:household`. It uses the selected development project and dedicated Sepolia configuration, makes one bounded consented plan/result journey and keeps an ignored journal to prevent accidental duplicate commitments. It is excluded from normal tests/CI and must resume existing evidence rather than publish another test plan after a partial run.

Final local acceptance: 521 unit/component, 83 isolated SQL, 10 contract/adapter and 48 production-browser checks passed in the combined run; a subsequent three-case proof check pins the new v2 digests. Typechecks, lint/import boundaries and the production fixture build passed. These are software checks, not measured environmental benefits. Current local review uses port 3001 because another project occupies 3000. The local Site URL is now 3001 and both 3000/3001 callbacks are allowed; fresh human sign-in on the current origin remains to be checked. See [manual setup](docs/14-manual-setup-guide.md) before a fresh OAuth sign-in.

## M11 release status

Live application: [carbonshift-mocha.vercel.app](https://carbonshift-mocha.vercel.app). The existing **carbonshift** Vercel project deploys from GitHub `main`. The real simulator, private save/reload/ownership journey, consented Sepolia publication and seven browser proof checks passed on production. [Deployment evidence](research/release/deployment.json) and [status section 33](docs/decisions-and-status.md#33-m11-live-deployment-and-verified-production-journey) separate these results from the remaining human sign-in, Gemini billing/inference and screen-reader checks; G11 remains open.

`pnpm retention` previews eligible cleanup, while `--apply` removes eligible unpublished records in bounded batches. Vercel's daily maintenance endpoint requires `CRON_SECRET`; worker signing remains a separate process. Follow [the M11 manual steps](docs/14-manual-setup-guide.md#m11-github--vercel-release-preparation--25-october-2026) for environment separation, exact OAuth callbacks and the production AI profile.
