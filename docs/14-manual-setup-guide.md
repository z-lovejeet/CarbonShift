# CarbonShift — manual setup guide for the builder

Version 1.9 · 23 October 2026 · M09 local credentials, incremental migrations and real Sepolia deployment/publication are verified. Current Gemini timing availability and public release decisions remain explicit limitations. No paid upgrade was made.

**U34 target revision · 23 October 2026:** the approved household expansion at the end of this document supersedes conflicting washing-only restrictions for new v2 work. Earlier sections retain v1 contracts and historical implementation evidence. New capabilities are not passed until recorded in status.

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

The signer belongs only in the ledger worker's environment. The Vercel web app does not need it. After G08 passes and the user authorizes M09, Codex can deploy to the explicitly selected testnet and record the actual address, deployment block, transaction, compiler settings, and owner.

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

M01 generated `.env.example` for the web app and `.env.worker.example` for the later ledger worker. M04 securely populated ignored `.env.local` with the development project URL, publishable/secret keys and generated HMAC secret; it has owner-only permissions. The separate ignored `.env.supabase.local` holds CLI administration settings. On 23 October, `.env.worker.local` was prepared with the existing Supabase project URL/secret key, Sepolia RPC and builder-entered dedicated signer. It remains ignored, untracked and owner-only. Authorized M09 subsequently configured the verified real contract address/deployment block and enabled the local ledger; both configuration checks now pass. The worker needs no publishable key or direct database URL for its planned Supabase API access. The web template contains no signing credential. The local app origin defaults to `http://127.0.0.1:3000`; use that same browser origin/callback configuration when preparing M04. Production account-backed capabilities require an explicit HTTPS origin.

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

## M08 local checks and M09 preparation

M08 needs no additional account, API key, wallet or RPC URL. Local proof/contract checks use synthetic data and an isolated EVM. The local network's chain ID 11155111 is deliberate test configuration; its deterministic addresses/transactions must never be copied into deployment configuration as Sepolia evidence.

After G08, S07/S08 are the next external prerequisites for authorized M09: a dedicated testnet issuer wallet with recovery material stored securely outside the repo, eligible faucet funds and Sepolia RPC access. Put signing credentials only in the ignored worker environment, never the web environment or chat. A public wallet address is safe to record. No M08 command deploys remotely, funds a wallet or generates recovery material. The existing evaluated product AI providers need no change for this phase.

On 23 October, read-only checks confirmed chain ID `11155111`, a native balance of **0.53 Sepolia ETH**, and that the worker key derives the builder's funded address `0x07084317B02a2fdc23F4E1bcA5749d849461A4E3`. The copied Supabase credentials passed a zero-row `profiles.user_id` API read (HTTP 200); this establishes credential/connectivity readiness, not future publication permissions or migrations. Those preparation checks performed no signature or deployment. M09 subsequently verified the real deployment and activated the local configuration, as recorded below. No additional key entry is needed for M10.

## M09 local operation

The actual verified Sepolia address/deployment block are now configured in both ignored environments; RPC access is available to the web reader and worker, while the signing key remains worker-only. Both environment checks can validate the activated configuration. Supabase migrations 008/009 are incremental; OAuth provider settings were preserved. No new key, wallet connection or cryptocurrency purchase is required.

Run `pnpm dev` for the local app and `pnpm worker:ledger` in a separate terminal for publication processing. Stopping the worker leaves private planning usable and publications queued. `pnpm ledger:reconcile` observes existing signed operations once without signing or rebroadcast. Keep `.ledger-deployment.local.json` for safe deployment recovery; never delete the journal to force another nonce. `pnpm contracts:deploy` defaults to preparation and `--broadcast` explicitly requests a real testnet transaction.

M10 adds public receipt/verifier/methodology/privacy pages. The operator privacy contact is still required before inviting real users; public UK AI profile/hosting/OAuth deployment decisions remain release gates. A configured local testnet ledger is not a public web deployment.

