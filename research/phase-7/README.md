# M07 scoped lifecycle evidence

Executed 22 October 2026. See [live evidence](live-lifecycle.json) and [current phase handoff](../../docs/decisions-and-status.md).

The live development journey used normal private pages/API, the existing hosted Free project, real national forecasts and temporary seeded members. It verified future-run rejection, cancellation/history/retry, preserved forecast, owner isolation, guarded deletion and temporary-account removal. Actual run/correction/concurrency and missing/changed/negative factors are covered by isolated SQL/service/UI fixtures.

A separate authored historical plan remained in memory and consumed live actual national grid factors. It produced a signed higher estimate; its forecast/acceptance are authored test data, not a real past commitment. No appliance was operated or measured.

Google/GitHub start redirects were real. Callback identity/session logic was tested in isolation; a signed fixture receipt was injected only into the temporary-account deletion check. This is not evidence of a fresh human provider reauthentication. No test-only override was added to product handlers.

Final checks: 426 unit/component checks, 67 isolated PostgreSQL checks, 45 isolated browser checks, lint, both typechecks and a production build. No AI inference or ledger call. Existing users, provider settings and published source history were preserved. Public/chain-aware deletion and deployment remain future phases.
