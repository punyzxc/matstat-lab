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
| R8 | Must | Support keyboard, reduced motion, both themes, a responsive layout and projector mode. | “projector layouts” |
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

| Question | Owner by discipline | Working assumption |
| --- | --- | --- |
| Which initial distributions and parameter limits fit the curriculum? | Statistical Core and Pedagogy | Normal, uniform and exponential are candidates. Validate against available lectures before committing scope. |
| What is the reproducibility guarantee across browsers and releases? | Statistical Core and Simulation | Stable draw order and exact discrete results for a pinned engine. Quantify allowed floating-point error for continuous values. |
| What laptop, sample caps and browser targets are appropriate? | Simulation and Platform | Use measured worker latency and memory on a representative classroom laptop. Set limits during Discovery. |
| What export and language conventions does the course need? | Pedagogy and Visualization | Versioned JSON for replay, CSV for data exchange, and locale-aware presentation. Confirm lesson language and CSV expectations. |
| Which chart and projector defaults communicate uncertainty? | Visualization and Design | Common scales where comparable, labeled units, shape or line style in addition to color. |
| How should frontend-only checks and code ownership be configured? | Platform and repo owner | Retain the web-node preset and align scaffold, checks and actual paths through the maintainer process before foundation. |
| Which four accounts complete the roster and who owns which area? | Captain | Functional area IDs are provisional until collaborators and availability are confirmed. |

The major risks are misleading finite-sample conclusions, nondeterministic worker scheduling, UI stalls, invalid chart comparisons, missing course materials, loss of browser data, and GitHub authentication or protection gaps. Use method contracts, deterministic order, bounded chunks, shared chart units, documented course assumptions, versioned export and a protected PR smoke run.

## MVP boundary

Release scope ends at the four core laboratories. Hypothesis testing, Bertrand's paradox, account management, shared cloud history and paid services are deferred.

## Stack

The web-node preset supplies the React/Vite base. The project needs a browser Web Worker, TypeScript contracts, ECharts, KaTeX, Tailwind, shadcn/ui and local IndexedDB. Baseline CI uses strict TypeScript, ESLint, Vitest and Playwright. Python with pinned NumPy/SciPy is used for offline reference generation. Vercel serves the static build. The preset's Fastify generator, API checks and areas need review by the harness maintainer before the skeleton task. [web-node preset](https://github.com/GredesCerber/agent-crew/blob/main/templates/stacks/web-node.json)
