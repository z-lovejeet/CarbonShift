# CarbonShift — features, pages, and user flows

Version 1.4 · 22 October 2026 · M06 assistance, quota recovery and repeated-request protection implemented locally. Timing assistance remains experimental/manual-first. Execution evidence is in the status log. Scope authority: [PRD](01-prd-and-blueprint.md).

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
