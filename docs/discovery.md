# Discovery plan

The visual iteration tests six independent parts of the scientific workspace. The repository is in Discovery. Prototype code goes under `spikes/<id>/`; the protected build workflow applies after reviewed research and PRD approval.

## Visual iteration

```crew-research
id: visual-foundation
question: Can a keyboard-accessible sci-fi shell make a seeded distribution and its ASCII data readable?
area: web
owner: punyzxc
budget_hours: 3
```

```crew-research
id: visual-theme
question: Which design tokens support a high-contrast black-and-white research workspace with one spectral accent?
area: design
budget_hours: 2
```

```crew-research
id: visual-motion
question: Which short, interruptible transitions clarify parameter changes, data updates and reduced-motion states?
area: web
budget_hours: 2
```

```crew-research
id: explorer-chart
question: Which histogram, ECDF and ASCII encodings best preserve scale and teach the theory comparison?
area: contracts
budget_hours: 3
```

```crew-research
id: ascii-art
question: Which original ASCII and point-cloud motifs support the research workspace and keep measured data legible?
area: design
budget_hours: 2
```

```crew-research
id: visual-accessibility
question: Does the workspace remain usable with keyboard input, reduced motion, a narrow screen and projector scaling?
area: e2e
budget_hours: 2
```

```crew-research
id: design-references
question: Can the team review the full visual reference set alongside the initial project brief and design direction?
area: research
owner: punyzxc
budget_hours: 1
```

The first six questions can run in parallel. Each contributor writes the research result in their own output document. A shared reference index connects the files to design decisions. Once known, collaborators may claim any available work via the normal queue.

## Remaining scientific questions

Agree on the initial distributions and reference tolerances, worker and replay contract, export and local retention, classroom terminology and projector settings, and the maintainer-reviewed frontend-only setup. See [brief analysis](brief-analysis.md).

## Exit criteria

- [ ] Document the visual choices and verify keyboard, responsive, and reduced-motion behavior.
- [ ] Resolve or record all scientific questions and operational risks.
- [ ] Confirm functional ownership of the six areas and the frontend-only stack.
- [ ] Close research tasks and resolve human questions.
- [ ] Review the final PRD with an agent of another vendor before captain approval.
