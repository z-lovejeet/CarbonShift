# CarbonShift — UI/UX and design system

Version 1.2 · 21 October 2026 · Visual specification; M01 shell rendered and inspected, with full product flows pending.

## 1. Experience goal

A person should quickly answer: “When should I run this wash, what assumptions produced that answer, and what actually changed after I reported it?”

Use an approachable utility interface with generous reading space, clear time comparisons, and restrained environmental color. The main interface explains decisions. Technical proof details are available on demand.

The route/feature inventory is owned by [02](02-features-pages-and-flows.md). This document specifies presentation rather than adding pages.

### User direction recorded at M00

The user requires a **premium, modern, clean, minimal** frontend and UI/UX, without generic AI-generated styling. Carry that direction into the existing utility workflow: deliberate typography, consistent spacing/alignment, restrained surfaces, a clear primary action, and careful mobile/form states. Preserve the existing information hierarchy and page scope.

Do not substitute repetitive card grids, oversized decorative heroes, gradient blobs, gratuitous pills, stock environmental counters, or distracting motion for the actual planning interface. Every visible action must have its real implemented behavior or an explicit unavailable state. Loading, empty, validation, error, pending, and success states require the same visual care as the primary screen.

Review actual rendered screens at the specified responsive widths before marking UI tasks passed. The token table is a starting system; visual quality and accessibility require inspection of the implementation. M00 recorded the brief; M01 now implements a small responsive shell, with planning explicitly unavailable. Navigation to unimplemented plans/account/methodology routes is withheld until those routes exist; current home/approach links work.

## 2. Information hierarchy

1. Action: recommended start and finish.
2. Reason: estimated comparison with the user's baseline.
3. Constraints: deadline and unavailable periods respected.
4. Evidence: forecast source/age, energy assumption, execution basis.
5. Optional audit detail: manifest, method version, transaction, corrections.

The primary CTA changes with state: “Compare times” → “Save this plan” → “Report what happened.” Publication is secondary. Do not make a wallet or blockchain explanation the first-run experience.

## 3. Design tokens

| Token | Proposed value and purpose |
|---|---|
| Canvas | `#F7F8F4`, warm near-white background |
| Surface | `#FFFFFF`, forms and cards |
| Main text | `#17261E` |
| Secondary text | `#526158` |
| Primary/action | `#165D3B` |
| Primary hover | `#10492E` |
| Border | `#D7DFD6` |
| Warning text | `#795000` on `#FFF4D8` |
| Error text | `#A42323` on `#FFF0EE` |
| Informational text | `#234E80` on `#EEF4FC` |
| Spacing | 4, 8, 12, 16, 24, 32, 48 px |
| Radius | 8 px controls, 12 px cards |
| Content width | 1,120 px shell; 720 px form column |
| Fonts | System sans-serif; tabular numerals for times/quantities |
| Elevation | Fine borders; one subtle shadow only for floating dialogs |

These are design choices, not a completed contrast audit. Test every actual foreground/background pair before release; adjust tokens when necessary. Avoid animated particle backgrounds, glass effects over data, decorative badges, excessive gradients, and fabricated environmental imagery.

## 4. Layout and navigation

Desktop header: CarbonShift wordmark, Plans, Methodology, account control. Main content uses a primary column and a narrow source/assumption panel where useful.

Mobile: single column, 16 px side padding, comparison cards stacked in the same order as desktop. Header exposes Plans and account via an accessible menu. Sticky bottom action is allowed only when it does not cover form fields, errors, or keyboard focus.

Minimum interactive target: 44 × 44 CSS px where practical. Body text 16 px minimum, line height about 1.5. Honor browser zoom and reduced-motion settings.

## 5. Key wireframes

### Planner comparison

```text
CarbonShift                         Plans   Account
Plan a wash       1 Task — 2 Compare — 3 Save

Suggested: Tomorrow, 10:00–11:00 BST
Fits your 12:00 deadline and blocked periods.

Your usual time             Suggested time
08:00–09:00                  10:00–11:00
320 g CO₂ estimated         120 g CO₂ estimated

200 g lower forecast estimate • 62.5% lower
[half-hour intensity chart, both windows marked]
[View accessible table]

Based on: 1.00 kWh assumed cycle energy
Great Britain national forecast • retrieved 8 min ago
Estimated difference; actual operation is not measured.

[Edit constraints]                         [Save this plan]
```

