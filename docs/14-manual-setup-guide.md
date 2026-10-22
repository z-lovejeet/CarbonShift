# CarbonShift — manual setup guide for the builder

Version 1.7 · 22 October 2026 · M06 configuration/admission implemented; Groq and Gemini Lite smokes observed. Builder free limits/label approval and completed current-role evaluation recorded. G06 passed locally under the experimental/manual-first policy. No paid upgrade was made.

## 1. Division of work

You handle account ownership, login/verification, billing decisions, secure key entry, wallet recovery material, and any consented real-user testing. Codex can prepare configuration, migrations, integrations, tests, and deployment instructions once you authorize implementation.

You do not need an appliance integration, smart meter, sensor, carbon-credit registry, training dataset, or cryptocurrency purchase for the proposed software prototype.

Use a dedicated testnet wallet. Keep private keys and API keys in local/host secret stores rather than sending them through chat. Public wallet addresses and deployed contract addresses can be recorded in project documentation.

## 2. Setup checklist

| Step | Your action | Success evidence |
|---|---|---|
| S01 | Review PRD, method, receipt design, and scope decisions | Agreed baseline recorded in decision log |
| S02 | Arrange repository/account access | Codex can work in the intended local repository; remote access tested separately |
| S03 | Gemini key already entered locally; supply/check actual per-model and shared request/token limits | Access/schema smoke succeeds under recorded verified limits; populated key alone is not evidence |
| S04 | Groq key already entered locally; check organization limits and model access | Model list/strict-schema smoke succeeds under shared accounting |
| S05 | Create development Supabase project | Auth and database connection succeed; project URL identified |
| S06 | Configure Google/GitHub OAuth providers | Provider credentials, callback and audience settings permit real sign-in |
| S07 | Create dedicated Sepolia issuer wallet and obtain faucet ETH | Correct chain, funded test address, private key securely stored |
| S08 | Obtain Sepolia RPC access | Read reports chain ID `11155111` |
| S09 | Choose hosting account and permitted budget | Web deployment access confirmed; no surprise paid upgrade |
| S10 | Supply deployment contact and real-data choices | Privacy contact exists; example/profile assumptions reviewed |

S03–S08 can be prepared while Codex builds the manual UI/domain modules. Authenticated setup checks need the implementation or a small explicitly run smoke request; these have not been performed at M00. The separate public grid-feed readiness probe is recorded in the status log.

### When each manual step is needed

| Steps | Preparation window | Required before |
|---|---|---|
| S01 scope; S02 local repository access | M00 | G00; remote GitHub access is separate and can wait until needed for source publishing/deployment |
| S05 Supabase; S06 development OAuth | During M01–M03 | M04 real database/Auth checks; external OAuth sign-in is checked again at M11 |
| S03 Gemini; S04 Groq | Keys supplied before M06; account quota/profile evidence still due | M06 live smoke/evaluation; free tiers only unless paid spend is explicitly approved |
| S07 wallet/faucet; S08 RPC | During M07–M08 | M09 testnet deployment/publication; M08 local tests require no funded wallet |
| S09 hosting/budget | During M09–M10 | M11 external deployment checks |
| S10 privacy contact and input choices | Review input assumptions at M00; supply contact by M10 | Public invitation and finalized privacy page |

M00 records missing configuration without claiming the accounts do not exist. No API key or paid service is required to finish M00 or implement M01/M02 locally. Store secrets only in the ignored environment files/host settings prepared by Codex, never in this checklist.

M03 also requires no API key: `pnpm check:grid` performs a bounded public forecast/range read. Normal tests use isolated replay data and work without that feed. Before M04's integration gate, prepare S05/S06: an isolated Supabase project/local environment, project URL and appropriate keys entered securely into ignored `.env.local`, plus Google/GitHub provider and redirect settings. Do not paste credentials into chat. Local M03 success does not establish database/OAuth access.

## 3. Gemini

