<!-- crew:prd status: draft by: - at: - -->
# STATUM LAB draft PRD

Students need a way to test how sample size and distribution shape affect statistical conclusions. Instructors need to replay the same experiment in class with legible charts, settings and assumptions.

**Demo.** Choose a skewed distribution and predict what changes with sample size. Run, pause and resume a seeded experiment (R1–R3). Compare two sample sizes with aligned charts and read theory next to observed moments (R7, R9). Save, reopen, replay, and export in projector mode (R4, R8).

The first slice is Distribution Explorer. Convergence, Estimation and Confidence Intervals follow in that order with a distinct mathematical contract and reviewed reference tests for each (R5, R6, R10). Later scope includes hypothesis testing and Bertrand's paradox (R13). Shared cloud history, a server API and accounts are outside the first release. Scientific and classroom acceptance appear in the [brief analysis](brief-analysis.md).

Convergence pairs a running mean from a single sequence with a separate sampling distribution based on independent repetitions. Estimation reports the observed bias, variance and MSE of each estimator with a documented replicate budget. Confidence Intervals shows repeated-sample coverage with the count of intervals, nominal level, method assumptions, and Monte Carlo uncertainty.

**Stack.** React/Vite TypeScript on Vercel, with a Web Worker and pure statistics modules, ECharts, Tailwind, shadcn/ui, KaTeX and IndexedDB. Checks use strict TypeScript, ESLint, Vitest, Playwright and reference fixtures from pinned NumPy/SciPy. The maintainer must align the web-node scaffold, checks and path mappings with the frontend-only decision before this plan is applied (R11, R12).

## Proposed responsibility and path mapping

The paths below are intended locations for implementation. Map these globs in `crew.config.json` through the harness maintainer. Assign both tooling labels under Platform to the same person so acceptance-test tasks can use the harness's dedicated paths. The captain additionally owns the special `review` label and routes reviews to an independent agent. Captain `punyzxc` and deputy `GredesCerber` are known. Business areas remain proposed, pending team membership and confirmation.

| Responsibility | Proposed crew area and paths |
| --- | --- |
| Statistical Core | `statistics` → `web/src/core/statistics/**`, `web/src/core/distributions/**`, `web/src/core/random/**`, `contracts/statistics/**`, `tests/fixtures/statistics/**` |
| Simulation Engineering | `simulation` → `web/src/core/simulation/**`, `web/src/workers/**`, `web/src/hooks/**` |
| Scientific Visualization | `visualization` → `web/src/components/charts/**`, `web/src/features/distributions/**`, `web/src/features/convergence/**`, `web/src/features/estimation/**`, `web/src/features/confidence/**` |
| UI/UX & Design System | `design` → `design/**`, `web/src/app/**`, `web/src/components/ui/**`, `web/src/components/laboratory/**`, `web/src/styles/**`, `web/src/stores/**` |
| Pedagogy & Research | `research` → `docs/research/**`, `web/src/features/education/**` |
| Quality, Integration & Platform | `infra` → `infra/**`, `.github/**`, `web/vercel.json`; `e2e` → `tests/e2e/**`, `tests/acceptance/**`, `tests/pending/**` |

Add the native `crew-team` block after all six logins have been confirmed as repository members. Give each active area one owner. Reserve `review` for the captain and add it to the captain's functional area on the same line. [Crew task and team format](https://github.com/GredesCerber/agent-crew/blob/main/skills/crew-kickoff/task-format.md)

## Candidate foundation tasks

These task blocks use the proposed area names. Validate them after Discovery, use `crew task lint`, and preview with `crew kickoff`. Apply only after the captain approves the resulting PRD revision. The team will decompose the three follow-on experiments after their Discovery contracts are agreed.

```crew-task
id: T1
title: Establish the static STATUM LAB skeleton
area: infra
tier: high
risk: high
skeleton: true
req: [R11, R12]
paths: [web/**, tests/e2e/**, infra/**]
tests: [unit, e2e]
goal: Prove that a browser build and a worker can be tested and deployed together.
acceptance:
  - Given a clean checkout When the approved web-node scaffold and checks run Then lint, types, unit tests and the Playwright smoke test pass on the static application.
  - Given the built application When its smoke test starts the worker Then a deterministic result is visible in the page and the build output can be served from web/dist.
```

```crew-task
id: T2
title: Validate distribution contracts and build the seeded statistical core
area: statistics
tier: high
risk: high
req: [R1, R3, R9]
paths: [contracts/statistics/**, tests/fixtures/statistics/**, web/src/core/statistics/**, web/src/core/distributions/**, web/src/core/random/**]
tests: [unit, contract, e2e]
goal: Provide deterministic sampling and independent reference checks for the first laboratory.
acceptance:
  - Given the approved contract and recorded seed When the core is exercised Then the sequence matches golden vectors and supported CDFs and moments match recorded references within documented tolerances.
  - Given small samples and invalid domains When statistics are requested Then undefined variance and parameter errors have the specified result.
```

