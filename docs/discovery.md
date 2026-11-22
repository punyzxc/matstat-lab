# Discovery: what we research before the plan

The project starts in the **discovery phase** (`crew.config.json` → `"phase": "discovery"`): no product code yet, only research under `docs/`, throwaway experiments under `spikes/`, and `README.md` / `JOIN.md`. crew-guard enforces it. `crew kickoff --apply` ends the phase once the exit criteria below are met.

How it works:
1. The captain's agent analyzes the brief (skill `crew-brief-analysis`) and lists the open questions here as `crew-research` blocks: one question, one owner (by area), a time budget in hours.
2. `crew discover plan --apply` (captain) turns them into research tasks; the area owners' agents take them from `crew task next`.
3. Each task ends with a document `docs/research/<id>.md`: facts with sources, assumptions marked as such, and a short **position** (what we propose and why).
4. Disagreements go through PR comments and `crew ask <area>`; questions only the organizers or the client can answer go to the captain with `crew ask <area> --human`. Agreed decisions are written to `docs/decisions.md`.
5. The captain's agent writes `docs/prd.md` from the research and the decisions, as a PR: an agent of another vendor reviews it, and every area checks that its research is reflected.
6. When `crew discover status` says done, `crew kickoff --apply` creates the tasks and switches the phase to `build`.

A big new feature later can get a small discovery of its own: add a block here, `crew discover plan --apply`, the rest of the team keeps building.

## Research questions

Replace the example. Keys: `id` (lowercase, dashes), `question`, `area` (from crew.config.json), `owner` (GitHub login), `budget_hours`, optionally `output` (default `docs/research/<id>.md`).

```crew-research
id: competitors
question: What do similar products do, and where do they fall short for our users?
area: research
owner: <login>
budget_hours: 2
```

## Exit criteria

Check each item (`- [x]`) when it is true. `crew discover status` also checks by itself: all research tasks closed, no question waiting for a human, at least one decision in `docs/decisions.md`, the PRD on main through a reviewed PR.

- [ ] Every open question from `docs/brief-analysis.md` is answered, decided, or explicitly postponed (with a line in decisions.md)
- [ ] The demo scenario is written down
- [ ] The stack is chosen
- [ ] The main risks are listed, each with what we do about it
