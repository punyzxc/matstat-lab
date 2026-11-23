<!-- crew:prd status: draft by: - at: - -->
# STATUM LAB functional development

How do sample size and distribution shape affect estimator accuracy and reliable conclusions? Students and instructors use one seeded Monte Carlo laboratory to predict, run, compare and replay experiments.

## Demo and release path

1. Set a seed and a skewed model and compare a small and a large sample using aligned empirical and theoretical series (R1–R3).
2. Explain the difference with observed and theoretical statistics. The next milestone adds convergence, estimation and interval coverage (R5–R7, R9–R10).
3. Save, reload and export the same results and provenance (R3, R4).
4. Deliver typed data to the captain-owned interface. Verify the browser Worker, accessible operation and replay (R8, R9, R11, R12).
5. Add the exact sign-test study after the core inference experiments (R13).

React/Vite, TypeScript and a browser Worker form the runtime. IndexedDB retains versioned snapshots. Vitest and Playwright run in CI. NumPy/SciPy supply offline reference fixtures. Visual work remains with the product owner. [Maintainer area proposal](functional-areas.md) · [Decisions](decisions.md)

## Ownership and review

Confirmed collaborators are `GredesCerber` for the statistical-engine investigation and `Jumalinova` for simulation. They are proposed production owners for the same streams. Captain `punyzxc` coordinates review, contracts, the static scaffold, and the consumer-facing adapter. Inference, research data and QA remain unassigned until owners are confirmed. Add the native crew-team block when the roster and paths are confirmed. High-risk changes require acceptance tests written by a separate agent, cross-vendor review and the harness's high-risk merge workflow.

The skeleton is the prerequisite for production. After the contracts, random-source work, sample summaries, independent fixtures and the journal schema can proceed in parallel. Estimation and intervals use the verified core and worker. The adapter allows the owner to wire snapshots and prepared chart data to existing UI.

```crew-epic
id: E1
title: Statistical engine and chart data
scenario: Study how distributions and n shape empirical measures.
demo: Reproduce pinned draws and compare aligned histograms and ECDF with theory.
```

```crew-epic
id: E2
title: Monte Carlo and convergence
scenario: Run independent trials with replay and cancellation.
demo: Compare a running mean with the distribution of independent means.
```

```crew-epic
id: E3
title: Statistical inference
scenario: Measure estimator accuracy and interval coverage before testing hypotheses.
demo: Compare variance estimators and reproduce a coverage study.
```

```crew-epic
id: E4
title: Research journal and export
scenario: Save, compare and replay experiments with provenance.
demo: Restore a saved result after reload and export its values.
```

```crew-epic
id: E5
title: Scientific validation and integration
scenario: Verify the complete flow with independent fixtures and protected review.
demo: Run the reference suite and a browser Worker acceptance scenario.
```

```crew-task
id: T1
title: Establish a static app and Worker smoke harness
epic: E5
area: infra
tier: high
risk: high
skeleton: true
paths: [web/package.json, web/src/functional/adapters/smoke/**, tests/e2e/foundation/**, infra/**]
req: [R11, R12]
tests: [unit, contract, e2e]
goal: Establish a static app and Worker smoke harness as a verified capability of the shared laboratory.
acceptance:
  - Given a clean approved scaffold When lint types Vitest build and Playwright run Then they pass against a static Vite app.
  - Given a built static app When the smoke fixture sends a seeded request to a real browser Worker Then it receives the expected draw without changing the visual implementation.
```

```crew-task
id: T2
title: Define experiment state and chart series contracts
epic: E5
area: contracts
tier: high
risk: high
paths: [contracts/experiments/**]
req: [R1, R3, R4, R7, R9]
tests: [unit, contract, e2e]
goal: Define experiment state and chart series contracts as a verified capability of the shared laboratory.
acceptance:
  - Given a run with theory and observations When its snapshot is encoded and decoded Then it preserves IDs, parameters, seed, algorithm and schema versions, empirical and theoretical series, warnings and execution metadata.
  - Given malformed inputs, an illegal transition or an unsupported version When the boundary validates it Then it returns a typed error and leaves committed state unchanged.
```

```crew-task
id: T3
title: Write independent acceptance tests for T2
epic: E5
area: e2e
tier: mid
risk: med
tests_for: T2
tests: [e2e]
```

```crew-task
id: T4
title: Implement a versioned seeded random source
epic: E1
area: statistics
tier: high
risk: high
after: [T2]
paths: [web/src/functional/statistics/random/**]
req: [R3, R9]
tests: [unit, contract, e2e]
goal: Implement a versioned seeded random source as a verified capability of the shared laboratory.
acceptance:
  - Given pinned seed vectors including zero and 2³²−1 When the generator is restored Then uint32 vectors are exact and draw uniforms stay in their documented interval.
  - Given indexed replicates When chunk boundaries differ Then stream derivation produces the same pinned vectors.
```