## Household expansion — U34 manual timing

No new mandatory API key, wallet, smart meter, paid subscription or crypto purchase is required for X01–X05. Reuse the configured development Supabase/OAuth, grid API, Gemini/Groq and dedicated Sepolia setup. Key presence is not a successful integration; Codex performs bounded checks when the consuming feature exists and never prints secrets.

| Before | Builder action | Codex work |
|---|---|---|
| X01 | Optional: provide your actual device/programme watts or kWh if you want personal estimates; manual input works without a manufacturer match | Review source records; calculate deterministic profiles; no universal appliance API is assumed |
| X02 live AI qualification | Review the small expanded expected-answer set when prepared; existing free limits remain | Implement/evaluate only candidates being enabled, preserve quotas and manual fallback |
| X03/X04 integration | Existing development project access is sufficient | Isolated SQL checks, incremental migration without reset, generated types, owner-safe save/report checks |
| X05 | Existing dedicated testnet signer/RPC/funds are sufficient if still available | Read current chain/balance, reuse compatible contract, bounded consented test record; no production funds |
| Revised M10/M11 | Supply real privacy contact; choose allowed public AI profile and hosting when concrete setup is ready | Prepare public pages and deployment configuration; no billing/publication by assumption |

When new pages are ready, user review should exercise a short appliance simulation, two-task comparison and mixed day. That user feedback is separate from automated checks. New live Gemini schema access may fail even when previous role access worked; this does not disable manual calculations. No request to paste keys or wallet recovery material is part of this expansion.

U35 implementation configuration: `GRID_PUBLIC_SUMMARY_ENABLED` controls the cached anonymous home-page GB context; `LEDGER_HOUSEHOLD_ENABLED` controls new v2 publication writes after its verification gate. These are server feature settings, not API keys or paid activation. Ordinary fixture browser checks disable both. Codex configures the existing local environment when the relevant verification succeeds; no new builder account step is required. The public receipt/verifier can still inspect already consented records while new publication is disabled.

The current local browser checks use `APP_ORIGIN=http://127.0.0.1:3001 pnpm dev --port 3001` because another project occupied port 3000. This is a process-local override; the original OAuth configuration has not been silently rewritten. Ordinary production-build/fixture checks clear account/AI/ledger credentials in their process. They do not activate a public free-Gemini profile.

### Final local household handoff — 24 October 2026

Migrations 010–013 are applied incrementally to the existing development project; types are regenerated. No new mandatory key or wallet step remains for local simulation/task/day planning. `GRID_PUBLIC_SUMMARY_ENABLED` and `LEDGER_HOUSEHOLD_ENABLED` are enabled locally after actual acceptance. The dedicated Sepolia contract was reused. Expanded Gemini Lite roles are locally qualified; the new Groq interpreter remains excluded, with manual/template recovery.

Use `pnpm dev` on the original configured port 3000 when it is free, with `pnpm worker:ledger` in another terminal for new consented publications. The current server on port 3001 is useful for local page review; a fresh Google/GitHub sign-in on that port has not been verified against the existing 3000 callback allowlist. Preserve the other project occupying 3000. Port/redirect selection should be explicit before fresh account review or deployment.

Before inviting public users, supply a real operator privacy contact and resolve the allowed public AI profile plus web/worker hosting and HTTPS/OAuth settings. Source publication and paid activation remain separate from this completed local build.

### Development browser reload loop — U38

On 24 October the existing Turbopack development cache repeatedly issued browser restart/reload messages even though source files were unchanged. Stop only CarbonShift's development server, remove the generated `.next/dev` directory, then restart with the same local origin and port. Regenerating that cache recovered the reported loop; a normal subsequent restart retained stability. Environment files, database records, wallet configuration and source files do not need resetting.

