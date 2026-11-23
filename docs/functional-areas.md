# Functional area proposal for the harness maintainer

The current preset places all frontend implementation under `web/**`. The five functional streams need independent claim and review ownership. The earlier visual tasks do not define product-path ownership. Keep the current protected configuration in force until the maintainer reviews a change.

| Area | Ownership | Proposed paths |
| --- | --- | --- |
| `statistics` | Statistical Engine | `web/src/functional/statistics/**` |
| `simulation` | Monte Carlo and Convergence | `web/src/functional/simulation/**` |
| `inference` | Estimation, Intervals and later testing | `web/src/functional/inference/**` |
| `research-data` | Journal, snapshots and export | `web/src/functional/research-data/**` |
| `e2e` | Scientific QA and independent acceptance | Existing `tests/acceptance/**`, `tests/pending/**`, `tests/e2e/**`; add `tests/fixtures/**` |
| `contracts` | Captain coordinates public contracts | Existing `contracts/**` |
| `web` | Captain's functional adapter and frontend | Explicit `web/src/functional/adapters/**` and captain-owned app paths; replace catchall with enumerated paths that do not overlap the independent functional directories |
| `design` | Product owner | Existing visual paths; if adjusting `web`, assign visual path ownership once |
| `infra` | Captain's scaffold coordination | Existing infra paths within the maintainer-approved workflow |

The browser-only skeleton uses React/Vite/TypeScript, Vitest, Playwright and a seeded worker loopback fixture. The maintainer should align the scaffold and check paths with the static product. Existing GitHub Actions protections, two-host review and independent high-risk tests remain applicable. Continue running the checked-in workflows. Only the authorized maintainer may change protected files. Publish and verify area labels through the documented crew flow after that review.

The eventual functional adapter consumes a typed RunSpec and emits committed ExperimentSnapshots and prepared chart series. The owner can wire these to the existing visual components after agreeing on the adapter contract. Neither the worker nor the math, storage and reference-test packages need React, CSS, shaders or a chart library.
