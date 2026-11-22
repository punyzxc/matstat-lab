# Task format in `docs/prd.md`

`crew task lint` validates it, `crew kickoff` turns it into GitHub Issues. The code reads **only** the fenced blocks
`crew-task` and `crew-epic`; the rest of the PRD markdown is for humans and is ignored.
This file is both the specification and a test fixture: the example below must pass `crew task lint` without errors.

## Approval header

The first line of the PRD is a machine-readable header (not visible in rendered markdown):

```
<!-- crew:prd status: draft by: - at: - -->
```

The header is a note for readers. `crew kickoff --apply` creates issues **only** when the captain approved this exact revision of the PRD
(a hash of its text, shown by `crew kickoff`): on `crew board` → Discovery → **Approve the plan**, which comments
`<!-- crew:prd-approved rev=<revision> -->` on the `crew:prd-approval` issue. Otherwise it fails with `plan_not_approved`.
An edit after the approval needs a new one; there is no approval by timeout, and an agent never approves. Dry-run (`crew kickoff`) works without approval.

## Block syntax

A strict subset of YAML, one key per line:

- `key: value` — a string (quotes `"…"` / `'…'` are optional);
- `key: [a, b]` — a short list (items without commas inside);
- `key:` followed by `  - item` lines — a long list (this is how acceptance criteria are written);
- `skeleton: true`, `ready: false` — flags, only `true` / `false`;
- blank lines and lines starting with `#` are skipped; CRLF is allowed.

An unknown key, a repeated key, or an unrecognized line is an error with the line number.

## Task fields (`crew-task`)

| Field | Required | What it is |
|---|---|---|
| `id` | yes | `T<number>`, unique |
| `title` | yes | issue title |
| `area` | yes | **one** area from `crew.config.json → areas` (one task — one area) |
| `tier` | yes | `low` / `mid` / `high` — which model can handle it |
| `goal` | yes | one sentence: why the task exists |
| `acceptance` | yes | list of criteria `Given … When … Then …` or `Дано … Когда … Тогда …` (case does not matter, word order does) |
| `epic` | no | `E<number>` from a `crew-epic` block |
| `risk` | no | `low` / `med` / `high`, default `med` |
| `after` | no | list of `T<number>` the task depends on |
| `paths` | no | allowed paths (glob), only inside its own area |
| `contract` | no | reference to a part of the contract, e.g. `contracts/api.yaml#/paths/~1auth` |
| `out_of_scope` | no | what we do NOT do in this task |
| `tests` | no | a list of `unit`, `contract`, `e2e` |
| `req` | no | requirement IDs from `docs/brief-analysis.md`: `[R1, R3]` → the "Brief requirements" section in the issue |
| `tests_for` | no | `T<number>` — this is a task for acceptance tests for the given task: the tests are written in `tests/pending/<T>/`, the main task waits for it; `goal` and `acceptance` may be omitted (taken from the main task); the area is one with `tests/pending/**` (usually `e2e`) |
| `changes_acceptance` | no | existing acceptance tests that the task **rewrites** (usually from feedback): `[tests/acceptance/test_3_login.py]` → the "Changes acceptance" section; only these may be changed by the task's PR (`crew-guard`) |
| `skeleton` | no | `true` — the end-to-end skeleton (exactly one, the first block) |
| `ready` | no | `false` — the specification is not ready → `status:needs-spec` |

## Epic fields (`crew-epic`)

`id` (`E<number>`), `title`, `scenario` are required; `demo` — how to show it in the demo.
Tasks join an epic via the `epic` field. Epics are created after tasks, with a `- [ ] #N` list in the body.

## Team (`crew-team`)

One block per PRD: who owns which areas. A line is `github-login: area1, area2  # role`.
The special area `review` is the team's reviewer (usually the captain): `crew task next` hands them PRs to review before tasks.

- `crew kickoff --apply` assigns every task (assignee) to the owner of its area; `crew task next` gives an agent first the tasks assigned to their human, then unassigned ones, then others' (marked with whose area it is).
- Errors: an area with tasks has no owner; an area has two owners; a person is listed twice; an unknown area; not a login.
- Warnings: no block; no reviewer; a person has no tasks; uneven load (one person has more than double).
- Logins are repo members (`gh api repos/{owner}/{repo}/collaborators --jq '.[].login'`); a non-member makes `--apply` refuse.

## Rules (an error — `crew task lint` will not pass it)

