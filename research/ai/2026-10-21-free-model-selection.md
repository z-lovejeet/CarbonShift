# CarbonShift — free model selection research

Checked 21 October 2026 (Asia/Calcutta), using official public sources. No authenticated provider request, account-limit inspection, model benchmark, purchase, or active application configuration change was performed. Recommendations below are engineering judgments for M06, not measured rankings or implemented behavior. The owning specification is [document 09](../../docs/09-ai-agents-models-and-workflow.md).

**22 October supersession note:** the initial routing recommendations below are historical research. The user subsequently requested quota-aware 3.8 → available/qualified 3.6 → 3.5 Flash-Lite selection, a 17/day Flash cutoff, login/submission protection and documentation alignment. Current policy/configuration/task contracts are in documents 09/11/13/14. No 3.7 entry was found; the reported 500-RPD Lite quota and other account limits remain unverified. Preserve this note as research rather than a competing current specification.

## Recommendation for CarbonShift

Evaluate **Gemini 3.8 Flash** and **Groq GPT-OSS 120B** first for the constraint interpreter. Both have published free-tier access and structured-output support, subject to actual account eligibility and limits. For eligible local development, propose Gemini first and Groq second; keep the explanation selector on Groq 120B with Gemini Flash as its one eligible fallback. The smaller GPT-OSS 20B and Gemini 3.5 Flash-Lite are evaluation candidates, not additional live attempts. A model's size, recency or provider benchmark does not prove CarbonShift extraction accuracy. Final promotion requires the reviewed 20-development/40-holdout evaluation in document 12.

For a **public UK-facing release**, free Gemini is not a viable default under the current terms described below. A Groq-only free release profile with manual/template fallback is a candidate, but it changes the current fixed two-provider routing and must be explicitly resolved in the owning scope/configuration specifications before implementation. Alternatively, obtain approval for paid Gemini. Do not silently change the requirement to integrate and evaluate both providers.

## Gemini candidates and free access

| Exact model ID | Observed status/access | Disposition |
|---|---|---|
| `gemini-3.8-flash` | Stable; structured output; standard text input/output has a free tier | First Gemini extraction candidate; evaluate accuracy and latency |
| `gemini-3.5-flash-lite` | Stable; structured output; standard text input/output has a free tier | Efficiency candidate for simple extraction or explanation codes |
| `gemini-3.6-flash` | Stable previous-generation Flash; standard text input/output has a free tier | No need to add it to the initial evaluation while current Flash is available |
| `gemini-4-argon` | Stable flagship; no free API tier | Remove from the proposed free development configuration |

