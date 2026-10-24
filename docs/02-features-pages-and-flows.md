# CarbonShift — features, pages, and user flows

Version 1.6 · 25 October 2026 · The approved household expansion and revised local M10 are implemented. M11 release fixes and GitHub/Vercel preparation are recorded in status section 31; public deployment acceptance remains pending.

**U34 target revision · 23 October 2026:** the approved household expansion at the end of this document supersedes conflicting washing-only restrictions for new v2 work. Earlier sections retain v1 contracts and historical implementation evidence. New capabilities are not passed until recorded in status.

## 1. Roles

- **Visitor:** reads public pages, tries a fixed local demonstration, inspects an explicitly published receipt.
- **Member:** creates and manages only their own private live plans, reports completion, and chooses whether to publish.
- **Reviewer:** any visitor using the public verifier; this is not a privileged account or a certification role.
- **Operator:** deploys/configures the system and holds a dedicated testnet relay key. No operator admin dashboard is needed for the MVP.

Authentication is enforced by server and database rules, not just navigation visibility. “Reviewer” does not imply independent physical verification.

## 2. Feature register

| ID | Feature and minimum acceptance condition | Primary page | Verification |
|---|---|---|---|
| F01 | Public introduction and fixture demonstration; demo is persistently labeled and makes no paid API calls | `/`, `/demo` | T01 |
| F02 | Google/GitHub OAuth account, validated session, sign-out and server login-attempt throttling; one user cannot read another's plans | `/login`, `/app/settings` | T02 |
| F03 | Manual task input validates geography, duration, energy, dates, baseline, and blocked intervals | `/app/plan/new` | T03 |
| F04 | Two bounded AI roles suggest source-backed timing fields and approved explanation codes; quota-aware dispatch, duplicate protection and manual/template recovery | Planner steps 1–2 | T04 |
| F05 | Grid adapter validates coverage and freshness, preserves attribution, and never silently substitutes fixtures | Planner step 2 | T05 |
| F06 | Scheduler selects the minimum-estimate feasible start and compares it with the locked baseline | Planner step 2 | T06 |
| F07 | Acceptance freezes a private plan atomically; refreshed/expired input requires a new review | Planner step 3, plan detail | T07 |
| F08 | Member optionally publishes a reviewed manifest; pending, confirmed, failed, and uncertain chain states differ | Plan detail | T08 |
| F09 | Member reports a run or non-execution; corrections are append-only; missing grid factors remain unavailable | Completion page | T09 |
| F10 | Public receipt/export exposes only approved publication data and complete revision history | Receipt page | T10 |
| F11 | Verifier compares commitments and recomputes math, separating each check and its limitations | `/verify` | T11 |
| F12 | Private history, methodology/privacy pages, deletion controls, and truthful error states | Dashboard, settings, help | T12 |

`T01`–`T12` are defined in [12](12-testing-and-ai-evaluation.md). All twelve are MVP requirements; do not expand a feature into a subsystem.

## 3. Complete page inventory

| Page ID and route | Content and actions | Access and special states |
|---|---|---|
| P01 `/` | One-sentence value, three-step overview, GB support notice, live-plan/demo CTAs, methodology link | Public; no invented counters or partner logos |
| P02 `/login` | Continue with Google or GitHub; first sign-in creates the account | Public; generic errors, pending/cancelled/unavailable and server-throttled states; useful retry guidance |
| P03 `/app` | Current plans, last result/evidence label, create-plan action, published/unpublished filter | Member; empty state and fetch failure |
| P04 `/app/plan/new` | Three steps: task and constraints → comparison → acceptance | Member; preserves input on errors; keyboard usable |
| P05 `/app/plans/[planId]` | Frozen plan, data age at acceptance, publication status, report/cancel actions, revisions | Owner; unknown/other-owner IDs both return not found |
| P06 `/app/plans/[planId]/complete` | Run/not-run selection, reported actual start, confirmation that duration/energy assumptions still apply, correction reason | Owner; refuses future completion, handles unavailable actual factors |
| P07 `/app/settings` | Account email display, provider reauthentication, sign-out, delete unpublished plan/account request action | Owner; irreversible-publication explanation before deletion |
| P08 `/receipts/[receiptId]` | Public manifest summary, chain reference, original and revised estimates, independent check results, bundle download | Public only after explicit publication; indexing disabled; missing bundle differs from invalid proof |
| P09 `/verify` | Load exported JSON locally, recompute hashes/calculations, optional chain lookup, explain failures | Public; file size/schema errors, wrong network, no RPC, mismatch, unsupported method |
| P10 `/methodology` | Human explanation of signal, load assumption, baseline, formulas, estimate limits, data attribution | Public, versioned content; no account necessary |
| P11 `/privacy` | Data inventory, AI providers, public disclosure, retention/deletion, actual operator contact | Public; contact must be supplied before inviting real users |
| P12 `/demo` | Fixed synthetic scenario with selectable valid/blocked/missing/tampered cases; resets locally | Public; no user persistence, no simulated transaction presented as real |