The numbers above are an authored example, not live data. In the app, every amount and time comes from the result object.

### Plan detail

```text
Your saved plan                      Private
Run 10:00–11:00 BST • 60 minutes
Forecast comparison at acceptance [expand]

[Report what happened]     [Cancel plan]

Optional: publish an inspectable receipt
Preview the schedule/energy data that would become public.
[Review publication]

Activity
Accepted → Publication status → Reported result → Corrections
```

### Receipt

```text
CarbonShift receipt                  Sepolia test network
Original plan and current public result

Execution evidence       Self-reported
Calculation              Reproduced / unavailable / mismatch
Plan commitment          Matches / unavailable / mismatch
Timing                   Before start / demo / not established

Original forecast comparison
Latest public outcome estimate
Revision history

[Download bundle] [Open verifier] [View transaction]
What these checks establish [expand]
```

A single overall green shield is prohibited because these checks establish different facts.

## 6. Component inventory

| Component | Required behavior |
|---|---|
| `AppShell` | Accessible navigation, skip link, consistent responsive width |
| `StepIndicator` | Announces current step; prior steps editable before acceptance |
| `TaskForm` | Explicit labels, units, timezone, inline validation |
| `ConstraintReview` | Suggested versus confirmed values, unknowns, edit controls |
| `DateTimeField` | Handles ambiguous/nonexistent local times explicitly |
| `IntensityChart` | Baseline/selected bands, labeled axes and units, textual equivalent |
| `ComparisonCard` | Deterministic numbers; zero/negative/unavailable variants |
| `EvidenceLabel` | Neutral, explicit basis such as “Assumed energy” |
| `SourceDetails` | Provider, retrieval time, forecast period, attribution |
| `PublicationDialog` | Exact public fields, persistence warning, unchecked consent |
| `TransactionStatus` | Queued/submitted/confirmed/failed/uncertain with appropriate actions |
| `RevisionTimeline` | Append-only ordered history with reason and chain state |
| `VerificationChecks` | Separate outcomes; no blanket certification |
| `ErrorNotice` | Problem, recovery action, reference ID; no secret/raw trace |

## 7. Chart rules

Use a simple line or step chart of gCO₂/kWh over the covered time range. The y-axis starts at zero when comparing magnitudes; show units. Mark intervals as forecast and preserve gaps rather than drawing through missing values. Baseline and selected bands need labels/patterns as well as colors.

An adjacent table lists start/end, factor, and selection status. Keyboard users must access equivalent information without hovering. On mobile show fewer x-axis labels, not fewer underlying intervals.

Do not animate a carbon total counting upward. Do not convert estimates to trees, flights, or other equivalences without a separate supported methodology.

## 8. Copy and disclosure

- Unsupported geography: “Live planning currently uses Great Britain’s national grid signal. You can still try the example.”
- Missing coverage: “We don’t have complete forecast data for this window. Change the deadline or try again.”
- No improvement: “Your baseline is already the lowest estimate among the feasible times.”
- AI ambiguity: “Please confirm which day you mean by ‘tomorrow’.”
- Actual pending: “The grid estimate for this period is not available yet.”
- Chain pending: “Submitted to the test network. Confirmation is pending.”
- Self-report: “You reported this start time. CarbonShift did not measure the appliance.”

Numbers and dates are inserted by code. The explanation agent selects approved explanation keys; it cannot rewrite labels or numerical values.

## 9. Accessibility and performance acceptance

Complete the core flow using keyboard only and a screen reader smoke test. Focus moves to step headings and first invalid fields; asynchronous updates use appropriate live regions without excessive announcements. Dialogs trap and restore focus. Password inputs support paste/managers. Error text is associated with the field.

Respect reduced motion. Route transitions need no animation; micro-feedback should remain under 200 ms. Optimize the initial planner for ordinary mobile connections: defer chart and proof tools until needed, avoid large media, and keep form interaction independent of model responses.

UI validation and responsive checks are part of [12](12-testing-and-ai-evaluation.md). M01 generated browser screenshots and inspected the desktop/mobile shell; production-browser checks passed at 360/768/1440 px with no observed axe violations. This establishes only the current shell's scoped checks, not accessibility or completeness of future planner/receipt pages. Actual evidence is recorded in the status log.
