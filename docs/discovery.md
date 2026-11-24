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

## Follow-ups from the merged research (2026-11-24)

The merged research (#4, #6, #14, #15, #22) left these open points. Each one has its own deliverable and can run in parallel.

```crew-research
id: snapshot-comparison-fields
question: Which fields must the next ExperimentSnapshot version add (axis units, series kind, histogram normalization, ECDF scale, variance divisor, quantile method) so comparisons and exports never guess, and how do version 1 records migrate?
area: contracts
owner: punyzxc
budget_hours: 2
```

```crew-research
id: scientific-decision-register
question: Which scientific choices from the merged research (tolerances, divisors, replay bounds, interval eligibility, coverage bands) are decided, which are deferred, and who confirms each?
area: research
owner: punyzxc
budget_hours: 2
```

```crew-research
id: frontend-scaffold
question: Can a static Vite, React and TypeScript scaffold without a server run Workers, IndexedDB, Vitest and Playwright locally and in CI, with the disjoint area paths proposed in #16?
area: web
owner: pluxha
budget_hours: 3
```

```crew-research
id: qa-multiplicity
question: How should a suite of many Monte Carlo oracle and coverage checks keep its false failure rate fixed, and which cases are mandatory for the first release?
area: e2e
owner: adekin06
budget_hours: 2
```

```crew-research
id: convergence-teaching
question: Which fixed-seed LLN prefix and CLT replicate fixtures, with predeclared bands, show convergence correctly for the Convergence module?
area: research
owner: Jumalinova
budget_hours: 2
```

## Exit criteria

- [ ] Record resolved or explicitly deferred scientific decisions, including replay bounds and interval eligibility.
- [x] Record the reproducible demo scenario and functional ownership boundary in the brief analysis.
- [ ] Verify a frontend-only scaffold and review the required path and check changes through the maintainer workflow.
- [ ] Confirm all functional owners as repository members and complete independent reviews of the research.
- [ ] Land the final PRD on main through a reviewed PR.
