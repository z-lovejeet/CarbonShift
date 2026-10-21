# CarbonShift documentation

Prepared 20 October 2026; M02 update 21 October. This is the index and reading guide for **14 project documents plus three guidance files**. The application foundation and deterministic domain engine now exist; the complete product and its service integrations remain unfinished. See the root README and status log for verified current behavior.

## Start here

For product review, read [01 — PRD](01-prd-and-blueprint.md), [08 — calculation methodology](08-scheduling-and-carbon-methodology.md), and [10 — blockchain/evidence](10-blockchain-and-evidence-specification.md) first. They contain the most consequential scope and trust choices.

At the start of every phase, read [AGENTS.md](../AGENTS.md), [decisions and status](decisions-and-status.md), and all fourteen numbered documents, following the user's 21 October instruction. Within that phase, revisit the specifications linked by the current task in [13 — roadmap](13-development-roadmap-and-codex-tasks.md).

The documents form the **working implementation baseline** adopted during M00 under the user's instruction to start that phase. Individual defaults were not separately approved one by one. Scope, quality expectations, external dependencies, and the phase stopping point are recorded in the status log; a specification is not evidence of implemented behavior.

## Document index

| # | Document | Authoritative subject |
|---|---|---|
| 01 | [PRD and product blueprint](01-prd-and-blueprint.md) | Intent, audience, scope, differentiating hypothesis |
| 02 | [Features, pages, and flows](02-features-pages-and-flows.md) | Feature IDs, page inventory, user journeys |
| 03 | [UI/UX and design system](03-ui-ux-and-design-system.md) | Layouts, components, copy, visual/accessibility rules |
| 04 | [Architecture and system design](04-architecture-and-system-design.md) | Module boundaries, data flow, worker, failure handling |
| 05 | [Tech stack and folder structure](05-tech-stack-and-folder-structure.md) | Dependencies, proposed file tree, version policy |
| 06 | [Data model and state machines](06-data-model-and-state-machines.md) | Types, tables, ownership, transitions |
| 07 | [API and integrations](07-api-and-integrations.md) | Endpoint contracts, provider adapters, errors |
| 08 | [Scheduling and carbon methodology](08-scheduling-and-carbon-methodology.md) | Time rules, formulas, baselines, evidence limits |
| 09 | [AI agents, models, and workflow](09-ai-agents-models-and-workflow.md) | AI responsibilities, prompts, models, fallback |
| 10 | [Blockchain and evidence](10-blockchain-and-evidence-specification.md) | Manifests, hashes, contract, verification claims |
| 11 | [Security, privacy, and abuse](11-security-privacy-and-abuse.md) | Authorization, secrets, publication, retention |
| 12 | [Testing and AI evaluation](12-testing-and-ai-evaluation.md) | Acceptance tests, fixtures, metrics, release evidence |
| 13 | [Development roadmap and Codex tasks](13-development-roadmap-and-codex-tasks.md) | 12 build phases, 60 focused tasks, dependencies, checks, and session handoffs |
| 14 | [Manual setup guide](14-manual-setup-guide.md) | Builder accounts, keys, environment, essential deployment |

The other guidance files are this index, root `AGENTS.md`, and `docs/decisions-and-status.md`. Standalone documents 15 and 16 were removed at the user's request and have not been created.

## Task-specific reading

| Task | Read |
|---|---|
| Understand the product | 01, 02, decision log |
| Implement pages/components | 02, 03, relevant API schemas in 07 |
| Build scheduler/carbon math | 06, 08, tests in 12 |
| Add database/auth | 04, 06, 07, 11 |
| Add Gemini/Groq | 07, 09, 11, AI tests in 12 |
| Add contract/public receipts | 06, 07, 10, 11, contract tests in 12 |
| Configure environment/deployment | 05, 14, current milestone in 13 |
| Resume after an interruption | Decision/status log, current task, relevant source files and latest test evidence |

## How documents stay consistent

Feature IDs `F01`–`F12` map to tests `T01`–`T12`; pages use `P01`–`P12`; implementation phases preserve milestone IDs `M00`–`M11`. Each phase has tasks `.01`–`.05`, such as `M02.03`, and a specific exit gate.

Use one focused task at a time. The roadmap specifies required reading, work areas, expected outputs, checks, external dependencies, and prompts for starting or resuming work. Record task evidence in the decision/status log; an unavailable API key blocks its dependent integration, not unrelated local development.

Each subject has one owner above. Other documents link to it instead of redefining it. A code-driven change to a schema, method, role, or scope must update the owning document and affected tests.

“Proposed” means a design decision. “Verified source” means an official reference was inspected. “Implemented” and “passed” require code and actual execution evidence. No benchmark, account access, deployment, or integration result has been established merely by writing these files.

The [earlier build guide](../research/wave-2/top-three-build-guide.md) and [project assessment](../research/wave-2/project-ideas-claude-analysis.md) remain background. Their alternative projects, rough estimates, and broader ideas do not override this bounded CarbonShift specification.