- The first `crew-task` block is the skeleton: `skeleton: true`, `tier: high`, `risk: high`, no `after`. There is exactly one skeleton.
- Every `risk: high` task except the skeleton has exactly one `tests_for` task pointing at it. `tests_for` must not target the skeleton, itself, or another tests task; a tests task's `after` must not include its target.
- `area` is a single string and exists in `crew.config.json → areas`. `paths` outside the area are allowed **only for the skeleton**.
- `risk: low` is forbidden for the `contracts` and `infra` areas.
- Acceptance criteria — only in Given/When/Then form (or Дано/Когда/Тогда).
- `after` and `epic` refer to existing ids, not to themselves; no cycles (`T2 → T4 → T2` is an error).
- `req` — only `R<number>`.

Warnings: `risk: high` without `e2e` in `tests`; more than 25 tasks; identical `title`s; an empty epic.

## Dependencies and statuses

- Every task except the skeleton **implicitly depends on the skeleton** — there is no need to write `after: [T1]`; an explicit `after` is added to it.
- Skeleton → `status:ready`. With dependencies → `status:waiting`, with "After #N, #M" in the body and the marker `<!-- crew:after issues=N,M -->`.
- When all dependencies are closed, `crew task promote` (the `promote` job in `crew.yml` on issue close, and `crew task sweep`) moves the task to `ready`.
- `ready: false` → `status:needs-spec`: agents do not take it, the product lead finishes the specification.

## Risk levels

| risk | What it means |
|---|---|
| `low` | one cross-vendor review, auto-merge |
| `med` (default) | review + tests for the criteria, auto-merge |
| `high` | review + security review, merged first and manually, E2E required |

Requirements on the demo path (from `docs/brief-analysis.md`) are `risk: high` and go first.

## Re-running

Every issue body has a marker `<!-- crew:task id=T2 hash=… prd=docs/prd.md -->`. A repeated `crew kickoff --apply`
skips tasks that have a marker (idempotent) and creates only new ones. A changed block (`changed`) and a task
that is no longer in the PRD (`orphan`) only produce warnings: issues are not changed, a human edits them.

## Full example

```crew-team
anna-dev: api, contracts, review   # captain: backend and review
boris: web                         # frontend
vera-qa: e2e, infra                # tests and deploy
```

```crew-epic
id: E1
title: Sign-up and login
scenario: A new user signs up by email and lands on the dashboard
demo: In the demo we register a new user and immediately see their dashboard
```

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

```crew-task
id: T2
title: Sign-up contract in contracts/api.yaml
epic: E1
area: contracts
tier: mid
risk: med
paths: [contracts/**]
goal: Frontend and backend agree on POST /auth/register before implementation
acceptance:
  - Дано пустой contracts/api.yaml Когда описываю POST /auth/register Тогда контракт проходит валидацию OpenAPI
  - Given the contract When I generate a client Then the client has a register(email, password) method
tests: [contract, e2e]
req: [R2]
```

```crew-task
id: T3
title: Email sign-up API
epic: E1
area: api
tier: mid
after: [T2]
contract: contracts/api.yaml#/paths/~1auth~1register
paths: [api/src/auth/**]
goal: The backend registers a user per the contract
acceptance:
  - Given a valid email and password When POST /auth/register Then 201 and the user is in the DB
  - Given an email already taken When POST /auth/register Then 409 with code email_taken
out_of_scope: [password recovery, OAuth]
tests: [unit, contract]
req: [R2]
```

```crew-task
id: T4
title: Email sign-up form
epic: E1
area: web
tier: mid
risk: high
after: [T2, T3]
contract: contracts/api.yaml#/paths/~1auth~1register
paths: [web/src/features/auth/**]
goal: A user signs up from the form and lands on the dashboard
acceptance:
  - Given /register is open When I enter a valid email and password Then I see /dashboard
  - Given the email is taken When I submit the form Then I see "email taken" and stay on the form
out_of_scope: [password recovery, OAuth]
tests: [unit, e2e]
req: [R2, R3]
```

```crew-task
id: T6
title: Acceptance tests for the sign-up form
area: e2e
tier: mid
tests_for: T4
tests: [e2e]
```

```crew-task
id: T5
title: Dark theme
area: web
tier: low
risk: low
ready: false
goal: The interface switches to a dark theme
acceptance:
  - Given any page is open When I click the theme switch Then the background and text change to a dark palette
tests: [unit]
```

What you get (`crew kickoff`, dry-run): T1 → `status:ready`; T2, T3, T6, T4 → `status:waiting` (T2 — after T1,
T3 — after T1 and T2, T6 — after T1, T4 — after T1, T2, T3 and its own tests T6); T5 → `status:needs-spec`;
epic E1 comes last, linking T2–T4.

T6 is the tests task for the `risk: high` task T4: a different agent writes tests for T4's criteria in `tests/pending/T4/`,
and T4's executor moves them to `tests/acceptance/` unchanged in the first commit.
