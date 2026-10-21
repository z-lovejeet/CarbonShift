# M00.04 — public AI-provider readiness evidence

Reviewed 21 October 2026 (Asia/Kolkata). Observation checkpoint: 20 October 2026, 20:42:57 UTC / 21 October 2026, 02:12:57 IST. Public documentation checks only; no account, key, model invocation, payment, or evaluation was performed.

## Catalog findings

| Existing proposed ID | Public evidence observed | M00 disposition |
|---|---|---|
| Gemini `gemini-4-argon` | Stable model in Google's catalog; its current-model guide identifies it as the latest flagship | Retain proposed interpreter primary |
| Gemini `gemini-3.8-flash` | Stable Flash model in Google's catalog | Retain proposed explanation fallback |
| Groq `openai/gpt-oss-120b` | Production entry in Groq's catalog | Retain proposed explanation primary and interpreter fallback |
| Groq `qwen/qwen3.8-27b` | Preview entry; strict JSON-schema support is documented separately | Evaluation-only candidate; no automatic production switch |

Sources: [Gemini catalog](https://ai.google.dev/gemini-api/docs/models), [Gemini current-model guide](https://ai.google.dev/gemini-api/docs/latest-model), [Groq catalog](https://console.groq.com/docs/models), [Groq structured outputs](https://console.groq.com/docs/structured-outputs). The Gemini catalog displayed “Last updated 2026-10-19 UTC”; this is the page's update date, not an account-access test. No current pin requires replacement based on these observations.

## Integration caveats for M06

- Google's current structured-output examples use `client.interactions.create` with a JSON `response_format` schema. Confirm the pinned SDK's actual interface during implementation. Only a schema subset is supported; string-length/property-count constraints can be stripped during normalization. Apply application-side validation for lengths, counts, dates, source spans, and semantic correctness. The page displayed an update date of 20 October 2026. [Gemini structured output documentation](https://ai.google.dev/gemini-api/docs/structured-output)
- Groq explicitly lists GPT-OSS 120B and Qwen 3.8 27B for strict mode. Every property must be required, objects must reject additional properties, and optional scalar values use nullable types. Structured outputs currently exclude streaming and tool use. Schema adherence does not establish correct interpretation. [Groq structured output documentation](https://console.groq.com/docs/structured-outputs)
- Gemini 4 Argon's output-token cap includes thinking and output; a small cap can truncate JSON. Measure the documented initial limits before treating them as adequate. [Gemini current-model guide](https://ai.google.dev/gemini-api/docs/latest-model)

## Lifecycle checks and next action

Google lists no announced shutdown date for Gemini 3.8 Flash; the checked deprecation table does not contain a Gemini 4 Argon shutdown entry. Do not infer a guaranteed lifetime from an absent entry. [Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations)

Groq identifies Qwen 3.8 27B as the replacement for Qwen 3.6 27B, whose listed shutdown date was 14 September 2026. Preview availability can change at short notice. [Groq deprecations](https://console.groq.com/docs/deprecations), [Groq catalog](https://console.groq.com/docs/models)

Recommendation: preserve document 09's exact IDs and routing. Before M06 live work, the builder must securely configure both providers and choose spending limits. Then list account-visible models, run bounded structured-output smoke tests, and execute the held-out evaluation. Account permissions, quotas, latency, accuracy, billed usage, and fallback success remain **unverified**. Public catalog support alone does not pass G-AI or G06.