```crew-task
id: T3
title: Specify independent mathematical acceptance checks
area: e2e
tier: high
tests_for: T2
```

```crew-task
id: T4
title: Run reproducible experiments in a Web Worker
area: simulation
tier: high
risk: high
after: [T2]
req: [R2, R3]
paths: [web/src/core/simulation/**, web/src/workers/**, web/src/hooks/**]
tests: [unit, e2e]
goal: Implement a versioned run protocol with bounded chunks and safe state transitions.
acceptance:
  - Given identical settings When one run pauses and resumes while the other is uninterrupted Then both final results match under the replay contract.
  - Given a running experiment When Reset is acknowledged and a new run starts Then late snapshots from the previous run have no effect.
```

```crew-task
id: T5
title: Specify independent worker lifecycle acceptance checks
area: e2e
tier: high
tests_for: T4
after: [T2]
```

```crew-task
id: T6
title: Build the accessible laboratory workspace
area: design
tier: high
risk: high
req: [R2, R8]
paths: [design/**, web/src/app/**, web/src/components/ui/**, web/src/components/laboratory/**, web/src/styles/**]
tests: [unit, e2e]
goal: Deliver responsive controls, plot slots and projector presentation.
acceptance:
  - Given a keyboard-only user When they navigate the parameter form and change an invalid field Then focus is visible and feedback identifies how to repair the field.
  - Given a run in projector or reduced-motion mode When the result updates Then labels remain legible and the controls remain operable.
```

```crew-task
id: T7
title: Specify accessibility and projector acceptance checks
area: e2e
tier: high
tests_for: T6
```

```crew-task
id: T8
title: Present Distribution Explorer theory and experiment
area: visualization
tier: high
risk: high
after: [T4, T6]
req: [R1, R2, R7, R9]
paths: [web/src/components/charts/**, web/src/features/distributions/**]
tests: [unit, e2e]
goal: Compare seeded samples through a normalized histogram, ECDF, theoretical overlay and moments.
acceptance:
  - Given a fixture run When the charts and value table render Then all values come from one snapshot and series labels distinguish experiment and theory.
  - Given two comparable runs When the user opens comparison Then bin boundaries and applicable domains match and both run settings are visible.
```

```crew-task
id: T9
title: Specify Distribution Explorer chart acceptance checks
area: e2e
tier: high
tests_for: T8
after: [T4, T6]
```

```crew-task
id: T10
title: Add a guided Distribution Explorer lesson
area: research
tier: high
risk: high
after: [T8]
req: [R7]
paths: [docs/research/**, web/src/features/education/**]
tests: [e2e]
goal: Let students predict, compare and explain how sample size changes observed results.
acceptance:
  - Given a student opens the lesson When they follow the seeded scenario Then they encounter a prediction before the run, a controlled change in sample size, and a question grounded in the observed and theoretical values.
```

```crew-task
id: T11
title: Specify the student lesson acceptance check
area: e2e
tier: mid
tests_for: T10
after: [T8]
```

```crew-task
id: T12
title: Save and replay research runs and export retained results
area: design
tier: high
risk: high
after: [T8]
req: [R3, R4]
paths: [web/src/stores/**, web/src/components/laboratory/**, web/src/app/**]
tests: [unit, e2e]
goal: Persist versioned journal records and export the settings and data they represent.
acceptance:
  - Given a saved run When the tab reloads Then the journal restores its note and provenance and replay uses the supported recorded engine version.
  - Given a retained run When the user exports JSON or CSV Then exported values match the recorded data and the JSON carries its schema version and settings.
```

```crew-task
id: T13
title: Specify journal and replay acceptance checks
area: e2e
tier: high
tests_for: T12
after: [T8]
```

```crew-task
id: T14
title: Verify the static Vercel preview
area: infra
tier: high
risk: high
after: [T10, T12]
req: [R11, R12]
paths: [infra/**, web/vercel.json]
tests: [e2e]
goal: Show the full first laboratory in the team's approved deployment workflow.
acceptance:
  - Given the reviewed Vercel build When an instructor opens the preview and runs the demonstration Then the production assets load, the worker responds and the replayed display matches the approved test fixture.
```

```crew-task
id: T15
title: Specify the deployed demo acceptance check
area: e2e
tier: mid
tests_for: T14
after: [T10, T12]
```
