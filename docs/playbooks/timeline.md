# Project timeline

Agents write the code. Humans decide, approve, test, and present. Every phase has a **time limit and an action when it runs out** — the pipeline does not stall if someone gets stuck or falls asleep.

In a normal project the limits are guidelines; scale the absolute numbers to the project. In event mode (hackathon) `T` is the delivery deadline from `events/event.json` and the `T−n` phases are enforced by deadlines.

## Phases

| # | Phase | Who | Limit | Done when | Ran out of time → |
|---|---|---|---|---|---|
| 0 | **Brief** | human | 10 min | the brief as is in `docs/brief.md` | — |
| 1 | **Brief analysis** | the analyst agent (`crew-brief-analysis`) | 30 min | `docs/brief-analysis.md`: **demo scenario**, `R*`, stakeholder criteria, assumptions | hand in with assumptions |
| 2 | **Plan** | planner (`crew-kickoff`) | 30 min | `docs/prd.md` + `architecture.md`, `crew task lint` is green | cut the scope to the demo path |
| 3 | **Approval** | captain | 15 min | the captain pressed **Approve the plan** on `crew board` (Discovery) | after 20 min without an answer the planner reminds the captain again; it never approves itself |
| 4 | **Tasks** | planner: `crew kickoff --apply` | 5 min | issues are created | — |
| 5 | **Skeleton + contracts** | 1–2 agents, `risk:high` | 90 min | web → api → DB is deployed, the E2E hello-world is green, `contracts/api.yaml` | a human looks at what blocks (often — access) |
| 6 | **Build** | all workers | until T−6 | tasks are moving, main is green | — |
| 7 | **Freeze** | the product lead announces | T−6 | from here only fixes and polish | — |
| 8 | **Demo** | demo owner + agents | T−3 | the demo-path E2E is green, **a fallback video is recorded** | show the video |
| 9 | **Pitch** | humans | T−2 | slides, answers to "how is it built" (`architecture.md`) | — |
| 10 | **Delivery** | human | T−1 | (event mode) `crew compliance check`, `crew compliance disclosure`, submission | — |

**From the brief to the first task in progress — no more than 75 minutes.** This is the main guide for phases 0–4.

## Merging is continuous
- **Humans have no approve button.** `risk:low` / `risk:med` merge themselves (GitHub auto-merge) when `check` and `crew-guard` are green: the review was done by another agent (`crew pr review`), the rules and other people's acceptance tests are untouched.
- Humans do not approve, they **notice**: they test the running app, write feedback (the "Feedback" issue), and the planner turns it into tasks. Went completely wrong — `crew:pause`.
- `risk:high` (skeleton, auth, data, contracts, demo path) is merged by the integrator manually and **first** — everything else stands on it.
- Tasks with status `waiting` move to `ready` as soon as their dependencies are closed.
- **Main is red** → all workers fix main, no new tasks are taken. Red for more than 30 minutes → an issue `crew:pause`, call the humans.

## Humans: roles and shifts

| Role | Does |
|---|---|
| **Product lead** | approves the plan, holds the scope, triages feedback every hour, announces the freeze |
| **Architect** | looks at the contracts and the skeleton, decides contested technical questions |
| **Fleet operator** | watches the workers (`crew status`, `crew metrics`), unblocks `blocked`, subscription limits, `crew:pause` |
| **Demo owner** | the demo scenario, the demo-path E2E, video, slides, pitch |

All four **test the running app and write feedback** (the "Feedback" template in Issues): what they did, what they expected, what they saw. Every hour the product lead turns feedback into tasks or PRD changes.

**Shifts:** at night at least one person (the fleet operator) is reachable. At night workers take only `risk:low`/`risk:med`; `risk:high` waits until morning if nobody can watch.

## The brief changed along the way
1. A human adds the changes to `docs/brief.md` (the "What was said verbally / in chat" section).
2. The analyst updates `brief-analysis.md`: **do not renumber old `R*`**, new ones get new numbers, dropped ones are marked "dropped".
3. The planner edits the PRD, the product lead approves, new tasks — `crew kickoff --apply` (already created ones are skipped).
4. Tasks that are no longer needed are closed by the product lead by hand as "not planned".

## Scope rule
1–2 scenarios from the demo, taken to the end, beat 10 half-done. Everything that is not in the demo scenario is cut first.
