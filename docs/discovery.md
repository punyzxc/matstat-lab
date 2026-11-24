# Functional Discovery

The product owner assigned visual design to the captain on 2026-11-23. Functional research is browser-only, type-safe and independent of the visual implementation. Workers, chart data and the local journal share the result contract.

## Current investigation queue

The five investigations have independent deliverables and can use fixtures. The production tasks and epics are specified in [the draft PRD](prd.md). Existing prototype and reference review stay in PR #9 and PR #8. The earlier design-only investigations are out of the functional queue. Preserve the claimant's handoff for #12.

```crew-research
id: statistical-engine
question: Which distribution parameterizations, errors and fixtures give a verifiable statistical core?
area: research
owner: GredesCerber
budget_hours: 3
```

```crew-research
id: simulation-engine
question: Which worker protocol, replay rules and measured budgets support independent Monte Carlo experiments?
area: web
owner: Jumalinova
budget_hours: 3
```

```crew-research
id: inference-methods
question: Which estimators and confidence intervals are valid for the initial experiments and how should they be validated?
area: research
budget_hours: 3
```

```crew-research
id: explorer-chart
question: Which versioned snapshot preserves experiments, last results, chart data and replay across storage migrations?
area: contracts
budget_hours: 3
```

```crew-research
id: visual-accessibility
question: Which independent reference checks and worker budgets gate scientific and integration correctness?
area: e2e
output: docs/research/visual-accessibility.md
budget_hours: 3
```


## Demo and handoff investigations

These investigations use the current preview and fixtures. They can run independently of each other. Complete the assigned scientific engine and simulation investigations first when time is limited.

```crew-research
id: teaching-comparison
question: Which controlled sample-size comparison and fixed seeds teach students to distinguish experimental variation from estimator error?
area: research
owner: GredesCerber
budget_hours: 2
```

```crew-research
id: preview-reproduction
question: Can a teammate reproduce both Discovery previews from a clean clone without local paths, credentials or running services?
area: research
owner: Jumalinova
budget_hours: 1
```


## Independent evidence for result consumers

```crew-research
id: chart-fixture-audit
question: Can an independent fixture audit detect incorrect bins, ECDF steps and data rounding in saved chart payloads?
area: e2e
owner: adekin06
budget_hours: 2
```

```crew-research
id: comparison-compatibility
question: Which scientific metadata makes two saved experiments comparable before plotting them on common axes?
area: research
budget_hours: 2
```

## Exit criteria

- [ ] Record resolved or explicitly deferred scientific decisions, including replay bounds and interval eligibility.
- [x] Record the reproducible demo scenario and functional ownership boundary in the brief analysis.
- [ ] Verify a frontend-only scaffold and review the required path and check changes through the maintainer workflow.
- [ ] Confirm all functional owners as repository members and complete independent reviews of the research.
- [ ] Land the final PRD on main through a reviewed PR.

## Lecture modules (epic proposal, 2026-11-24)

The owner asked for lab modules that follow the 12 course lectures and open inside the single scene of the Orbital laboratory. [The lecture module map](research/lecture-module-map.md) gives the lecture-to-station table, the shared kernel contract and the lecture errata. Each kernel spike is pure, seeded and tested against independent references. The scene host turns kernels into stations. These blocks become the production epic "Lecture modules" after the PRD is approved.

```crew-research
id: lecture-module-map
question: How do the 12 course lectures map to in-scene lab stations, one shared kernel contract and a list of lecture errata?
area: research
owner: punyzxc
budget_hours: 2
```

```crew-research
id: scene-module-host
question: Can the Orbital laboratory host every module inside its one scene (no page scroll, no extra views) with keyboard and URL-hash state?
area: web
owner: punyzxc
budget_hours: 4
```

```crew-research
id: lecture-combinatorics
question: Which seeded kernel shows urn sampling counts, hypergeometric and balls-in-boxes laws exactly next to simulation (lecture 1)?
area: research
owner: GredesCerber
budget_hours: 3
```

```crew-research
id: lecture-bernoulli-approximations
question: Which kernel compares the exact binomial law with local, integral and Poisson approximations and their errors (lectures 3 and 9)?
area: research
owner: GredesCerber
budget_hours: 3
```

```crew-research
id: lecture-geometric-probability
question: Which seeded kernel shows frequency stabilisation, geometric probability and the three Bertrand chord schemes (lectures 1 and 4)?
area: research
owner: Jumalinova
budget_hours: 3
```

```crew-research
id: lecture-limit-theorems
question: Which kernel shows uniform-sum convolution, Chebyshev bounds against real tails, Cauchy non-convergence and the CLT (lectures 6 to 9)?
area: research
owner: Jumalinova
budget_hours: 4
```

```crew-research
id: lecture-worked-examples-audit
question: Do the worked examples of all 12 lectures hold under independent recomputation, and which reference fixtures should the kernels reuse?
area: e2e
owner: adekin06
budget_hours: 3
```

```crew-research
id: lecture-conditional-bayes
question: Which seeded kernel shows event algebra, conditional and total probability and Bayes as counts of simulated outcomes (lectures 1 and 2)?
area: research
owner: punyzxc
budget_hours: 3
```

```crew-research
id: lecture-random-vectors
question: Which kernel shows moments, the 3-sigma rule, functions of a random variable, correlation and regression lines (lectures 5 and 6)?
area: research
owner: punyzxc
budget_hours: 3
```

```crew-research
id: lecture-sampling-goodness-of-fit
question: Which kernel builds the variation series, histogram, ECDF, Kolmogorov and Pearson tests with correct degrees of freedom (lectures 10 and 12)?
area: research
owner: punyzxc
budget_hours: 3
```

```crew-research
id: lecture-estimation-intervals
question: Which kernel shows estimator bias and MSE and the coverage of normal, t and chi-square intervals and the two-proportion test (lecture 11)?
area: research
owner: punyzxc
budget_hours: 3
```

```crew-research
id: lecture-hypothesis-tests
question: Which kernel shows critical regions, type I and II errors and power for the z, t and F tests of lecture 12?
area: research
budget_hours: 3
```