```crew-task
id: T5
title: Write independent acceptance tests for T4
epic: E5
area: e2e
tier: mid
risk: med
tests_for: T4
after: [T2]
tests: [e2e]
```

```crew-task
id: T6
title: Implement Normal, Uniform and Exponential distributions
epic: E1
area: statistics
tier: high
risk: high
after: [T2, T4]
paths: [web/src/functional/statistics/distributions/continuous/**]
req: [R1, R9]
tests: [unit, contract, e2e]
goal: Implement Normal, Uniform and Exponential distributions as a verified capability of the shared laboratory.
acceptance:
  - Given independent SciPy fixtures When PDF, CDF and moments are evaluated Then they match absolute and relative tolerances including support boundaries.
  - Given invalid parameters and endpoint values When the API validates them Then it returns documented errors or exact limits and sampling consumes the injected RNG.
```

```crew-task
id: T7
title: Write independent acceptance tests for T6
epic: E5
area: e2e
tier: mid
risk: med
tests_for: T6
after: [T2]
tests: [e2e]
```

```crew-task
id: T8
title: Implement Bernoulli, Binomial and Poisson distributions
epic: E1
area: statistics
tier: mid
risk: med
after: [T2, T4]
paths: [web/src/functional/statistics/distributions/discrete/**]
req: [R1, R9]
tests: [unit, contract]
goal: Implement Bernoulli, Binomial and Poisson distributions as a verified capability of the shared laboratory.
acceptance:
  - Given p=0/1, Binomial n=0 and Poisson λ=0 When mass, CDF and moments are evaluated Then degenerate cases and integer support match independent references.
  - Given large valid finite parameters When mass and CDF are evaluated Then results are finite, normalized within tolerance and monotone for the CDF.
```

```crew-task
id: T9
title: Summarize samples with explicit edge-case semantics
epic: E1
area: statistics
tier: high
risk: high
after: [T2]
paths: [web/src/functional/statistics/summary/**]
req: [R1, R6, R9]
tests: [unit, contract, e2e]
goal: Summarize samples with explicit edge-case semantics as a verified capability of the shared laboratory.
acceptance:
  - Given fixed tied and high-offset samples When summary statistics are evaluated Then mean, median, mode policy, extrema, range, quartiles, variational order, counts, relative frequencies and both variance denominators match independent fixtures.
  - Given empty, singleton or nonfinite inputs When building a summary Then results follow the specified undefined or error policy and the input is unchanged.
```

```crew-task
id: T10
title: Write independent acceptance tests for T9
epic: E5
area: e2e
tier: mid
risk: med
tests_for: T9
after: [T2]
tests: [e2e]
```

```crew-task
id: T11
title: Emit histogram, empirical CDF and theory series
epic: E1
area: statistics
tier: high
risk: high
after: [T6, T9]
paths: [web/src/functional/statistics/series/**]
req: [R1, R7, R9]
tests: [unit, contract, e2e]
goal: Emit histogram, empirical CDF and theory series as a verified capability of the shared laboratory.
acceptance:
  - Given the same bin edges and two sample sizes When chart data is emitted Then counts plus overflow equal n, density integrates to visible probability, and bin conventions and units are explicit.
  - Given ties and discrete or continuous models When chart series are emitted Then the ECDF is a monotone right-continuous step and PMF and PDF retain distinct measure tags.
```

```crew-task
id: T12
title: Write independent acceptance tests for T11
epic: E5
area: e2e
tier: mid
risk: med
tests_for: T11
after: [T2]
tests: [e2e]
```

```crew-task
id: T13
title: Execute replayable Monte Carlo runs in a Web Worker
epic: E2
area: simulation
tier: high
risk: high
after: [T2, T4, T6]
paths: [web/src/functional/simulation/worker/**, web/src/functional/simulation/run/**]
req: [R2, R3, R9]
tests: [unit, contract, e2e]
goal: Execute replayable Monte Carlo runs in a Web Worker as a verified capability of the shared laboratory.
acceptance:
  - Given a pinned seed and versions When uninterrupted and pause/resume runs finish Then final results match and progress revisions increase.
  - Given cancellation followed by restart When an old event arrives Then it cannot commit, the old worker terminates, and cancellation and retained bytes meet reviewed budgets.
```

```crew-task
id: T14
title: Write independent acceptance tests for T13
epic: E5
area: e2e
tier: mid
risk: med
tests_for: T13
after: [T2]
tests: [e2e]
```

```crew-task
id: T15
title: Generate LLN trajectories and CLT sampling distributions
epic: E2
area: simulation
tier: mid
risk: med
after: [T9, T13]
paths: [web/src/functional/simulation/convergence/**]
req: [R5, R7, R9]
tests: [unit, contract]
goal: Generate LLN trajectories and CLT sampling distributions as a verified capability of the shared laboratory.
acceptance:
  - Given independent streams When convergence runs Then running means match prefixes and independent means report μ and σ²/n as theory.
  - Given a finite-variance skewed model and fixed replicates When results are checked Then moments agree within a predeclared Monte Carlo bound and the normal curve is labeled an approximation.
```