Open [Google AI Studio](https://aistudio.google.com/) and create/select a project and API key following the [official key guide](https://ai.google.dev/gemini-api/docs/api-key). Check account availability, permissions, billing, and the configured models from document 09.

Store the key as `GEMINI_API_KEY` in the local ignored environment file and later in the web host's server environment. Use the key explicitly through the server environment loader so another global Google key cannot accidentally take precedence.

For eligible local free development, use the ordered candidate pool `gemini-3.8-flash` → available/qualified `gemini-3.6-flash` → `gemini-3.5-flash-lite`, then Groq/manual recovery. Skipping a capped candidate is not another model call; actual failure fallback remains limited to two attempts/task. No Gemini 3.7 entry was found in the current catalog, and Argon has no free API tier. Every promoted candidate/role needs actual access/schema/quality evidence.

The builder reports 20 RPD for Flash and 500 RPD for **3.5 Flash-Lite**. Record a 17/day local Flash cutoff, proposed 425/day Lite ceiling, actual RPM/TPM/RPD/token-day limits and any sharing between models. The 3.6 allowance is unknown; do not invent 20 RPD for it. Verify reset boundaries and account free-tier status in AI Studio; a model list does not reveal all quotas. No key needs to be pasted again or sent through chat. [Official catalog](https://ai.google.dev/gemini-api/docs/models), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

Keep `AI_ENABLED=false` until model roles qualify. M06 migrated the four legacy fields to validated `AI_POLICY_JSON`, preserving provider/Supabase credentials and disabled startup. Flash is disabled after transient live access failures; 3.6 stays disabled with unknown limits. Lite and Groq are the M06 evaluation pool. Completed current-role evidence permits Lite experimental timing, Groq explanation and Lite explanation recovery in local development; see 09 and the status log. Other models/roles stay excluded. `pnpm ai:access` successfully read the authenticated catalogs; this does not verify Gemini inference or quotas. Unknown quotas never mean unlimited. The detailed policy belongs to document 09.

The PRD targets GB adults, and Google's current terms require Paid Services for API clients available to users in the UK, EEA or Switzerland. Free Gemini is therefore an eligible-development option, not a promised free UK launch configuration. Resolve explicitly approved paid access or an approved Groq-only public profile before deployment; do not silently enable billing or alter the two-provider scope. Use authored non-personal examples for unpaid evaluation because its data-use terms differ. [Official pricing](https://ai.google.dev/gemini-api/docs/pricing), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [terms](https://ai.google.dev/gemini-api/terms).

Set billing alerts and a budget you are comfortable with. An alert may not be a hard spending cap; the app also enforces request limits. Do not assume a model is free because an API key can be created.

## 4. Groq

Open [Groq Console](https://console.groq.com/) and follow the [official quickstart](https://console.groq.com/docs/quickstart). Create a key and store it as `GROQ_API_KEY`.

Check the account's available models and access to `openai/gpt-oss-120b`. Run one strict-schema response. Record latency/usage and response validity; do not rely only on the catalog.

Keep the account on its intended free plan. `openai/gpt-oss-20b` is a production strict-schema efficiency candidate to evaluate during M06. The public free table lists 30 RPM, 1,000 RPD, 8,000 TPM and 200,000 TPD for each GPT-OSS model; inspect actual organization limits rather than assume all accounts match. No paid upgrade is required by this research. [Free limits](https://console.groq.com/docs/rate-limits), [structured output](https://console.groq.com/docs/structured-outputs).

`qwen/qwen3.8-27b` is an optional preview evaluation candidate in this draft, not the default production pin. Any model change requires an entry in the decision log and re-evaluation.

Set available provider spending controls and alerts. Keep public demonstration mode free of paid requests.

Shared quota accounting also applies to explicit evaluation. A 60-example Flash sweep at 17/day takes at least four quota days before extra calls; gold-label review and per-model evidence remain required. Codex can complete local work while waiting, but cannot claim G06 passed without required live evidence or use paid requests merely to accelerate it.

## 5. Supabase and Google/GitHub OAuth

Create a development project in [Supabase](https://supabase.com/). Record the project URL and distinguish the publishable key from the privileged secret key. [Official key guide](https://supabase.com/docs/guides/api/api-keys)

Codex will create migrations/RLS policies and apply them to the selected development project after implementation authorization. Use a separate local/test database or isolated project for destructive tests. Do not run reset commands against the deployed project.

Enable Google and GitHub, disable Email, and configure each provider with the Supabase callback `https://<project-ref>.supabase.co/auth/v1/callback`. The local Site URL is `http://127.0.0.1:3000`; allow `http://127.0.0.1:3000/auth/callback`. Add exact deployment redirects later. Test both providers end to end; configuration flags alone do not prove sign-in. [Google](https://supabase.com/docs/guides/auth/social-login/auth-google) and [GitHub](https://supabase.com/docs/guides/auth/social-login/auth-github).

Provider client secrets stay in Supabase settings. Ensure any Google audience restrictions permit the test accounts. Two distinct Supabase users are required for ownership tests; signing in through two providers can link to one user. No SMTP or password-recovery setup is required for this OAuth-only product. The development project and local administration credentials were prepared in the status log; M04 populated the ignored application environment, applied incremental migrations, checked hosted API/RLS behavior and obtained builder confirmation that both providers signed in and signed out successfully. S05/S06 are complete for local development; M11 must repeat provider checks with deployment URLs.

## 6. Sepolia wallet and RPC

Create a separate wallet exclusively for the prototype. Secure recovery material outside the repository. Copy only its public address into the setup record.

Use an eligible faucet linked from the [Ethereum networks page](https://ethereum.org/developers/docs/networks/). Faucet availability and eligibility vary. If one requires mainnet holdings, use another legitimate eligible option; do not buy assets merely to satisfy this guide.

Get an RPC URL from a provider supporting Sepolia. Read the chain ID before deployment. Test ETH has no intended real monetary role in CarbonShift.

The signer belongs only in the ledger worker's environment. The Vercel web app does not need it. After local contract tests pass, Codex can deploy to the explicitly selected testnet as part of the authorized build and record the actual address, deployment block, transaction, compiler settings, and owner.

## 7. Environment-variable inventory

| Variable | Location | Meaning |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/server | Project endpoint |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/server | Public application key protected by RLS |
| `SUPABASE_SECRET_KEY` | Server/worker | Privileged credential; never browser |
| `GEMINI_API_KEY` | Server | Gemini authentication |
| `GROQ_API_KEY` | Server | Groq authentication |
| `AI_POLICY_JSON` | Server/operator CLI | Strict version-1 registry order/profile/qualification/shared-budget policy; old model fields are rejected when web AI is enabled |
| `AI_ENABLED` | Server | Explicit true/false; manual mode works when false |
| `SEPOLIA_RPC_URL` | Server/worker | Allowlisted chain access |
| `LEDGER_PRIVATE_KEY` | Worker only | Dedicated issuer signing key |
| `LEDGER_CHAIN_ID` | Server/worker | `11155111`; reject any other network |
| `LEDGER_CONTRACT_ADDRESS` | Server/worker | Real address after deployment; absent means unavailable |
| `LEDGER_DEPLOYMENT_BLOCK` | Server/worker | Verified deployment block for event lookup |
| `LEDGER_ENABLED` | Server/worker | Controls publication; does not fabricate confirmations |
| `APP_ORIGIN` | Server | Exact local/deployed origin used for redirects and origin validation |
| `RATE_LIMIT_HMAC_SECRET` | Server | Random secret for short-lived quota identities |
| `TRUSTED_CLIENT_IP_HEADER` | Server | Unset locally; only an explicitly verified hosting proxy header may supply the broader IP throttle |
| `PRIVACY_CONTACT` | Server-rendered public content | Actual operator contact supplied by you |

Server code exposes only deliberately public chain metadata, never the RPC credential or private key. The M06 loader validates the single routing policy and code-owned registry; arbitrary model/provider destinations are rejected. Never set qualified roles merely because a smoke succeeded.

M01 generated `.env.example` for the web app and `.env.worker.example` for the later ledger worker. M04 securely populated ignored `.env.local` with the development project URL, publishable/secret keys and generated HMAC secret; it has owner-only permissions. The separate ignored `.env.supabase.local` holds CLI administration settings. `.env.worker.local` remains absent/unconfigured. The web template contains no signing credential. The local app origin defaults to `http://127.0.0.1:3000`; use that same browser origin/callback configuration when preparing M04. Production account-backed capabilities require an explicit HTTPS origin.

## 8. Local readiness checks

After the scripts exist, Codex should run the environment check, isolated migrations, domain tests, and production build. It should summarize presence/validity of configuration without printing values.

You should personally complete: sign up/login → confirm task fields → compare → save → report → review publication preview. Try a request that cannot fit the deadline and confirm the app explains why.

Use clearly authored data until you choose to provide real inputs. No physical washer operation is needed for the software demo, and a simulated operation must remain labeled.

### M04 verified local workflow

Use `pnpm dev` and `http://127.0.0.1:3000/login` for the configured local OAuth flow. `pnpm check:env` reports configuration presence without showing values. `pnpm test:integration` needs PostgreSQL 17 server tools; on this machine `pg_config` resolves the installed PostgreSQL 17.10 binaries. On another macOS machine use `brew install postgresql@17` and set `CARBONSHIFT_PG_BINDIR` to its bin directory if necessary. The runner owns a new temporary cluster and does not connect to the hosted database. Docker is not required for these local SQL tests.

Supabase CLI is `2.121.0`. Local CLI config is linked to the development project; `supabase/.temp` and `.branches` stay ignored. Review `supabase db push --dry-run` before a non-destructive migration push. The linked CLI can use the securely stored `SUPABASE_DB_PASSWORD`; keep it in the process environment rather than command-line arguments. Do not run `db reset` on hosted data or `supabase config push`: local `config.toml` is not the authority for configured hosted OAuth secrets. After schema changes, regenerate `src/server/db/database.types.ts` with `supabase gen types --linked --lang typescript --schema public --agent no` and typecheck the consumers.

`pnpm check:accounts` is the explicit hosted dev/API smoke check described in document 12. It needs the local server running and temporarily creates/removes only its own test Auth users. Ordinary unit/browser/SQL tests need no hosted keys. Production builds with configured accounts enforce HTTPS `APP_ORIGIN`; use `pnpm verify:clean` for an offline build or an actual HTTPS deployment origin for production. The build-only reserved origin used in M04 evidence is not a usable sign-in/deployment URL.

No additional key was needed for M05. Both model keys were accepted for catalog reads. Groq extraction/explanation smokes passed under the builder-confirmed free tier; account headers confirmed 1,000 RPD and 8,000 TPM. RPM/TPD come from the supplied Free Plan table, with account overrides/sharing still requiring attention. Gemini minute/token limits are supplied; exact bucket sharing remains unverified and is conservatively pooled as documented in 09. Login/mutation throttling uses the existing Supabase database/HMAC secret; production proxy coverage remains M11. The builder deferred the M05 review. Local eligible-development AI is enabled only for the evaluated roles; timing remains experimental/manual-first. Ledger remains disabled.

### M06 operator evaluation and remaining human inputs

The [label review](../research/phase-6/example-label-review.md) lists authored timing requests and their expected answers. The builder explicitly approved the labels on 22 October; matching `review-development.json`, `review-holdout.json` and `review-explanation.json` receipts are recorded beside this file. Future changed datasets require a new actual review and a separate receipt containing exactly `datasetSha256`, `reviewedBy` and `reviewedAtUtc`, using the displayed file hash and actual reviewer/time. Do not invent approval. Development, holdout and explanation checks have separate hashes/receipts.

`pnpm ai:evaluate --model openai/gpt-oss-120b --dataset development` and `pnpm ai:evaluate-explanation --model openai/gpt-oss-120b` are dry runs by default. For live evaluation add `--live --review /absolute/path/to/receipt.json --max-requests 1`; use `--case` for one case or `--start-at` for an inclusive dataset continuation. `--interval-ms` optionally paces sequential calls, capped at 60,000 ms; it never waits/retries across an admission failure or daily reset. Every dispatch reserves shared limits. The runner stops on failure/limits and never continues across days or promotes a model automatically. Review reports under `research/phase-6/results/`; do not interpret a partial run as a full score.

`pnpm ai:smoke --model openai/gpt-oss-120b --role explanation` is an explicit one-request access/schema check, using the bootstrap rule in document 09; it is not an accuracy evaluation. Gemini 3.6 commands still refuse the disabled candidate. Smoke success establishes access/schema only, never role accuracy. Keep 17/day for Flash and the global 200/day ceiling.

`pnpm ai:maintenance` previews expired operational counts without changing data. `pnpm ai:maintenance --apply` performs the documented cleanup, preserving unexpired quota reservations. AI task admission also prunes expired operational state. No retention scheduler is configured; the operator must run maintenance while the app is idle. Future completion/publication cleanup remains in its owning phases.

## 9. Essential deployment steps

This section retains basic deployment setup after your removal of a standalone operations document.

1. Connect the chosen Git repository to the web host, with the correct branch/project root.
2. Add server/public variables to the intended environment; keep the ledger key out.
3. Apply reviewed migrations to the target Supabase project.
4. Set exact Auth callback and application origin URLs.
5. Build/deploy and verify the actual public URL in a fresh browser session.
6. Start `pnpm worker:ledger` on the configured computer for testnet publication; confirm only one instance holds the lease.
7. Publish a clearly labeled example, wait for actual confirmation, and verify its exported bundle.
8. Stop the worker temporarily: UI must show queued/unavailable publication while planning still works.

Vercel environment changes are managed separately by environment and require the appropriate redeployment to affect application code. [Official environment-variable documentation](https://vercel.com/docs/environment-variables)

A laptop worker stops processing if the machine sleeps or loses connectivity. For unattended publication, move the same worker to an approved persistent host and rerun restart/secret checks. Do not advertise always-on publication until that is established.

## 10. Your review inputs and budget

Supply an actual operator contact before public use, choose whether to use real estimated appliance energy or authored examples, and decide whether anyone can provide user/reviewer feedback. No partner has been contacted.

A provisional incremental spending ceiling of ₹5,000 can be used only if you accept it; it is not a vendor price estimate, authorization to purchase, or guarantee of sufficiency. Existing Codex subscriptions are separate from application API usage.

Record actual selected service plans and limits. If access/cost prevents a required integration, change the configuration transparently and preserve a useful manual path.

### M07 local operation and next phase boundary

No additional key or account setup is needed for M07. The existing callback allowlist is unchanged: recent identity confirmation uses signed HttpOnly intent/receipt cookies and the normal same-account Google/GitHub PKCE exchange. To delete a private plan, open Account settings, confirm with the same provider account, and return to the plan within ten minutes. Account deletion additionally requires explicit acknowledgement. This deletes CarbonShift private history, not the connected Google/GitHub account.

`pnpm check:lifecycle` creates/deletes temporary fixture members; its receipt injection and authored historical in-memory comparison are labeled test evidence, not a human OAuth sign-in or appliance measurement. `pnpm lifecycle:maintenance` previews expired command acknowledgements; `pnpm lifecycle:maintenance --apply` removes only expired acknowledgements. Expiry blocks replay at 24 hours; physical cleanup runs when invoked. M11 must schedule retention. M08 builds local proof/contract code and needs no funded testnet signer; G-CHAIN is due for M09. Public UK AI routing and operator privacy contact remain deployment decisions.
