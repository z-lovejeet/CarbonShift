# Household expansion — final local acceptance

24 October 2026 · U34 implementation scope, with U35 implementation-first verification order. X00–X05 and revised local M10 are complete locally. Public deployment is not included.

## Delivered

- Separate activity simulator, one/multiple-task planner and calendar-day planner, with up to twelve activities and confirmed energy inputs.
- Real GB national grid factors, retrieval/source details, exact electricity/carbon estimates, explicit baselines, feasible alternatives and reviewed window-extension proposals.
- Fixed tasks, per-task windows/blocks, shared resources, attention and task dependencies; bounded-search status remains visible.
- Atomic private saves, versioned reports, completion/non-run reporting, append-only corrections, actual-factor refresh and honest partial aggregates.
- Optional qualified activity interpretation and grounded explanation selection, with owner cache and manual/template recovery.
- Exact-consent v2 publication, existing Sepolia worker/contract, anonymous receipts and local v1/v2 bundle verification. Existing v1 records and hashes retain their method.
- Expanded home, dashboard/history, methodology, privacy and visibly authored demo.

The simulator uses supplied or reviewed device energy; the source API supplies grid factors. No universal API measures an unknown appliance, no AI-generated wattage is authoritative, and no appliance is controlled.

## Combined verification

| Check | Observed result |
|---|---|
| `pnpm test` | 52 files, 521 passing unit/component cases in the combined run |
| `pnpm test:integration` | 6 files, 83 passing isolated PostgreSQL cases |
| `pnpm contracts:test` | 10 passing local contract/production-adapter cases; ABI/build fingerprints matched |
| `pnpm test:e2e` | 48 passing production-fixture browser cases across desktop/tablet/mobile |
| `pnpm typecheck` | Next application and contract TypeScript checks passed |
| `pnpm build` | Production build passed with account/AI/ledger credentials cleared in the process |
| ESLint/import boundaries | Full source lint passed after concrete corrections; final affected-file lint and boundary check passed |
| Frozen v2 digests | Subsequent targeted proof file: 3/3 passed, including new fixed method/plan/result digests |

The production fixture build does not qualify a public AI profile or hosted account configuration. Normal tests used isolated fixtures, not paid APIs. Passing suites were not broadly repeated after final documentation/golden-fixture additions.

## Actual development-service journey

[integration.json](integration.json) records the normal local browser/API flow using real development Auth/database and current GB data: simulator handoff, four-task mixed day, fixed TV, washing-before-drying, save/reload, foreign-owner denial, non-run reporting, append-only correction and unchanged refresh. Six connected routes received desktop/mobile accessibility and overflow checks. The inspected day screenshot is in the ignored local `test-results/final-household-day-desktop.png`; responsive home screenshots are also local test artifacts.

The completed-run report was an authored one-minute self-report after acceptance, without a clock override. Its future baseline means a complete updated comparison remains pending. The actual-grid retrospective simulator independently returned an estimate of 1697 mg for its authored inputs. Neither observation is a real appliance measurement; the complete whole-schedule result correctly remains null.

[windows.json](windows.json) records the separate exact-fit/no-improvement and thirty-minute extension review check, with unchanged baseline/energy and a useful too-short-window rejection. Applying a proposal returns to unconfirmed review rather than silently saving.

## Live AI

[ai-wiring.json](ai-wiring.json) records two admitted model tasks through normal authenticated endpoints: the car-cleaning request left energy unknown and asked for equipment/duration/energy, then the saved-plan explanation returned AI-selected eligible codes. A second explanation read returned the owner cache without new inference.

Gemini `activity-v2.3` passed 24/24 agent-reviewed authored examples; [evaluation evidence](../ai/results/0b2c81ea-4981-4b33-be5b-674cfe452508.json). Gemini `schedule-explanation-v2.3` passed 6/6 grounded selections; [evidence](../ai/schedule-explanation.json). These are experimental authored-case results, not population accuracy. The user explicitly requested agent review of labels. The expanded Groq interpreter failed strict validation and remains unqualified; the manual path and deterministic explanations work when no qualified candidate is available. Existing v1 qualifications were not transferred to new variants.

## Actual Sepolia evidence

The existing contract was reused; no redeployment or mainnet purchase was required. One consented v2 plan and one separately consented result confirmed on Sepolia:

- Receipt: `0x2b6c26c7126e95abd482a3710b493073808259d7bb2c63a4037a42f34f267fbb`.
- Plan: [transaction](https://sepolia.etherscan.io/tx/0xa30c8b779398af2c0671a687d4ef4236ea1fb1bebfc63a781c5a0f40931ad9ec), block 11983596; digest `0xde71024e0200f8b5c2eb261d0ea61e935ff29a03938915ee296869617b581934`.
- Result: [transaction](https://sepolia.etherscan.io/tx/0x968fc7fb01b39505bc37406f99b7e247449667fa20c1513783d6dd73d339c2ff), block 11983604; digest `0x1ffd69d4f1a7506c99344b39cd075c8bd8e86898af97643160da2064e2e087ac`.

The downloaded [v2 bundle](sepolia-v2-bundle.json) passed all seven separate browser local/RPC checks. The public result has zero comparable tasks, one non-run, one pending reported run and two unreported tasks; it claims no complete-day benefit. Matching hashes establish content/timing consistency, not truth of consumption or physical emissions savings.

Temporary fixture accounts were removed, public copies retained without private owner links, and no source commit/push occurred. The ignored journal retains duplicate-publication protection; do not remove it to force another test commitment.

## Local review and release boundary

Start at `/app/simulate`, `/app/plan/new` or `/app/day/new`; saved reports use `/app/plans/[id]`, consented copies `/receipts/[receiptId]`, and local file checks `/verify`. `pnpm worker:ledger` processes new consented publications separately from the web app.

The current local app uses port 3001 because another project occupies 3000. Existing OAuth dashboard redirects remain 3000, so a fresh Google/GitHub flow on 3001 has not been established. Use the original configured port when free or explicitly align the development redirect setup before fresh sign-in. Existing users/configuration were preserved.

M11 still needs a real operator privacy contact, eligible public AI profile, web/worker hosting and deployed HTTPS/OAuth checks. No paid activation, public deployment, new device integration or guaranteed competition outcome is claimed.
