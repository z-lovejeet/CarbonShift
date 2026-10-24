# M09 — publication evidence

Observed 23 October 2026 in the builder's local development setup. UTC timestamps inside records may be 22 October. These are software/testnet integration checks with authored appliance assumptions, not measured appliance execution or avoided emissions.

- `sepolia-deployment.json`: actual ShiftReceipt address, issuer, transaction/block, gas and pinned bytecode/owner checks; two blocks after inclusion.
- `live-publication.json`: ordinary real Auth/database/grid/browser/worker flow, exact consent, queued state while the worker was offline, confirmed plan and separately consented cancellation result, retry/foreign-owner checks, all seven independent checks, tampering detection, responsive/axe/browser checks and temporary-account cleanup.
- `live-proof-bundle.json`: actual exported consented manifest/result, national forecast, method and transaction references. No physical wash occurred; the result is non-execution with null amounts.
- `live-chain-observation.json`: actual contract reads, canonical blocks and events used independently of the exported bundle.
- `live-explanation-route.json`: ordinary authenticated AI explanation endpoint against a real comparison, grounded limitations and a cache hit without another task. This is an integration check, not a new quality evaluation.
- `groq-explanation-smoke.json`: separate one-request provider/schema evidence and observed quota headers. The smoke itself does not qualify a role.
- `ai-integration-status.json`: two current Gemini timing timeouts returning sanitized 503; no quota/timeout increase, new role promotion or paid activation. Manual planning remained usable; timing remains optional/experimental.

Actual final receipt: `0x6d003462646e188e4d9c5e3ba223ad4563f655ea272c91b6cad1217fd0aee655`.

Plan transaction: `0x111ef656fd5476ec11a163b0b3309a2abecb79c84e1c0c94dd01c65e747bc22c`.

Cancellation-result transaction: `0x9dacedf203a94352e4e5d61f03a6fcd458b1e04cc8d504148eb0e0bf98e1ba53`.

Earlier integration attempts are documented in status section 24. One stopped on the provisional gas bound before a durable signature; its later exact transaction reconciled after fixture cleanup. Another completed both real transactions and valid proof checks, then the test incorrectly expected changing an unused edge interval to change arithmetic. The corrected active-baseline mutation test passed. Failed attempts are not silently relabeled or counted as the final acceptance flow. Consented public copies remain de-identified after temporary accounts are deleted.

Normal tests/CI are isolated and never execute these live commands. The harness stopped its own worker. A local worker must be running for new publication; public M10 pages and M11 deployment/release acceptance remain pending.
