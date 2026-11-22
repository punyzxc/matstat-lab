# GitHub Issues rules

Issues are the team's only task queue. Everything humans and agents need to know is here.

## 1. Task lifecycle

```
needs-spec ──► ready ──► claimed ──► review ──► done
    ▲            ▲          │  │
    │            └──────────┘  └──► blocked ──► (a human sorted it out) ──► ready
    └── agent: "criteria are not verifiable"
```

| Status | What it means | Who sets it |
|---|---|---|
| `status:needs-spec` | the task exists but cannot be taken: no verifiable criteria, or it waits for another task | the default template; the planner; an agent via `crew task status <id> needs-spec` |
| `status:ready` | can be taken | **anyone, agents included, through `crew task status <n> ready`**: crew checks the DoR (an `area:*` label and Given/When/Then criteria) and refuses otherwise. The product lead can still change it |
| `status:claimed` | an agent is working, the lease is running | only `crew task claim` |
| `status:review` | a PR is open | only `crew pr open` |
| `status:blocked` | a human is needed | an agent via `crew task status <id> blocked --note` |
| `status:done` / closed | the PR is merged | GitHub closes the issue itself via `Closes #N` |

The `claimed` and `review` statuses are never set by hand — only through `crew`. If something broke — `crew task release <id>`.

## 2. How to write a task

**Title** — a verb + a result visible to a user or the system:
- ✅ "Login form: email + password, error on a wrong password"
- ✅ "API: POST /auth/login per the contract"
- ❌ "Authorization", "Do the backend", "Fix"

**Body** — per the "Task" template (`.github/ISSUE_TEMPLATE/task.yml`):
- **Goal** — one sentence, why.
- **Acceptance criteria** — Given / When / Then, each verified by a test:
  ```
  - [ ] Given a user on /login, When they enter valid data and click "Sign in", Then they land on /dashboard
  - [ ] Given a wrong password, When they click "Sign in", Then they see "Wrong email or password" and stay on /login
  ```
- **Contract** — a link to a part of `contracts/api.yaml`, if the task touches the API.
- **Allowed paths** — which files may be touched.
- **Out of scope** — what we definitely do not do (agents like doing extra).

**Labels** (all three kinds are mandatory):
- `area:<area>` — exactly one. A task for two areas → split into two.
- `tier:low|mid|high` — how strong a model is needed (low: texts, small edits, tests; mid: a regular feature; high: architecture, the end-to-end skeleton, hard bugs).
- `risk:high` — only if a mistake is expensive (auth, data, payments, the demo path). A human must look at such PRs.

## 3. Definition of Ready — before setting `ready`

`crew task status <n> ready` checks the area label and the Given/When/Then criteria itself; the rest of this list is on whoever sets `ready`.

- [ ] The title follows the rules of section 2
- [ ] The acceptance criteria are verifiable by a test, with no "pretty", "convenient", "fast"
- [ ] One area (`area:*`), `tier:*` is set
- [ ] The task is 1–3 hours of agent work; bigger — split it
- [ ] Dependencies are already `done` (or it is explicitly written which mocks we work against)
- [ ] It is a **vertical slice**: the result can be shown or verified, not "a layer for the sake of a layer"

## 4. Dependencies and epics

- A task waits for another → `status:waiting` (or `status:needs-spec`) and a line in the body: `After #12`. When #12 is closed, the task becomes `ready` (`crew task promote`, or the product lead by hand).
- An epic (the "Epic" template, label `epic`) is a user scenario with a task list `- [ ] #N`. Agents do not take epics.
- Task #1 in any project is the **end-to-end skeleton** (web → api → DB, deploy, E2E hello-world). Until it is `done`, there are no parallel tasks in `ready`.

## 5. Comments

- Comments like `<!-- crew:claim ... -->`, `<!-- crew:heartbeat ... -->` are service comments: the lease is computed from them. **Do not edit or delete.**
- On `blocked` / `needs-spec` / `release` an agent must leave a handoff: what is done, what is in the way, where the artifacts are. A human answers in the same issue.
- Discussion of a task goes in its issue, not in chat: the next agent can restore the context only from here.

## 6. Service issues

| Issue | Purpose |
|---|---|
| `#ops-log` (pinned) | the integrator's reports, queue summaries |
| an issue with the label `crew:pause` | **emergency stop**: while it is open, agents do not take tasks. Close it — work continues |

## 7. Who is responsible for what

| Role | Does |
|---|---|
| Product lead | owns the DoR and the scope (reviews what others moved to `ready`), cuts the extras, handles `needs-spec` |
| Fleet operator | every 30–60 min looks at `crew status`, handles `blocked`, sets/clears `crew:pause` |
| Planner (agent) | creates tasks and epics at kickoff and on re-slicing |
| Builder (agent) | takes `ready`, submits a PR, honestly sets `blocked`/`needs-spec` |
| Integrator (agent/human) | merges, writes to `#ops-log` |

## 8. What not to do

- Do not assign tasks to agents by hand (the assignee is set by `crew task claim`; the planner's `crew-team` assignment by area is the only exception).
- Do not keep tasks without criteria in `ready` "so there is something to take" — an agent will do the wrong thing.
- Do not create tasks like "fix everything" and "finish the frontend" — slice them.
- Do not reopen a closed task for a new meaning — create a new one with a link.