These are API pricing observations, not deductions from free AI Studio chat access or temporary credits. [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Flash capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [Flash-Lite capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).

Gemini's public rate-limit page directs developers to their active AI Studio limits rather than promising universal per-model free quotas. Limits are per project, not per key, and cover requests/minute, input tokens/minute and requests/day. Daily request quota resets at midnight Pacific time. Do not invent a numeric Flash allowance or treat multiple keys in the same project as extra quota. [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

Gemini structured output uses a JSON Schema subset. Local validation must enforce all bounds and source-span/date semantics; the provider can ignore unsupported schema constraints. Current Flash supports thinking levels low/medium/high; `minimal` is unsupported. Start with a supported setting and measure truncation/latency rather than assume a low token cap is sufficient. [Structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Flash model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)

## Gemini free-service constraints relevant to this product

Google's current terms say only Paid Services may be used when making API clients available to people in the EEA, Switzerland or UK. CarbonShift's primary audience is adults in Great Britain, so free Gemini must not be promised for that release. A GB scheduling timezone does not establish a user's location. Keep this as an explicit deployment decision, not a browser-only region check. [Gemini terms, Use Restrictions](https://ai.google.dev/gemini-api/terms)

For unpaid use outside the regional exceptions described in those terms, inputs/responses can be used to improve products and reviewed by people; Google says not to submit sensitive, confidential or personal information. Use authored examples during free development/evaluation, disclose provider processing, and preserve manual mode. Do not claim API providers share the app's seven-day metadata retention policy. Account/billing status affects applicable terms and must be verified separately. [Gemini terms, Unpaid/Paid Services](https://ai.google.dev/gemini-api/terms)

## Groq candidates and free access

| Exact model ID | Public catalog status | CarbonShift suitability |
|---|---|---|
| `openai/gpt-oss-120b` | Production | Main Groq candidate for constraint interpretation; preserve the existing proposed fallback role until evaluation |
| `openai/gpt-oss-20b` | Production | Smaller candidate for the bounded explanation-code selector, or a separately evaluated alternative interpreter |
| `qwen/qwen3.8-27b` | Preview | Evaluation candidate only; preview lifecycle makes it a poor default for the public demo |
| `llama-3.3-70b-versatile` | Enterprise / contact sales | Do not recommend as a verified free option |
| `llama-3.1-8b-instant` | Enterprise / contact sales | Do not recommend as a verified free option |

The current catalog distinguishes production and preview offerings; preview models may be discontinued at short notice. Both Llama entries now have an Enterprise label. Older lists describing those models as free should not override the current official catalog. [Groq supported models](https://console.groq.com/docs/models)

The following rows appear under the public **Free Plan Limits** table, rather than being inferred from paid token pricing:

| Model | RPM | RPD | TPM | TPD |
|---|---:|---:|---:|---:|
| `openai/gpt-oss-120b` | 30 | 1,000 | 8,000 | 200,000 |
| `openai/gpt-oss-20b` | 30 | 1,000 | 8,000 | 200,000 |
| `qwen/qwen3.8-27b` | 30 | 1,000 | 8,000 | 200,000 |

These are published baseline ceilings, not verified entitlements for this account. Groq applies limits at organization level; the first exhausted request/token limit wins. Exact organization limits must be read from its console. Some organizations additionally have separate input/output token limits. Cached tokens are excluded. [Groq rate limits](https://console.groq.com/docs/rate-limits)

## Structured output support

GPT-OSS 120B, GPT-OSS 20B and Qwen3.8-27B support JSON Schema with `strict: true`. All object properties must be required and objects must reject additional properties; nullable values represent unknown fields. Strict decoding controls response structure, not correct understanding of a deadline, source span or ambiguous date. Llama 3.3 is outside the listed strict-schema set; JSON object mode does not guarantee schema adherence. Streaming and tool use are currently unsupported with structured outputs. Retain local schema/semantic validation and explicit user confirmation. [Groq structured outputs](https://console.groq.com/docs/structured-outputs)

Both GPT-OSS models are reasoning models; choose an evaluated reasoning setting and sufficient output allowance rather than assuming every output token is final JSON. The 20B model page lists variable reasoning modes and positions the model for lower-latency workloads. This is provider documentation, not a CarbonShift latency result. [Groq GPT-OSS 20B](https://console.groq.com/docs/model/openai/gpt-oss-20b)

## Groq recommendation — engineering judgment, pending evaluation

- Keep **GPT-OSS 120B** as the main Groq interpreter candidate. Strict schema support and production status fit the existing contract. Parameter count alone does not establish superior extraction accuracy.
- Evaluate **GPT-OSS 20B** as the one additional Groq candidate, particularly for selecting a few explanation codes. Start the release with the existing 120B explanation pin unless the evaluation supports changing it. Do not add 20B as an automatic third live call behind Gemini and 120B: the current specification permits at most two calls per AI task.
- Do not infer that changing Groq models escapes an organization-wide rate limit. A smaller model may reduce token use, but fallback eligibility must inspect the actual exhausted bucket and available capacity.
- For explanation selection, a deterministic template is already a complete valid fallback. If AI adds no useful benefit, prefer that path over spending more free quota.

These are recommendations for later M06 implementation, not implemented behavior or proven model rankings.

## Provider rate-limit signals

On HTTP 429, Groq supplies `retry-after` in seconds. Request-limit headers refer to **daily requests**, while token-limit headers refer to **tokens per minute**; corresponding remaining/reset headers identify those same windows. Other rate-limit headers are normally included even without a 429. [Groq rate-limit headers](https://console.groq.com/docs/rate-limits)

For CarbonShift, a bounded router should reserve token/request capacity before dispatch, apply cooldowns from the actual response, avoid concurrent duplicate attempts and stop at its total deadline. These application design recommendations complement the existing five-per-minute/user, twenty-per-day/user and 200-provider-calls/day starting caps; those caps alone cannot protect a shared TPM bucket.

## Data and spending controls

Groq normally retains usage metadata separately from inference content. Content may be retained for reliability/abuse investigation or persistence features; relevant logs can last up to 30 days. Its documentation says all customers can enable Zero Data Retention in Data Controls, disabling features that require persistence. This setting has not been checked for the user's organization. Send only the minimum allowed timing text or result codes and keep raw prompts out of application logs. [Groq data controls](https://console.groq.com/docs/your-data)

Groq's configurable spend-limit feature requires a paid account with organization-owner permissions. Its documented spend tracking has a 10–15 minute delay, so the limit should not be presented as an exact zero-overspend guarantee. This project has no authorization to upgrade; preserve the user's chosen free-tier-only policy unless they explicitly change it. [Groq spend limits](https://console.groq.com/docs/spend-limits)

## Outstanding before live use

Verify the account-visible model list, actual free plan and limits, compatible request schema, latency, token consumption, truncation/refusal handling, and accuracy on the separately reviewed development/holdout examples. Never treat a public catalog entry or a successful model-list request as successful task evaluation.

## Proposed fallback and quota implementation for M06

The following is an application design recommendation, not a statement about implemented code or provider guarantees.

1. Authenticate and check explicit AI consent, server-origin/body limits and the current supported deployment profile. Validate input before reserving capacity. Public fixture demo never calls a model.
2. Atomically admit a logical AI task in Postgres: retain 5 tasks/minute and 20/day per user. Track the two roles against shared user budgets, and count every outgoing provider attempt against the application-wide 200/day cap. A fallback is a second provider attempt, not a free retry. Rejected authentication or invalid input consumes no provider call.
3. Before each dispatch, reserve capacity for the applicable provider/project-or-organization/model request and token buckets. Use account-observed limits, conservative token estimates and output caps; reconcile usage where returned. When usage is unknown after timeout, keep a conservative charge until its window expires. Missing quota configuration must not mean unlimited access. Initial concurrency: one active AI task/user and at most two active provider requests/application, enforced with expiring database leases rather than process memory alone.
4. For eligible local-development interpretation: `Gemini 3.8 Flash -> Groq GPT-OSS 120B -> manual fields`. For explanation: `Groq GPT-OSS 120B -> Gemini 3.8 Flash -> deterministic templates`, but only while a Gemini call is permitted and enough request/token/time budget remains. Do not create a third model attempt by adding Flash-Lite/20B. The free UK release-profile decision above remains unresolved; current code does not support provider-swapped routing just by editing a model ID.
5. Preserve the existing 12-second primary/22-second overall interpreter and 6-second primary/12-second overall explanation budgets. All dispatch, response reads, validation and waits share an absolute deadline. Inspect/configure SDK retries so hidden retries cannot exceed the two-attempt cap. Cancel abandoned requests where supported; cancellation does not imply the provider consumed no quota.
6. Allow the one fallback for transient transport/timeout, 429, 5xx or rejected structured output only when the alternative is eligible. Honor `Retry-After`/reset information with a shared cooldown; never retry the exhausted bucket early. Daily exhaustion opens a cooldown until reset, not a rapid retry loop. Distinguish organization-wide failure from model-specific capacity. Authentication/model/configuration failures go directly to manual/templates; ambiguity prompts user clarification, and refusal is not routed around through another model.
7. Avoid retry storms with a short-lived circuit breaker and one leased recovery probe. Reuse exact duplicate in-flight requests only within the same user's task/context; do not create a cross-user raw-text cache. Store operational metadata for seven days per document 11, with no ordinary raw prompt/response logging. Postgres unavailability disables AI admission but does not permit unmetered requests.

The provider cooldowns complement application quotas; the 5/minute user cap alone does not protect an 8,000-token/minute organization bucket. Public dashboards/headers are configuration evidence, not a guarantee of capacity. No billing upgrade, paid-only fallback, new provider account, Redis service or autonomous agent loop is necessary for this design.

## Parallel processing: where it helps and where it does not

Within one plan the dependencies are sequential: interpret -> human review -> deterministic scheduling -> explain. Never explain a plan before confirmed inputs/results exist. Calling all models at once or running a model debate spends quota and produces no established benefit here, so speculative parallel inference is not proposed.

Independent users may run concurrently within the shared reservations/leases above. Grid-cache refresh or independent internal reads may overlap only if their own existing staleness and ownership rules permit it; no new speculation is required. Development/holdout evaluation may use a bounded worker pool after a sequential smoke run establishes actual token use and account limits. Start live evaluation at concurrency one; increase only with measured headroom. Two roles x two models x 60 examples would already be 240 calls before retries: stage the evaluation across daily budgets rather than weakening production caps or rotating keys. The actual explanation suite should follow its code-combination contract, not mechanically duplicate the extraction suite.

## Verification and handoff

Public evidence was checked against the linked official catalogs, pricing, rate-limit, schema and terms pages. No authenticated model access, latency, extraction score, token cost, fallback success or quota implementation has been verified. Only documentation/configuration examples are being revised in this research task; M06.01–M06.05 and G-AI/G06 remain pending.

Next action on M06 authorization: read all required phase documents, inspect the current environment without exposing keys, confirm free account/project status and deployment audience, implement versioned schemas and human-reviewed example labels, then perform bounded smoke/evaluation and router/quota work in roadmap order. Do not change the private/manual planner or weaken its deterministic boundaries.
