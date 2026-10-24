# M08 authored proof fixtures

All addresses, IDs, grid values, clocks and chain observations in this folder are synthetic. They are isolated tests, never live grid fallback data, a deployment, a real user report or evidence of appliance operation. Tests deliberately exercise both `mode=live` and `mode=demo`; the enum does not turn an authored fixture into real-world evidence.

`golden-bundle.json` freezes a plan plus pending and updated public results. Private revision 2 is deliberately skipped. The second updated estimate is negative (higher estimated emissions) and stays signed. The method descriptor is embedded so the exported artifact is self-contained. `golden-digests.json` was computed with Node SHA-256 over the documented prefixes and canonical strings. Tests compare these fixed values against the browser-safe implementation; they do not rewrite them.

`observation.ts` supplies explicitly synthetic observations for failure cases. The separate `contracts/test/proof-roundtrip.test.ts` obtains real reads, block times and events from an isolated in-process Hardhat EVM, imports/exports the bundle and independently verifies it. Its chain ID 11155111 exercises the configured network pin without contacting Sepolia. No funded signer or RPC credentials are used.

A new method/schema needs a deliberate version, reviewed descriptor/digest and new fixtures; do not refresh these files to conceal a changed algorithm. Publication persistence, user consent/preview, RPC reads, worker delivery and public verification pages are later phases.
