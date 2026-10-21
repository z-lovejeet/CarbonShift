# CarbonShift — manual setup guide for the builder

Version 1.0 · 20 October 2026 · Preparation instructions; no accounts, keys, infrastructure, or purchases were created by writing this guide.

## 1. Division of work

You handle account ownership, login/verification, billing decisions, secure key entry, wallet recovery material, and any consented real-user testing. Codex can prepare configuration, migrations, integrations, tests, and deployment instructions once you authorize implementation.

You do not need an appliance integration, smart meter, sensor, carbon-credit registry, training dataset, or cryptocurrency purchase for the proposed software prototype.

Use a dedicated testnet wallet. Keep private keys and API keys in local/host secret stores rather than sending them through chat. Public wallet addresses and deployed contract addresses can be recorded in project documentation.

## 2. Setup checklist

| Step | Your action | Success evidence |
|---|---|---|
| S01 | Review PRD, method, receipt design, and scope decisions | Agreed baseline recorded in decision log |
| S02 | Arrange repository/account access | Codex can work in the intended local repository; remote access tested separately |
| S03 | Create/select Gemini API project and key | Small structured request succeeds for the configured model |
| S04 | Create/select Groq project and key | Model list and small strict-schema request succeed |
| S05 | Create development Supabase project | Auth and database connection succeed; project URL identified |
| S06 | Configure email authentication/delivery | A permitted test user receives confirmation and password recovery |
| S07 | Create dedicated Sepolia issuer wallet and obtain faucet ETH | Correct chain, funded test address, private key securely stored |
| S08 | Obtain Sepolia RPC access | Read reports chain ID `11155111` |
| S09 | Choose hosting account and permitted budget | Web deployment access confirmed; no surprise paid upgrade |
| S10 | Supply deployment contact and real-data choices | Privacy contact exists; example/profile assumptions reviewed |

S03–S08 can be prepared while Codex builds the manual UI/domain modules. Authenticated setup checks need the implementation or a small explicitly run smoke request; these have not been performed at M00. The separate public grid-feed readiness probe is recorded in the status log.

### When each manual step is needed

| Steps | Preparation window | Required before |
|---|---|---|
| S01 scope; S02 local repository access | M00 | G00; remote GitHub access is separate and can wait until needed for source publishing/deployment |
| S05 Supabase; S06 development email auth | During M01–M03 | M04 real database/Auth checks; reliable external email delivery is checked again at M11 |
| S03 Gemini; S04 Groq | During M04–M05 | M06 live smoke tests/evaluation, with a chosen usage budget |
| S07 wallet/faucet; S08 RPC | During M07–M08 | M09 testnet deployment/publication; M08 local tests require no funded wallet |
| S09 hosting/budget | During M09–M10 | M11 external deployment checks |
| S10 privacy contact and input choices | Review input assumptions at M00; supply contact by M10 | Public invitation and finalized privacy page |

M00 records missing configuration without claiming the accounts do not exist. No API key or paid service is required to finish M00 or implement M01/M02 locally. Store secrets only in the ignored environment files/host settings prepared by Codex, never in this checklist.

## 3. Gemini

Open [Google AI Studio](https://aistudio.google.com/) and create/select a project and API key following the [official key guide](https://ai.google.dev/gemini-api/docs/api-key). Check account availability, permissions, billing, and the configured models from document 09.

Store the key as `GEMINI_API_KEY` in the local ignored environment file and later in the web host's server environment. Use the key explicitly through the server environment loader so another global Google key cannot accidentally take precedence.

Confirm access to `gemini-4-argon` and `gemini-3.8-flash` using tiny structured-output requests. If the account cannot access a model, record the failure code without revealing credentials and update routing deliberately.

Set billing alerts and a budget you are comfortable with. An alert may not be a hard spending cap; the app also enforces request limits. Do not assume a model is free because an API key can be created.

## 4. Groq

Open [Groq Console](https://console.groq.com/) and follow the [official quickstart](https://console.groq.com/docs/quickstart). Create a key and store it as `GROQ_API_KEY`.

Check the account's available models and access to `openai/gpt-oss-120b`. Run one strict-schema response. Record latency/usage and response validity; do not rely only on the catalog.

`qwen/qwen3.8-27b` is an optional preview evaluation candidate in this draft, not the default production pin. Any model change requires an entry in the decision log and re-evaluation.

Set available provider spending controls and alerts. Keep public demonstration mode free of paid requests.

## 5. Supabase and email

Create a development project in [Supabase](https://supabase.com/). Record the project URL and distinguish the publishable key from the privileged secret key. [Official key guide](https://supabase.com/docs/guides/api/api-keys)

Codex will create migrations/RLS policies and apply them to the selected development project after implementation authorization. Use a separate local/test database or isolated project for destructive tests. Do not run reset commands against the deployed project.

Configure email/password authentication, local callback URL, and later the real deployment callback URL. Avoid broad production redirect wildcards. Test signup confirmation and recovery end to end. [Password authentication documentation](https://supabase.com/docs/guides/auth/passwords)

Verify the project's email delivery restrictions. If its built-in sender cannot deliver to intended external testers, configure a supported SMTP provider/account before inviting them. A successful login with your own address does not prove public onboarding works. Domain/email-provider charges require your own billing decision.

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
| `AI_CONSTRAINT_PRIMARY_MODEL` | Server | `gemini-4-argon` proposed pin |
| `AI_CONSTRAINT_FALLBACK_MODEL` | Server | `openai/gpt-oss-120b` on Groq |
| `AI_EXPLANATION_PRIMARY_MODEL` | Server | `openai/gpt-oss-120b` on Groq |
| `AI_EXPLANATION_FALLBACK_MODEL` | Server | `gemini-3.8-flash` |
| `AI_ENABLED` | Server | Explicit true/false; manual mode works when false |
| `SEPOLIA_RPC_URL` | Server/worker | Allowlisted chain access |
| `LEDGER_PRIVATE_KEY` | Worker only | Dedicated issuer signing key |
| `LEDGER_CHAIN_ID` | Server/worker | `11155111`; reject any other network |
| `LEDGER_CONTRACT_ADDRESS` | Server/worker | Real address after deployment; absent means unavailable |
| `LEDGER_DEPLOYMENT_BLOCK` | Server/worker | Verified deployment block for event lookup |
| `LEDGER_ENABLED` | Server/worker | Controls publication; does not fabricate confirmations |
| `APP_ORIGIN` | Server | Exact local/deployed origin used for redirects and origin validation |
| `RATE_LIMIT_HMAC_SECRET` | Server | Random secret for short-lived quota identities |
| `PRIVACY_CONTACT` | Server-rendered public content | Actual operator contact supplied by you |

Server code exposes only deliberately public chain metadata, never the RPC credential or private key. Model-provider assignment is fixed in the router and tested; changing a model string does not silently change providers.

M01 generated `.env.example` for the web app and `.env.worker.example` for the later ledger worker. Real `.env.local` and `.env.worker.local` files stay ignored and have not been populated by Codex. The web template contains no signing credential. The local app origin defaults to `http://127.0.0.1:3000`; use that same browser origin/callback configuration when preparing M04. Production account-backed capabilities require an explicit HTTPS origin.

## 8. Local readiness checks

After the scripts exist, Codex should run the environment check, isolated migrations, domain tests, and production build. It should summarize presence/validity of configuration without printing values.

You should personally complete: sign up/login → confirm task fields → compare → save → report → review publication preview. Try a request that cannot fit the deadline and confirm the app explains why.

Use clearly authored data until you choose to provide real inputs. No physical washer operation is needed for the software demo, and a simulated operation must remain labeled.

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