`/auth/callback` is a technical route, not a page: it completes allowed authentication flows and redirects to an allowlisted internal destination. Password registration, recovery and the `/login/update-password` route are excluded under U16. `/auth/sign-in` and `/auth/sign-out` are same-origin POST handlers, not product pages. Add framework not-found/error boundaries; these are shared system screens, not new product features.

## 4. Planner field contract

Step 1 contains:

- Fixed geography selector: “Great Britain — national estimate.” Explain unsupported countries.
- Appliance: washing machine, fixed in MVP.
- Duration: 30, 60, 90, 120, 150, or 180 minutes.
- Energy estimate in kWh with source selector `user_estimate` or `illustrative_default`; backend converts exactly to integer Wh.
- Earliest start and finish deadline in `Europe/London`, including offset on repeated hours.
- Baseline: “When would you otherwise run it?” Default proposes earliest feasible start, visibly labeled; user confirms.
- Up to four explicit blocked intervals within the planning horizon.
- Optional plain-English timing input, maximum 1,000 characters.
- AI data-use notice and a separate “Use these constraints” confirmation.

Step 2 displays baseline and recommended start/finish, estimated gCO₂ for each, absolute difference, percentage only when defined, forecast age, input assumptions, and feasible alternatives. Numbers are rendered from the deterministic result object.

Step 3 summarizes exactly what will be frozen. Primary action is **Save this plan**. Publication is a separate optional action after saving. Acceptance does not start the appliance.

## 5. Primary and alternative journeys

### Live private plan

Login → confirmed fields → fresh comparison → accept private plan → manually run appliance → report outcome → inspect updated estimate.

### Public commitment

Saved plan → preview public fields → consent → request publication → wait for on-chain confirmation → share receipt. If publication occurs after the allowed precommit time, private planning remains available but a new “precommitted” record is refused.

### Result correction

Plan detail → correct reported start or run status → enter reason → preview recalculated result → append revision → if already public, separately approve publishing this revision. Existing public revisions remain accessible.

### No feasible recommendation

Keep the form, name the exact conflict (coverage, blocked window, duration/deadline), offer editing. Never silently drop a constraint. If only the baseline is feasible, show that result without claiming improvement.

### AI outage

Preserve typed text, show “Use the timing form,” keep all manual fields usable. No spinner blocks the entire workflow.

### AI quota or repeated request

Before dispatch, select the first qualified model with shared capacity using document 09's pool. Skipped candidates consume no model call; there are at most two real attempts. If all candidates are capped, retain the draft and explain the manual route. An already-running task key cannot launch another extraction. A lost completed extraction response is not presented as replayable data; offer manual input or a deliberate new request. Comparison explanations load independently and fall back to deterministic copy without withholding the result. Login throttling must preserve cancellation/retry recovery and not look like an invalid account.

### Chain outage

Keep the private plan. Display the actual transaction status; expose a bounded status refresh. A retry must reuse the same receipt ID and immutable payload.

## 6. Page-level state vocabulary

Use orthogonal labels: plan `accepted/cancelled`; completion `not_reported/ran/did_not_run`; data `forecast/actual_pending/actual_estimate`; publication `private/queued/submitted/confirmed/failed/uncertain`.

These dimensions must not collapse into a generic “verified” badge. Database enums and transitions are authoritative in [06](06-data-model-and-state-machines.md).