`node scripts/check-dev-stability.mjs http://127.0.0.1:3001` checks the running local homepage for ten idle seconds after initial compilation. Keep files/browser tabs idle during this focused diagnostic. It fails on unexpected document navigation, HMR reload/rebuild messages or page runtime errors, and requires a successful initial page response. It uses an isolated anonymous browser and creates no account, saved plan, AI request or chain transaction. This is specific evidence for U38; the remaining U37 screen review stays with the builder.

## M11 GitHub → Vercel release preparation — 25 October 2026

The builder selected privacy contact `lovejeet1225@gmail.com`, Vercel hosting and GitHub-based deployment from `z-lovejeet/CarbonShift`, branch `main`. The authenticated project is **carbonshift** in **z-lovejeet's projects**, root `.`, Next.js, Node 24.x. Its assigned domain is `carbonshift-mocha.vercel.app`; an assigned domain is not yet a successful deployment. The builder will connect the repository in the dashboard after the verified source batch is pushed. Keep the existing project rather than creating a duplicate. [Vercel GitHub deployment](https://vercel.com/docs/git/vercel-for-github).

1. Open the existing project's **Settings → Git**, connect `z-lovejeet/CarbonShift`, and use `main` for production. If GitHub permissions are requested, grant access to this repository.
2. Confirm root `.`, framework Next.js and Node 24.x. Repository configuration supplies frozen pnpm install and `pnpm build`; pnpm 10.34.4 is pinned in `package.json`.
3. Codex has prepared encrypted production environment entries for the existing credentials and selected flags; verify the actual deployment rather than importing a local file. Production environment must contain the existing Supabase public URL/publishable key and server secret, `RATE_LIMIT_HMAC_SECRET`, privacy contact, `CRON_SECRET`, selected AI keys/policy, grid flag and verified Sepolia read/publication metadata. Set `APP_ORIGIN=https://carbonshift-mocha.vercel.app` only for that verified project domain. Never upload `.env.worker.local`, `LEDGER_PRIVATE_KEY`, CLI administration passwords or Vercel login tokens to the web app. Local `.env.local` is not a deployment template to import wholesale.
4. Keep the current role qualifications and conservative application ceilings. The builder selected Gemini plus Groq and will enable Google billing; this promise is not evidence billing is already enabled. Vercel production is prepared with the selected `uk_public_paid_gemini` profile; the builder must fulfill the billing prerequisite before public Gemini use. Codex has not verified or activated billing. Do not disguise the local development profile as a production pass or activate unevaluated model roles. The existing router permits up to two admitted attempts, including eligible cross-provider fallback; quotas and qualification decide which candidates can actually run.
5. Add exact `https://carbonshift-mocha.vercel.app/auth/callback` to Supabase redirect URLs and set its Site URL to the production origin when deploying. Preserve local callbacks. Local Site URL now uses `http://127.0.0.1:3001`, with both 3000/3001 callbacks allowed; Google/GitHub remain enabled and Email disabled. Fresh human sign-in on the chosen current origin still needs verification.
6. Deploy the pushed revision, inspect its actual build result, then verify health, headers, both sign-in providers and the complete private/public journey. Environment changes need a new deployment to take effect. Verify the hosting proxy before setting `TRUSTED_CLIENT_IP_HEADER=x-vercel-forwarded-for`.
7. Run the dedicated ledger worker separately with `pnpm worker:ledger`. Vercel web requests/cron do not host that persistent signer process. Keep the computer awake while demonstrating queued publication. The interface's queued/submitted/uncertain states remain honest when the worker is unavailable.
8. Check the configured daily retention cron's invocation after deployment. `pnpm retention` previews cleanup; `--apply` mutates eligible records. The bearer cron secret belongs only in Vercel server settings.

The builder's later instructions explicitly authorize the Git commit/push batch and deployment preparation. Earlier no-publication statements describe historical boundaries, not the current instruction. No source publication proves G11 or authorizes spending beyond the separately chosen provider arrangement.
