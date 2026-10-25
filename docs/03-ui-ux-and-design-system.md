# CarbonShift — UI/UX and design system

Version 1.7 · 23 October 2026 · M05–M09 interfaces implemented locally, including reviewed experimental timing assistance, truthful recovery and explicit publication consent/status.

**U34 target revision · 23 October 2026:** the approved household expansion at the end of this document supersedes conflicting washing-only restrictions for new v2 work. Earlier sections retain v1 contracts and historical implementation evidence. New capabilities are not passed until recorded in status.

## 1. Experience goal

A person should quickly answer: “When should I run this wash, what assumptions produced that answer, and what actually changed after I reported it?”

Use an approachable utility interface with generous reading space, clear time comparisons, and restrained environmental color. The main interface explains decisions. Technical proof details are available on demand.

The route/feature inventory is owned by [02](02-features-pages-and-flows.md). This document specifies presentation rather than adding pages.

### User direction recorded at M00

The user requires a **premium, modern, clean, minimal** frontend and UI/UX, without generic AI-generated styling. Carry that direction into the existing utility workflow: deliberate typography, consistent spacing/alignment, restrained surfaces, a clear primary action, and careful mobile/form states. Preserve the existing information hierarchy and page scope.

Do not substitute repetitive card grids, oversized decorative heroes, gradient blobs, gratuitous pills, stock environmental counters, or distracting motion for the actual planning interface. Every visible action must have its real implemented behavior or an explicit unavailable state. Loading, empty, validation, error, pending, and success states require the same visual care as the primary screen.

Review actual rendered screens at the specified responsive widths before marking UI tasks passed. The token table is a starting system; visual quality and accessibility require inspection of the implementation. M00 recorded the brief; M01 now implements a small responsive shell, with planning explicitly unavailable. M04 adds the responsive P02 OAuth/account page with current account navigation, provider buttons, approved error/unavailable states and sign-out. Plans/methodology navigation remains withheld until those routes exist; current home/approach/account links work.

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

### M06 assistance and retry states

Keep optional AI beside the manual fields, with its provider-processing notice and explicit action. Highlight ambiguous/missing fields and the supporting source span; resolve questions by editing confirmed fields, not a model debate. A short real state such as “Interpreting your timing…” may be shown only while the request is active. Do not display invented agent activity, progress percentages or internal prompt text.

Quota recovery: “AI assistance has reached its current limit. Your entries are kept; use the timing form.” Show a retry time/countdown only when supplied by the server and announce changes sparingly. Login recovery: “Too many sign-in attempts. Please wait before trying again.” Preserve navigation to the public demo. The provider buttons already prevent accidental repeated submission; M06 adds server enforcement and accessible 429 recovery. A login throttle does not mean credentials are wrong.

Disable duplicate actions while pending, retain the same task/save key for the same attempt, and require a deliberate new AI action after a completed response was lost. Suggestions never replace manual fields without review. Render the comparison and deterministic explanation immediately; optional AI-selected reasons may arrive independently and cannot alter values or required limitations. Keep source details, assumptions and existing alternatives available on the same pages. No agent dashboard, new chat page or additional decorative content is introduced.

## 9. Accessibility and performance acceptance

Complete the core flow using keyboard only and a screen reader smoke test. Focus moves to step headings and first invalid fields; asynchronous updates use appropriate live regions without excessive announcements. Dialogs trap and restore focus. OAuth buttons clearly name Google/GitHub, indicate pending navigation, and expose cancellation/error recovery without password fields. Error text is associated with the field.

Respect reduced motion. Route transitions need no animation; micro-feedback should remain under 200 ms. Optimize the initial planner for ordinary mobile connections: defer chart and proof tools until needed, avoid large media, and keep form interaction independent of model responses.

UI validation and responsive checks are part of [12](12-testing-and-ai-evaluation.md). M01 generated browser screenshots and inspected the desktop/mobile shell; production-browser checks passed at 360/768/1440 px with no observed axe violations. This establishes only the current shell's scoped checks, not accessibility or completeness of future planner/receipt pages. Actual evidence is recorded in the status log.

## 10. M05 rendering boundary

The existing tokens remain in use. Native labeled controls handle units and London dates; repeated hours expose an offset selector. A constraints review precedes comparison and a separate unchecked acknowledgment precedes save. Stage headings receive focus, errors name recovery actions, and interrupted saves preserve their retry identity. Desktop navigation and the native mobile menu reflow under 200% zoom.

Recharts is dynamically loaded only when a comparison is rendered. Its step series uses actual half-hour tick positions, a zero-based y-axis, a hatched baseline window and a suggested-time band, plus text labels and an adjacent keyboard-accessible table. It has no animation or hidden hover-only information. Source/time/energy/method details remain inspectable; cross-midnight schedules expose the finish date. Zero improvements do not acquire a positive headline.

The plan detail displays the frozen forecast and explicit initial execution/publication states; later lifecycle actions remain unavailable until implemented. Demo mode has a persistent synthetic-data/fixed-clock notice and a reset, and its final action says preview. Automated axe/keyboard/zoom checks and visual screenshots are scoped evidence, not a screen-reader or cross-browser certification. The builder deferred personal M05 review; actual observations belong in the status log.

## Household expansion — U34 interface contract

Retain the established typography, spacing, neutral surfaces and restrained accent. New pages use one dominant workspace and useful information density. Avoid decorative impact counters, faux live badges, repeated generic cards and model/provider jargon in the main flow.

