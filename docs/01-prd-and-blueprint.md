# CarbonShift — PRD and product blueprint

Version 1.9 · 22 October 2026 · M00–M07 run locally. AI timing is experimental/manual-first under the documented quality policy; private completion is implemented; receipts remain later work.

## 1. Intent and authority

CarbonShift helps a person choose a lower-carbon time for one flexible washing-machine cycle, understand the assumptions, and optionally publish an inspectable record of the plan and reported outcome.

The user has selected CarbonShift, is a solo builder using Codex with their chosen GPT-6.1 Sol configuration, and requires Gemini and Groq APIs in the product. On 21 October 2026 the user authorized M00 through M05, requested all documents be read before every phase, and specified premium, modern, clean, minimal UI/UX plus real functional backend behavior. M01 implements the foundation, M02 the deterministic core, M03 the live national grid adapter and M04 OAuth/private plan APIs within that bounded design. The development Supabase project and two provider sign-ins have been checked; M05 now connects manual constraints, real grid comparison and immutable saving through private screens; M06 adds locally evaluated AI assistance and shared abuse controls. M07 implements private completion, history and deletion; publication and receipts remain later phases. No deployed web app/contract, user study or measured climate benefit is implied.

The user removed standalone deployment/operations and submission documents. Essential deployment steps appear in document 14 and implementation tasks in document 13. Do not recreate the removed documents.

This document owns product scope. Other documents define implementation details. [Decisions and status](decisions-and-status.md) distinguishes user requirements from proposed defaults.

On 22 October the user requested document updates before M06: free-model selection must consider quota headroom, repeated login/submission requests need server protection, and agent/workflow proposals must be assessed for practical benefit. The user subsequently authorized M06. Both providers now have bounded live evidence; Lite timing missed proposed quality targets and remains experimental, opt-in and reviewed. Groq/Lite explanation checks and a real assisted planning journey passed. No paid service or public AI deployment was authorized.

## 2. Problem and audience

A flexible household task often runs whenever someone remembers it. Grid carbon intensity varies, but a chart alone does not incorporate a person's deadline, unavailable periods, or the assumptions behind a reported benefit.

Primary user: an adult in Great Britain who can safely choose when to run a washing cycle and wants an understandable recommendation. People elsewhere may explore the clearly labeled demonstration; they do not receive a local recommendation based on GB data.

Secondary user hypothesis: a community energy-program reviewer who wants to inspect how a participation claim was calculated and whether its inputs changed after acceptance. No community organization is currently a partner.

The primary hackathon track is **Renewable Energy & Energy Trading**, specifically coordinating flexible demand using grid signals. No trading market or electricity settlement is included.

## 3. Distinctive contribution and validation

Existing products already schedule appliances using carbon signals. CarbonShift must not claim to invent carbon-aware scheduling. Its proposed contribution is the combination of:

1. User-reviewed natural-language constraints, with an equally capable manual form.
2. A comparison against a specific, visible baseline that is frozen when accepted.
3. A portable calculation bundle and testnet commitment that expose later changes.
4. A receipt that separates estimated carbon difference, self-reported execution, calculation reproducibility, and ledger integrity.

This is a **differentiation hypothesis**, not a proven market gap. Before expanding the build, show a representative user the plan comparison and a reviewer the receipt. Record whether they understand the distinction and find it useful. If no reviewer benefits from shared publication, the blockchain business case remains weak even when the contract works.

