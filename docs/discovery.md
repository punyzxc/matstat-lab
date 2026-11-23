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

## Exit criteria

- [ ] Record resolved or explicitly deferred scientific decisions, including replay bounds and interval eligibility.
- [x] Record the reproducible demo scenario and functional ownership boundary in the brief analysis.
- [ ] Verify a frontend-only scaffold and review the required path and check changes through the maintainer workflow.
- [ ] Confirm all functional owners as repository members and complete independent reviews of the research.
- [ ] Land the final PRD on main through a reviewed PR.
