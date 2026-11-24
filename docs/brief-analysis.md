# STATUM LAB brief analysis

## Three-minute demonstration

1. Choose a skewed distribution, predict the effect of a larger sample, and run a small seeded sample. Show a histogram and empirical CDF alongside theory (R1, R2, R7).
2. Compare the small sample with a larger run using the same axes and bin boundaries. Read the theoretical and observed moments and describe the observed difference (R1, R2, R7, R9).
3. Save the result and replay it from its recorded seed and engine version. Open the comparison in projector view and export the run record (R3, R4, R8).

Prepare two independently generated, versioned fixture records for the presentation fallback. Open them locally and identify them as recorded runs.

## Requirements

| ID | Priority | Requirement | Brief reference |
| --- | --- | --- | --- |
| R1 | Must | Explore a sample with histogram, empirical CDF and moments beside theory. | “Distribution Explorer” |
| R2 | Must | Configure distribution parameters and sample size, compare runs, and show progress across repeated samples. | “parameter changes between runs” |
| R3 | Must | Replay a run from versioned parameters and seed. Pause, resume and reset without contaminating the next run. | “seeded replay” |
| R4 | Must | Persist a local journal, notes and run provenance. Export machine-readable settings and results. | “local research notes, and export” |
| R5 | Must | Show running means and sampling distributions in Convergence Laboratory. | “law of large numbers” |
| R6 | Must | Compare variance estimators and report bias, variability and MSE. | “divisors n and n−1” |
| R7 | Must | Make lessons guided and assumptions explicit. Distinguish quantities and approximations. | “interpretation questions” |
| R8 | Must | Support keyboard, reduced motion, a responsive layout and projector mode in the owner-managed interface. | “projector layouts” |
| R9 | Must | Back results with mathematical contracts, reference fixtures and edge-case tests. | “independent NumPy/SciPy reference fixtures” |
| R10 | Must | Measure interval coverage and describe each interval method's assumptions. | “observed coverage” |
| R11 | Must | Coordinate six humans through native agent-crew, independent PR review and protected main. | “team Discovery mode” |
| R12 | Must | Keep the first release browser-only and validate build and deployment. | “browser-only application” |
| R13 | Could | Explore hypothesis testing and Bertrand's paradox after the core labs. | “later release” |

## Stakeholder criteria

| Stakeholder | Evidence |
| --- | --- |
| Student | Explains why individual runs vary using the displayed empirical CDF and recorded settings, steps 1–2. |
| Instructor | Replays the example and presents chart labels at shared-screen size, step 3. |
| Scientific reviewer | Reproduces values from deterministic fixtures and locates each claim's assumptions, steps 1–3. |
| Integration reviewer | Locates required PR checks, an independent review and the evidence for a protected merge. |

## Open questions and risks

| Question | Discovery owner | Evidence |
| --- | --- | --- |
| What domains, parameterizations, tolerances and chart semantics define the six distributions? | Statistical Engine, #13 | Independent formula and SciPy fixtures, including discrete endpoints. |
| What reproducibility, cancellation and retention guarantees fit the browser worker? | Monte Carlo and Simulation, #14 | Measured budgets and pinned replay across chunk sizes on named hardware. |
| Which inference methods meet their assumptions and nominal coverage? | Statistical Inference, #15 | Analytical interval bounds, predeclared Monte Carlo coverage bands, applicability warnings. |
| How should replay, retention and exports survive schema and engine version changes? | Research Data, #4 | Encoded fixture snapshots, reload, migration, rename/delete and export contracts. |
| What test and CI budget can catch scientific and lifecycle regressions? | Scientific QA, #6 | Independent fixture plan, Vitest, Worker and Playwright checks, acceptance author separation. |
| Can five owners work in independent directories under the current broad web area? | Captain and harness maintainer | Maintainer-reviewed area mapping and sanitized static scaffold. |

The main risks are unstable tail probabilities, finite-sample overclaims, incorrect coverage, cross-engine floating point, worker event races, retained-data growth, local storage failure and blocked protected checks. Version the sampler and result encoding. Fix tolerances before running seeded fixtures. Label assumptions and bound chunks and retained arrays. Verify a protected PR once CI is restored. Primary course PDFs are still pending.

## MVP boundary

Release scope ends at the four core laboratories. Hypothesis testing, Bertrand's paradox, account management, shared cloud history and paid services are deferred.

## Stack

The web-node preset currently includes a server scaffold. The proposal uses the frontend part with TypeScript, a browser Web Worker, IndexedDB for local history, Vitest and Playwright. Build and deploy the static application after the maintainer aligns scaffold, checks and paths. The chart payloads feed the existing visuals through the typed adapter. Use pinned NumPy/SciPy fixtures for reference cases. [Functional area proposal](functional-areas.md) · [Shared contract draft](functional-contract-draft.md)
