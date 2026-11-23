# Discovery plan

The repository is in Discovery. Research results live under docs/research and prototype code lives under spikes. The reviewed PRD and captain approval govern the build.

## Integration and references

```crew-research
id: visual-foundation
question: Can a keyboard-accessible sci-fi shell make a seeded distribution and its ASCII data readable?
area: web
owner: punyzxc
budget_hours: 3
```

```crew-research
id: design-references
question: Can the team review the full visual reference set alongside the initial project brief and design direction?
area: research
owner: punyzxc
budget_hours: 1
```

## Orbital workspace

The latest brief centres the home interface on Earth. The existing prototype in [PR #9](https://github.com/punyzxc/matstat-lab/pull/9) demonstrates the integrated experience. These six research tasks produce independent evidence for the build plan. Each has its own document and may use a standalone spike. Work does not wait for another research issue to close.

| Area | Focus | Evidence |
| --- | --- | --- |
| design | visual-theme | A window anatomy and state matrix, two viewport stencils, and evidence for keyboard and pointer activation. |
| web | visual-motion | A motion token table, interruption demo, and a reduced-motion comparison. |
| contracts | explorer-chart | A typed last-result/preview proposal, deterministic fixtures for six modules, and a preview encoding matrix. |
| design | ascii-art | Two neutral monochrome studies with frame fragments, annotation rules and a measured ASCII example. |
| e2e | visual-accessibility | Reproducible checks and a browser evidence matrix for desktop, narrow, projector and expanded registries. |
| web | orbital-composition | A diagram of normalized anchor geometry and a responsive composition spike with placeholder window footprints. |

```crew-research
id: visual-theme
question: Which reusable orbital window makes a laboratory and its last result easy to identify and open?
area: design
budget_hours: 2
```

```crew-research
id: visual-motion
question: Which shared motion policy keeps the globe, data links and result transitions responsive and readable?
area: web
budget_hours: 2
```

```crew-research
id: explorer-chart
question: Which snapshot contract and scientific encodings preserve the last result across all six module previews?
area: contracts
budget_hours: 3
```

```crew-research
id: ascii-art
question: Which scientific HUD and ASCII details make orbital connections legible without adding visual noise?
area: design
budget_hours: 2
```

```crew-research
id: visual-accessibility
question: Can the orbital workspace scale while preserving keyboard operation, motion preferences and performance?
area: e2e
budget_hours: 2
```

```crew-research
id: orbital-composition
question: How should the Earth scene, slot registry and trajectories scale into one coherent laboratory interface?
area: web
owner: GredesCerber
budget_hours: 3
```

The initial integration and the reference archive remain in issues [#1](https://github.com/punyzxc/matstat-lab/issues/1) and [#7](https://github.com/punyzxc/matstat-lab/issues/7). Collaborators claim available work through `crew task next` and `crew task claim <issue>`.

## Remaining scientific questions

Agree on the initial distributions and reference tolerances, worker and replay contract, export and local retention, classroom terminology and projector settings, and the maintainer-reviewed frontend-only setup. See [brief analysis](brief-analysis.md).

## Exit criteria

- [ ] Document the visual choices and verify keyboard, responsive, and reduced-motion behavior.
- [ ] Resolve or record all scientific questions and operational risks.
- [ ] Confirm functional ownership of the six areas and the frontend-only stack.
- [ ] Close research tasks and resolve human questions.
- [ ] Review the final PRD with an agent of another vendor before captain approval.