Every form preserves valid input after a recoverable failure. Disabled buttons explain why. Errors include next action and a support/reference ID without raw provider messages.

## 7. Scope guard

Do not add a conversational chatbot page, payments page, carbon-credit marketplace, leaderboard, device-control panel, meter-upload page, organization dashboard, or “total planet impact” page. Those would require requirements, data, permissions, and tests outside this agreed document set.

## 8. Implemented M05 boundary

P01 now links to live planning and the public example. P03 reads real owner plans, including empty/failure/pagination states; all current plans are private, so publication filters arrive with their actual state support. P04 provides manual fields → read-only reviewed constraints + confirmation → deterministic comparison → separate exact-result save review. The normalized earliest-feasible baseline is shown before saving. Changes require a fresh comparison and review; a failed request preserves the draft in browser memory.

The server provides the date/clock reference. Local times always resolve in Europe/London; repeated hours expose an explicit earlier/later offset selection, and nonexistent times are rejected. Energy is decimal text converted exactly to integer Wh. Completion/cancellation/publication/AI controls are not shown as working actions before their owning phases. P05 reads immutable saved comparison/snapshot data and states execution is not reported, publication private. P12 uses the frozen authored fixture and fixed clock only, permits local exploration/reset, and previews rather than saving. M10 extends this existing demo with proof-specific cases.

## Household expansion — U34 contract

This section owns the approved new product target; earlier washing-only field/scope rules continue only for v1. Implementation status remains in the decision log.

| Feature | Required behavior | Pages / test |
|---|---|---|
| F13 | Select/type household activity, confirm source-backed/manual energy, estimate electricity and CO₂ with live source status | P13 `/app/simulate`, T13 |
| F14 | Plan one or up to twelve tasks with individual baselines/windows, fixed times, dependencies and resource conflicts | Existing P03 `/app/plan/new`, T14 |
| F15 | Separate whole-day editor, calendar boundaries, comparison timelines and atomic schedule saving | P14 `/app/day/new`, T15 |
| F16 | Too-short/conflicting windows, no improvement, missing data and bounded-search limits; optional reviewed window extension | P03/P14, T16 |
| F17 | Immutable multi-task reports, per-task completion/correction and honest partial aggregates | Existing P05 `/app/plans/[planId]`, T17 |
| F18 | Versioned v2 interpretation/explanations with review, shared limits and manual fallback | P03/P13/P14, T18 |
| F19 | Exact-consent v2 publication and verification preserving v1 | Existing receipt/verifier pages, T19 |
| F20 | Rich useful home, timestamped grid context, all-workspace navigation and mixed-version history | Existing home/dashboard, T20 |

P13 is a what-if calculator; it does not save a commitment automatically. P03 supports one or several tasks; P14 adds a calendar-day boundary and timeline. Each has its own URL and primary action. A shared task editor is a reusable component, not a reason to combine pages. Saved v2 schedules use the existing detail URL with explicit version dispatch. New UUIDs must not collide with v1 IDs; the server checks both stores when allocating identities.

Input steps: activity/equipment → energy basis and duration → timing/constraints → explicit review → calculate/compare → report → optional save. AI suggestions are editable and cannot skip review. A custom task without power or energy asks for information. Car cleaning asks whether powered equipment is involved. A user can duplicate/remove/reorder draft tasks without changing an accepted plan.

Simulator-to-planner handoff transfers only reviewed draft fields through same-tab memory/session storage with a version/expiry; never include credentials, account information or AI raw text in URL query strings. Revalidate on arrival, clear on sign-out, and do not treat transferred values as accepted facts. No persistence is required to estimate. Manual entry remains available when assistance is unavailable.


### U37 presentation alignment

The builder approved the refined P01 landing and requested its visual quality across P02–P14, saved v1/v2 variants and framework states. Shared page framing, source/assumption guidance, report/receipt detail, reading navigation, active account/workspace navigation and consistent loading/empty/error surfaces are implemented. Route/feature permissions and existing server contracts are unchanged. The v2 completion URL retains its redirect to per-task reporting; it is not a second reporting implementation. The builder owns visual and functional testing of this update; current evidence is in status section 29.
