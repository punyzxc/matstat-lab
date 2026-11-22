<!-- crew:prd status: draft by: - at: - -->
# PRD: <product name>

> Written by the planner from `docs/brief.md` and `docs/brief-analysis.md` (skill `crew-kickoff`), at most one page of text + task blocks.
> Block format — `agents/skills/crew-kickoff/task-format.md`. Check: `crew task lint`. Plan: `crew kickoff`.
> The header on the first line is a note. `crew kickoff --apply` creates issues only when the captain approved this exact
> text on `crew board` → Discovery → **Approve the plan** (any later edit needs a new approval; agents never approve).

## Problem and who it is for

<1–2 sentences>

## Demo path

The steps stakeholders will see in the demo (judges in event mode). Requirements on this path are must, `risk: high`, done first.

1. <step> — R1
2. <step> — R2
3. <step> — R3

## Scenarios

- <main scenario 1>

## NOT doing

- <what was deliberately cut>

## Stakeholder criteria (judging criteria in event mode) → how we satisfy them

| Criterion | How we satisfy it |
|---|---|
| <from docs/brief.md> | <task / epic> |

## Stack

From `crew.config.json → stack`; skeleton generators — `crew.config.json → scaffold`.

## Epics and tasks

The first `crew-task` block is always the end-to-end skeleton. The other tasks implicitly wait for it (no need to write `after`).

```crew-task
id: T1
title: End-to-end skeleton web → api → deploy
area: infra
tier: high
risk: high
skeleton: true
paths: [web/**, api/**, infra/**, .github/**]
goal: An empty app builds, deploys, and answers an E2E hello-world
acceptance:
  - Given a clean repository When I run the generators from crew.config.json → scaffold Then crew check is green
  - Given a deployed environment When I open the home page Then I see the api /health response
tests: [e2e]
req: [R1]
```