- Home: clear household problem and three workflow links; current GB grid summary with timestamp/source/unavailable state; concrete supported activities; how energy assumptions work; optional receipt explanation; useful FAQs. No invented users/partners/savings.
- Simulator: left/top input editor, right/below result with electricity, estimated CO₂ and interval breakdown. Energy basis stays visible. Responsive two-column desktop becomes a single logical mobile flow. Changes invalidate stale results immediately; show which input revision produced the current result.
- Task planner: compact task list with expandable editor, a distinct review step, baseline/recommended schedule comparison, up to three alternatives and detailed assumptions. Required corrections link to their field/task.
- Day planner: separate date/availability editor and accessible timelines. Fixed activities are visibly fixed; overlaps are meaningful lanes rather than hidden collisions. Provide a table/list alternative and keyboard editing; dragging must never be the only control.
- Saved report: baseline, selected, source/assumptions and per-task totals, then completion and optional publication. Forecast totals and reported estimates have separate headings. Partial reports display covered task count and which tasks are excluded.

Navigation: Simulate, Plan tasks, Plan my day, My plans, Account. Use compact responsive navigation; retain visible focus, semantic labels, reduced motion and touch targets. No horizontal overflow at 360px. Loading regions announce changes without reading every refresh. Zero improvement is a valid neutral result; missing factors show unavailable, not 0. A search limit says “best found” and never a guaranteed optimum. Use “estimated grid CO₂” and “same electricity, different timing.”

Use derived state rather than duplicated totals, explicit request revision/abort handling, and code-split charts/verifier. Input edits do not call AI. Refresh only visible simulator grid data at most once per five minutes; stop timers on unmount and never refresh frozen accepted payloads.


## Household landing refinement — U36, 24 October 2026

The user finds the current home basic/awkward and requests better design, more content and an accurate activity count. This is a bounded redesign of existing P01 within the approved premium/minimal, restrained-green direction. Product workspaces, calculation methods and publication permissions stay under their existing owners.

Use a two-line, left-aligned hero with real current-grid context, an upcoming half-hour bar chart and an accessible values table. Charts use validated source values and a zero baseline; loading/unavailable states have reserved space and never contain synthetic factors. Cached source reads re-select the current half-hour at render time, including cache entries crossing a half-hour boundary. No decorative environmental photography, fabricated savings/users or new image/API dependency is required.

Replace repetitive text sections with a keyboard-accessible workspace selector, a complete catalogue, a four-step sequence, a visually distinct private/public evidence explanation, useful FAQs and a clear final action. Activity/profile/task counts derive from their actual registries/method, rather than marketing constants. The catalogue contains eleven named categories plus custom, and four exact reviewed model references; the custom path accepts other supported electrical loads with sufficient user inputs.

Keep styles in a homepage-scoped CSS module, preserve the shared application palette/system typography, and honor reduced motion. Native disclosures and ARIA tabs retain visible focus and arrow/Home/End keyboard use. Reuse the source cache and server-render the forecast; only the workspace picker requires a client island. Verify the affected landing journey and actual desktop/tablet/mobile layouts, without rerunning AI/ledger/SQL acceptance for a presentation change.


## Product-wide visual alignment — U37, 24 October 2026

The builder tested and approved the U36 landing appearance, then requested the same premium, clean visual quality and useful detail across every page. The builder explicitly takes ownership of testing for this update. Use the approved home as the reference rather than introducing another visual direction or restarting design approval.

The shared implementation uses `src/app/product.css` plus `PageHeader`, `PageGuide`, `WorkspaceNotes` and `ReadingLayout` in `src/components/ui/`. Keep the landing page’s paper/forest palette and system typography; use restrained surfaces, clear heading scale, deliberate form grouping and consistent responsive spacing. Shared primary/mobile navigation exposes the current route. Existing route IDs, server ownership, method calculations, user confirmations and publication consent remain authoritative.

| Area | Presentation and content |
|---|---|
| Dashboard | Useful entry points, loaded-history filter context, a real empty state and original-forecast labels |
| Simulator | Input/result surfaces, grouped activity and energy fields, energy-source guidance and explicit estimate limitations |
| Task/day planning | Reviewed workflow guidance, a distinct task rail/editor, clearer window/date controls, source-aware comparison and saved-review surfaces |
| Saved v1/v2 reports | Original-method context, clear forecast/report/publication sections, per-task coverage, history and consent separation |
| Account/login | Household scope, provider sign-in and recent identity confirmation, private/public retention explanation, distinct destructive controls |
| Public receipt | Recorded baseline/selected/energy amounts, exact public task timing, method/receipt identity, separate verification states and consented result coverage |
| Local verifier | Local-file explanation, readable import surface, optional observation trust context and definitions of each verification state |
| Demo | Persistent synthetic-data boundaries, scenario explanations and preserved earlier washing example |
| Methodology/privacy | Anchored reading navigation, reviewed source records, formulas, method/time/rounding/retention boundaries and truthful operator-contact state |
| Framework states | Consistent not-found/error recovery and a value-free loading skeleton |

Do not hardcode results into these layouts, recompute authoritative carbon amounts in components, hide failed/pending states or add fake counters. Public receipt figures read the already-consented manifest; a derived display difference is labeled as recorded forecast. An exact power reference is described as power rather than incorrectly called cycle energy. No new service, paid model, database migration or device connection is introduced.

For U37, Codex runs compilation/lint checks only. Browser, accessibility/visual, functional, API/provider and chain acceptance remain the builder’s review. Do not mark the updated screens visually/behaviorally passed from the earlier U34/U36 evidence or automatically rerun those suites.


### 25 October — remove the planning-limit banner

The builder requested removal of the blue planning-limit notice shown above the household task form. Remove that shared notice from both task and whole-day planners. Keep the normal field hints, London-time labels, date bounds and actionable validation errors; the 48-hour forecast limit, day boundary and ten-minute lead-time rules remain enforced. This is a presentation removal, with no scheduling, calculation, AI or publication behavior change.