Prior-art context: [existing SmartThings/Electricity Maps scheduling](https://blog.smartthings.com/partner-spotlight/qa-smartthings-and-electricity-maps-on-optimizing-your-homes-carbon-footprint/), and the [earlier project assessment](../research/wave-2/project-ideas-claude-analysis.md).

## 4. Bounded MVP scope

| Area | MVP boundary |
|---|---|
| Geography | National Great Britain signal; no postcode, regional, Northern Ireland, or India recommendation |
| Appliance | One uninterrupted washing-machine cycle per plan |
| Timing | 30–180 minutes in 30-minute increments; starts on half-hour UTC boundaries |
| Planning horizon | Up to 48 elapsed hours, subject to actual feed coverage |
| Energy | User-confirmed estimated cycle Wh, distributed uniformly; demo defaults explicitly illustrative |
| Constraints | Earliest start, finish deadline, preferred baseline start, explicit blocked time intervals |
| AI | Two bounded roles: constraint interpreter and explanation selector; both providers integrated/evaluated, quota-aware model selection and at most two calls/task |
| Execution evidence | Self-reported completion time or “did not run”; no hardware verification |
| Blockchain | Opt-in publication of an operator-issued commitment and append-only results on Sepolia |
| Accounts | Google/GitHub OAuth login for saved live plans; public fixture demo without signup |
| Device control | User operates their appliance; app does not start or stop it |
| Fees/rewards | No payments, tokens, credits, financial rewards, or tariff optimization |

Energy ranges and algorithm behavior are authoritative in [08](08-scheduling-and-carbon-methodology.md). Do not describe the uniform load profile as a measured washing-machine curve. Do not encourage use that contradicts an appliance's safety instructions or the user's supervision constraints.

## 5. Main journey

1. Visitor sees a short explanation, supported geography, and “Try example” or “Plan a wash.”
2. Signed-in user enters cycle duration and energy estimate. They can describe timing constraints in plain English or use the form directly.
3. The app displays AI-suggested fields and unresolved questions. The user corrects and explicitly confirms them.
4. The deterministic scheduler retrieves a timestamped grid snapshot, enumerates feasible starts, and compares the best candidate with the chosen feasible baseline.
5. The user sees exact local start/finish times, both estimates, source age, assumptions, and any lack of improvement.
6. Acceptance freezes inputs and forecast. A private plan is useful without publishing.
7. Optional publication presents the exact public data and obtains explicit consent. The operator relay commits the manifest; UI shows pending until confirmation.
8. After the event, the user reports a start time or non-execution. The app calculates an updated estimate only where required data exist.
9. A receipt shows the original forecast comparison, latest reported result, corrections, and separate verification checks. The user may export its permitted bundle.

## 6. Feature priorities

All `F01`–`F12` in [02](02-features-pages-and-flows.md) belong to the bounded MVP. Their depth is deliberately limited. The core path must remain available through manual input when AI is unavailable.

Strengthen existing pages with editable clarification questions, visible reasons/assumptions, honest quota/outage recovery, comparison alternatives and the already-planned history/receipt checks. Login throttling, repeated-submission control and shared AI request/token budgets are M06 hardening requirements. These do not add pages, appliances or an autonomous agent platform. Orchestration, validation, scheduling, carbon arithmetic and evidence verification are deterministic services, not extra AI agents.

A third receipt/chat assistant and other proposed extra features remain deferred until a distinct user need and explicit scope change are established. Agent count is not a release criterion. Model order, quota reset rules, evaluation/promotion and the unresolved public UK deployment profile are owned by [09](09-ai-agents-models-and-workflow.md); no free Gemini UK launch is implied.

Deferred: meters/CSV uploads, regional routing, multiple appliances, recurring schedules, automatic reoptimization, push/email reminders, social leaderboards, utility APIs, tariffs, native apps, trading, custom forecasting, vision, chat history, model training, autonomous agents, and incentive settlement.

These are scope cuts, not promised roadmap deliveries. A requirement change must update the PRD, affected interfaces, and tests before code.

## 7. Success evidence

The five judging criteria guide evidence, not invented weights or win probabilities.

| Criterion | Evidence to produce |
|---|---|
| Climate impact | Reproducible comparison with explicit energy, grid factors, and baseline; no extrapolated avoided-emissions claim |
| Innovation | Clear comparison with prior art and a useful immutable-baseline/inspection journey |
| Technical execution | Real feed adapter, evaluated AI assistance, working contract rule, failure handling, and integrated user flow |
| Practical usefulness | Fresh user can plan a task, understand limits, and use the manual fallback; external reviewer can inspect a bundle |
| Communication | Plain-language page content and visible separation of forecasts, reports, and proofs |

Engineering release targets, not achieved results:

- All core acceptance tests in [12](12-testing-and-ai-evaluation.md) pass.
- A fresh user can complete a planning task without developer intervention.
- Every displayed carbon amount can be reproduced from a versioned bundle.
- Invalid constraints, missing coverage, or unavailable services never become a successful recommendation.
- At least one live grid request and one testnet transaction are recorded as actual integration evidence.
- AI metrics and sample size are reported honestly, including failures.

## 8. Product language

Use “estimated grid-associated CO₂,” “forecast comparison,” “self-reported run,” “record matches its commitment,” and “illustrative example.”

Avoid “verified carbon savings,” “proof you ran the machine,” “carbon neutral,” “fraud-proof,” “guaranteed cheapest,” “world first,” or “independently certified.”

Positive and negative results both remain visible. Missing input is not zero. A failed blockchain transaction is not a confirmed receipt.

## 9. Baseline and quality expectations

The working defaults remain GB national data, washing-only, self-report-only evidence, optional public receipts, and a server-operated testnet relay. They are adopted under the user's instruction to proceed with the documented M00 phase, rather than represented as separate approvals of every parameter. Consequential changes are recorded in the status log and owning specification.

The frontend quality direction is authoritative in document 03. Backend correctness requires validated real inputs, deterministic calculations, persistent state, authorization, and honest failure handling. Live recommendations, totals, account records, and chain states cannot be hardcoded or fabricated. Versioned method constants, UI copy, and visibly labeled fixtures remain necessary; they must never masquerade as live outcomes. “Works perfectly” is a quality target, with actual completion established by document 12's checks rather than an unconditional promise.