```crew-task
id: T16
title: Measure estimator bias, variance and MSE
epic: E3
area: inference
tier: mid
risk: med
after: [T9, T13]
paths: [web/src/functional/inference/estimation/**]
req: [R6, R7, R9]
tests: [unit, contract]
goal: Measure estimator bias, variance and MSE as a verified capability of the shared laboratory.
acceptance:
  - Given known analytical targets When estimators are compared Then bias, variance and MSE match reference values with explicit denominators.
  - Given several sample sizes When the study emits series Then estimator identities and n are retained and finite simulations are described as evidence about consistency.
```

```crew-task
id: T17
title: Evaluate confidence intervals and empirical coverage
epic: E3
area: inference
tier: high
risk: high
after: [T6, T9, T13]
paths: [web/src/functional/inference/intervals/**]
req: [R7, R9, R10]
tests: [unit, contract, e2e]
goal: Evaluate confidence intervals and empirical coverage as a verified capability of the shared laboratory.
acceptance:
  - Given a valid Normal model and method When intervals are computed Then bounds match independently evaluated quantiles and each replicate records coverage of the true parameter.
  - Given a model or n outside assumptions When a run is requested Then it returns typed applicability feedback and no coverage claim.
  - Given fixed independent replications for an exact nominal level p When coverage is measured Then hits over R and Monte Carlo uncertainty are recorded and the result meets a predetermined band.
```

```crew-task
id: T18
title: Write independent acceptance tests for T17
epic: E5
area: e2e
tier: mid
risk: med
tests_for: T17
after: [T2]
tests: [e2e]
```

```crew-task
id: T19
title: Persist the experiment journal and latest result per module
epic: E4
area: research-data
tier: high
risk: high
after: [T2]
paths: [web/src/functional/research-data/journal/**]
req: [R3, R4, R9]
tests: [unit, contract, e2e]
goal: Persist the experiment journal and latest result per module as a verified capability of the shared laboratory.
acceptance:
  - Given supported snapshots When the browser reloads Then timestamps, names, results and replay inputs are restored and the latest committed record is resolved per module.
  - Given duplicate IDs, rename, deletion or a supported older schema When storage mutates or migrates Then data and indexes stay consistent and chart series require no Worker rerun.
```

```crew-task
id: T20
title: Write independent acceptance tests for T19
epic: E5
area: e2e
tier: mid
risk: med
tests_for: T19
after: [T2]
tests: [e2e]
```

```crew-task
id: T21
title: Export and compare saved experiments with provenance
epic: E4
area: research-data
tier: high
risk: high
after: [T2, T19]
paths: [web/src/functional/research-data/export/**, web/src/functional/research-data/comparison/**]
req: [R2, R3, R4, R9]
tests: [unit, contract, e2e]
goal: Export and compare saved experiments with provenance as a verified capability of the shared laboratory.
acceptance:
  - Given persisted results When CSV, versioned JSON or a structured report is produced Then numbers and metadata match the snapshot.
  - Given two records When comparison is requested Then it returns original IDs, units and shared bounds or an explicit incompatibility reason.
```

```crew-task
id: T22
title: Write independent acceptance tests for T21
epic: E5
area: e2e
tier: mid
risk: med
tests_for: T21
after: [T2]
tests: [e2e]
```

```crew-task
id: T23
title: Expose a result adapter for existing visual components
epic: E5
area: web
tier: high
risk: high
after: [T11, T13, T19, T21]
paths: [web/src/functional/adapters/experiment/**]
req: [R1, R2, R3, R4, R7, R9]
tests: [unit, contract, e2e]
goal: Expose a result adapter for existing visual components as a verified capability of the shared laboratory.
acceptance:
  - Given a demo run and mock existing consumers When the adapter completes, saves, restores and exports it Then chart and latest-result consumers receive one committed snapshot revision.
  - Given an invalid request or stale Worker reply When consumed Then it emits typed feedback and preserves the valid result.
```

```crew-task
id: T24
title: Write independent acceptance tests for T23
epic: E5
area: e2e
tier: mid
risk: med
tests_for: T23
after: [T2]
tests: [e2e]
```

```crew-task
id: T25
title: Provide an exact sign test and power study
epic: E3
area: inference
tier: mid
risk: med
after: [T16, T17]
paths: [web/src/functional/inference/hypothesis/**]
req: [R7, R9, R13]
tests: [unit, contract]
goal: Provide an exact sign test and power study as a verified capability of the shared laboratory.
acceptance:
  - Given null p=0.5 and non-tied signs When testing with declared alternative and alpha Then p-value, decision and rejection region match exact binomial fixtures.
  - Given a specified alternative and seeded replicates When rejection frequencies are estimated Then type I, type II and power are labeled by generating model with Monte Carlo uncertainty.
```
