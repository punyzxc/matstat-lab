---
name: crew-kickoff
description: Project start - from docs/brief.md and docs/brief-analysis.md produce docs/prd.md with task blocks, pass crew task lint, get approval, and create epics and tasks with crew kickoff --apply. Use once at the start and when re-slicing the scope.
---
# Kickoff

Input: `docs/brief.md` (the project brief, stakeholder criteria) and `docs/brief-analysis.md` (analysis: requirements `R1...Rn`, demo scenario).
Output: `docs/prd.md` with `crew-team` / `crew-task` / `crew-epic` blocks; issues are created **only** by `crew kickoff --apply`.
**Captain only** (`crew.config.json → captain`): for everyone else `--apply` answers `not_captain` — a member does not plan, a member works by crew-workflow.

**Never call `gh issue create` yourself.** You write the PRD; the code does the rest (deterministically and idempotently).
Block format: `agents/skills/crew-kickoff/task-format.md` (it has a full example).

## 1. Priorities from the demo scenario
- The demo scenario from `docs/brief-analysis.md` sets priorities: requirements on the demo path are **must**, `risk: high`, and go first.
- Everything else is secondary; extras go to "NOT doing".
- Every task has `req: [R…]` — the brief requirements it covers.

## 2. PRD (`docs/prd.md`), at most one page of text + blocks
The template is already in `docs/prd.md`. The first line is the header `<!-- crew:prd status: draft by: - at: - -->`: a note for readers, it does not approve anything.
- Problem and who it is for (1–2 sentences).
- **Demo path**: 3–7 steps that stakeholders will see in the demo (judges in event mode), referencing `R…`.
- 1–2 main scenarios. A "NOT doing" list.
- How we satisfy each stakeholder criterion from `docs/brief.md` (judging criteria in event mode).
- Stack: from `crew.config.json → stack`, taking into account the "Stack" section of `docs/brief-analysis.md` (additions are libraries inside the preset). Skeleton generators: `crew.config.json → scaffold`.

If ECC has `plan-prd`, `product-lens`, `council`, use them for the draft and to sanity-check the idea.

## 2a. Team: roles and areas (`crew-team` block)
Assign people **by the repo's actual membership**, not by a template:
1. Who is on the team: `gh api repos/{owner}/{repo}/collaborators --jq '.[].login'` (no bots).
2. Which areas the tasks need (`web`, `api`, `contracts`, `design`, `research`, `e2e`, `infra`).
3. Ask the captain who can do what (frontend, backend, design, research) if it has not been said.
4. Assign: every area that has tasks has **exactly one owner**; the load is roughly even. Fewer people than areas — merge areas (`web, design`); more people — give the extras `e2e`, `research`, a second screen.
5. The captain gets the `review` area: reviews and merges go to them first.
```crew-team
captain-login: api, contracts, review   # captain: backend and review
front-login: web                        # frontend
design-login: design                    # design: mockups, styles in web/src/styles
research-login: research, e2e           # research and demo verification
```
The designer and the researcher need their own tasks (screen mockups and styles; analogues, checking the demo scenario) — `crew task lint` warns if a person has no tasks.
`--apply` assigns each task to its area owner and refuses if the block names someone who is not a repo member.

## 3. Task blocks
- **The first block is the end-to-end skeleton**: `skeleton: true`, `tier: high`, `risk: high`, no `after`; generators from `scaffold`, web → api, deploy, E2E hello-world. Only the skeleton may have `paths` outside its own area.
- Next — the contract `contracts/api.yaml` for the demo path (`area: contracts`, `risk` at least `med`).
- The rest — vertical slices of 1–3 hours, **one area per task** (`paths` only inside it).
- All tasks implicitly wait for the skeleton — do not write `after: [T1]`; use `after` only for other dependencies.
- Acceptance criteria — `Given … When … Then …` or `Дано … Когда … Тогда …`, verifiable by a test.
  If you cannot formulate them — `ready: false` (becomes `status:needs-spec`).
- `risk`: `low` — minor (not for `contracts`/`infra`), `med` — default, `high` — demo path, auth, data, payments (+ `e2e` in `tests`).
- Epics are `crew-epic` blocks; tasks join them via the `epic` field.
- **Every `risk: high` task (except the skeleton) gets a tests task**: a `crew-task` block with `tests_for: <T>`, `area: e2e`, `tier`; `goal` and `acceptance` are not needed (taken from the main task). The main task will wait for it automatically. A different agent writes the tests in `tests/pending/<T>/`, and the main task's executor moves them to `tests/acceptance/` unchanged.
- Do not split finer than "can be merged and shown separately": small things inside a task are done by the executor or their own subagents.

## 4. Check loop
```
crew task lint
```
Error → fix `docs/prd.md` using `artifacts.errors` (it has the line, id, rule) → run `crew task lint` again.
**Two identical failures in a row — stop**: show the errors to the human, do not keep looping.

## 5. Approval
1. `crew kickoff` (dry-run) — the plan: what will be created, statuses, order.
2. Show the PRD and the plan to the captain and ask them to approve it: on `crew board` → Discovery → The plan → **Approve the plan** (it shows the revision `crew kickoff` printed).
3. Wait for the approval. **You never approve the plan yourself**: do not edit the header to `approved`, do not write the `crew:prd-approved` comment, not even after a long silence. If nobody answers, remind the captain and work on nothing else from this plan.
   Any edit to `docs/prd.md` after the approval changes its revision and needs a new approval: show the captain what changed.
4. `crew kickoff --apply` (on branch `main`). Without an approval of exactly this revision it answers `plan_not_approved` — do not work around it.
   It also commits `docs/brief.md`, `docs/brief-analysis.md`, `docs/prd.md` and pushes to main so the team sees the plan. If that fails, `warnings` say what to do.

`--apply` answers: `labels_missing` → ask the human to run `crew labels sync`; `kickoff_partial` → just repeat `crew kickoff --apply` (already-created items are skipped by their markers).

## 6. Summary
`crew status` and a short message to the people: how many tasks, **who owns which area**, what is on the demo path, what was cut, and what each person should run locally: `/loop 10m Work through the crew-workflow cycle`.

Re-slicing the scope: edit `docs/prd.md` and run `crew kickoff --apply` again — only new blocks are created; changed and removed ones (`changed`/`orphan`) are only reported by the command, and a human edits their issues.
