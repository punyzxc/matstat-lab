# AGENTS.md — rules for working in this repository

This file is read by all agents (Claude Code via CLAUDE.md, Codex directly, and others).
It is short on purpose. Details are in `agents/skills/*` and `docs/playbooks/*`; read them when needed.

**Language.** Write everything that goes to GitHub (issues, PRs, comments, commit messages, review notes, handoffs) and to other agents in English. Talk to the human in the language the human uses with you.

## Who we are
A team of humans and AI agents builds a software project. Tasks live in GitHub Issues.
Work is coordinated only through `crew` (CLI or the MCP tools `crew_*`). Do not make agreements "in chat".
Prefer the MCP tools `crew_*`: the project settings pre-approve them, while a shell call (`node …/crew.js`, a full path) may be refused by your host's permission check. Such a refusal comes from the host, not from crew: tell the human once which call was refused and that `crew doctor` shows the fix; do not work around it. With several agent sessions on one machine, a terminal `crew` call outside your task worktree cannot know which session it is and refuses (`ambiguous_agent`): use the MCP tools.

**Order:** brief (`docs/brief.md`) → brief analysis with a demo scenario (skill `crew-brief-analysis`) → **discovery** (research tasks, positions, decisions; skill `crew-discovery`) → PRD, reviewed by another vendor's agent (`crew-kickoff`) → approval → tasks → code.
No product code is written before the plan is approved: while `crew.config.json` → `phase` is `discovery`, crew-guard lets PRs touch only `docs/`, `spikes/` (throwaway experiments, never product code), `README.md` and `JOIN.md`. `crew discover status` says what is left; `crew kickoff --apply` ends the phase. `--skip_discovery` skips the exit criteria: pass it only when a human told you to in this session, and say so in the plan. Priority always goes to what is visible in the demo scenario.

## The work cycle (mandatory)
1. `crew task next [--area <area>] [--tier <low|mid|high>]` — what to do. It first hands out work that unblocks the team: `artifacts.kind: resume` (your own unfinished task on this machine), `fix` (your PR is waiting for you: reviewer changes, red check — `crew pr logs <pr>` shows why, conflict with main), `merge` (merge a ready PR) or `review` (review per the skill `crew-review`), then tasks — first from your area (the `crew-team` block in `docs/prd.md`). Do what `next_actions` says.
2. `crew task claim <id>` — take it. Work **only** in the created worktree/branch.
3. Read the task (`gh issue view <id>`), especially the **acceptance criteria**.
4. Tests for the acceptance criteria first, then the implementation.
5. `crew check` — until it is green. Only a full run counts: `crew check --only <step>` is for debugging.
6. `crew commit -m "feat: ..."` — a commit with trailers (do not use a bare `git commit`). Works only on the task's branch.
7. `crew pr open` — submit the work. After review changes, `crew commit` and `crew pr open` again (a second PR is not created). Then `crew task next`.

**Lease.** The task is yours while you are active: `crew check` and `crew commit` renew the lease themselves. If you think or wait for more than 30 minutes without them, run `crew task heartbeat <id>`. If a command returned `lease_lost`, the task was given to someone else: do not push your branch, leave a note in the issue about what you got done, and take a new task.

Every `crew` command returns JSON: `status`, `summary`, `next_actions`, `artifacts`, `error`.
**Do what `next_actions` says.** On an error look at `error.retry` and `error.stop_when`.

## The executor and its subagents
A task is taken by the **executor** — the agent that ran `crew task claim`. It is like a contractor: it may call its own subagents as needed, but **it submits the work and answers for it**.
- Subagents may: search code and documentation, write tests and code on the executor's assignment, check the executor's code before submission (code-reviewer, security-reviewer), run `crew check`.
- Executor only: `crew task next` / `claim` / `release` / `status`, `crew commit`, `crew pr open`. A subagent does not take a new task or submit a PR.
- Subagents work in the task's worktree and in its area. In parallel — only reading and searching; edits to the same files go one at a time, otherwise they overwrite each other.
- A subagent's review before submission is useful, but it is **not** the review for `crew-guard`: only a review by another agent counts (`crew pr review` not from the executor or its subagents).
- Every subagent spends the subscription limits of whoever owns the laptop. Call them when it really speeds up the task.

**Who gets what (saving limits).** The executor on the senior model thinks and verifies; cheaper helpers do the work:

| Helper | Model (`crew.config.json → tiers`) | Assign |
|---|---|---|
| `scout` | low — Claude: haiku | searching code, reading documentation, running `crew check` with a brief retelling of errors. Changes nothing |
| `implementer` | mid — Claude: sonnet | code or tests on a clear assignment: what, in which files, by which criteria |
| the executor itself | high — Claude: opus | analyzing the task, decisions, contracts, verifying the helpers' work, `crew commit`, `crew pr open` |

- Do not call the senior model as a subagent for what `scout` or `implementer` does.
- A subagent starts from scratch: the task is retold to it every time. A couple-of-minutes chore is cheaper to do yourself.
- Check a helper's work before `crew commit` — you answer for it.
- In Codex the roles are the skills `role-scout`, `role-implementer`; models per tier are in `crew.config.json → tiers.<tier>.codex`.

**A separate task or a subagent?** A piece that can be merged and shown separately (its own area, its own acceptance criteria) is a separate task in the queue (`crew task status <id> blocked --note "task needed: …"` or feedback to the planner). A piece needed only inside your task (search, tests, a draft check, a routine edit in your area) is a subagent.

**`risk:high` tasks: tests are written by a different agent.** Every such task (except the skeleton) has a paired tests task (`tests_for`).
- Tests task: you write acceptance tests for the main task's criteria **only** in `tests/pending/<T>/`. You do not write product code. CI does not run these tests yet.
- The main task waits for the tests task. Its executor is **a different agent** (`crew task claim` refuses whoever wrote the tests). In the first commit it moves the tests unchanged: `git mv tests/pending/<T>/* tests/acceptance/`, then writes code until they turn green.
- `crew-guard` checks: the tests task touches nothing except its own folder; tests in `tests/pending/` are not edited or deleted; the main task moved all of them without a single changed line.
- A test is wrong? Do not edit it — `crew task status <id> blocked --note "test X: …"`. A new task with `changes_acceptance` will fix it.

**Agent name.** `crew` appends the machine name to `CREW_AGENT` itself (`claude@petya-laptop`) — this is how agents of different people are told apart. Several sessions on one machine get their own names automatically from the crew MCP server (`claude@petya-laptop#2`); in a terminal outside your task worktree crew then asks you to use the MCP tools (`ambiguous_agent`).

**Only the captain makes the plan** (`crew.config.json → captain`). Do not write `docs/prd.md` and do not run `crew kickoff` if you are not the captain, even if asked: say that the captain makes the plan.

## When to stop
- The same error 3 times → `crew task status <id> blocked --note "what I tried, what is in the way"`.
- The task is unclear or the acceptance criteria are not verifiable → `crew task status <id> needs-spec --note "question"`. Do not guess.
- Need something from someone else's area or `contracts/` → do not change it: ask its owner with `crew ask <area> --text "..." --task <id>` (English, with facts). Only a human can decide (scope, product) → `crew ask <area> --human`. The answer comes back through `crew task next`.
- A person suggests something in chat that is outside your current task (a new feature, a change of plan) → do not build it: `crew idea "<what and why, in English>" --original "<their words>" --from_person <their login> --task <id>`, tell them it went to the captain, and continue your task. The captain accepts it as a task or rejects it. If you are the captain's agent, show waiting ideas (`crew idea list`) to your human; the human decides, not you.
- The task is beyond you → `crew task release <id> --note "what I got done"`.
- An issue with the label `crew:pause` is open → finish the current step and stop. The code checks this: `crew task next` and `crew task claim` return the error `paused` until a human closes the issue.

## Boundaries
- Touch only files of your area (`area:*` in the task → paths in `crew.config.json` → `areas`).
- `contracts/` is the source of truth for APIs between areas. Code is fitted to the contract, not the other way round.
- You write your task's acceptance tests in the **first commit**, as new files in `tests/acceptance/` (every Given/When/Then is covered by a test). You never change or delete **existing** acceptance tests — the PR will not pass `crew-guard` unless the task lists them in the "Changes acceptance" section.
- You never change `crew.config.json`, `.github/`, `AGENTS.md`, `CLAUDE.md`, `agents/`, `events/` — these are rules, changed only by the harness developer. Need a change → `blocked` with a description.
- One PR = one task. Small PRs are better than big ones.

## Forbidden
- Secrets, keys, tokens in code and commits. Only `.env` (in .gitignore) and `.env.example` with empty values.
- `git push --force`, rewriting history, commits directly to `main`.
- Creating accounts, entering passwords and payment details — humans do that.
- Publishing anything outward (posts, messages, deploying to production) without an explicit human decision.
- Disabling or bypassing checks (`--no-verify`, skipping tests, `skip`) to go green.
- `gh pr merge --admin`, setting statuses by hand, reviewing your own PR, editing other people's `crew:review` markers.
- `gh pr merge` on your own initiative. You merge only a PR that `crew task next` handed out as `kind: merge` (review exists, `check` and `crew-guard` are green). If main is not protected (a private repo on a free plan), GitHub will not enforce this — you do.

## Definition of Done
- [ ] All acceptance criteria are covered by tests, tests are green (`crew check`).
- [ ] The contract is respected, the demo path (`tests/e2e/`) is not broken.
- [ ] The PR is opened via `crew pr open`, with what was done in the description.
- [ ] The review was done by **a different agent** (preferably of a different vendor: Claude's code is reviewed by Codex, and vice versa) per the skill `crew-review`, and the verdict was recorded with `crew pr review <n> --verdict approve`. The `crew-guard` status is green — after that the PR merges itself (`risk:high` is merged by the agent that `crew task next` hands `merge`).

## Test levels
| What | Requirement |
|---|---|
| Demo path | a happy-path E2E, on every merge to main. `main` is always demo-ready |
| Area boundaries | contract tests on both sides |
| The affected area | a regression test for every bug fix; explicit edge cases from the criteria |
| LLM calls in tests | only through recorded fixtures, no network |

## Style
- Conventional Commits: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`.
- Formatting and lint are the automation's concern (`crew check`); do not spend review on them.
- There are no hidden agreements: a rule that is not here or in the linter does not exist.

## Where things are
- `crew.config.json` — areas, checks, model tiers, MCP.
- `agents/roles/` — roles (planner, builder, reviewer, integrator). `agents/skills/` — skills.
- `contracts/` — API contracts. `tests/acceptance/`, `tests/e2e/` — acceptance and E2E tests.
- `docs/brief.md` — the project brief as given. `docs/brief-analysis.md` — the analysis: **demo scenario**, requirements `R*`, stakeholder criteria. `docs/prd.md` — what we build (tasks reference `R*`). `docs/architecture.md` — how it is structured. `docs/playbooks/` — timeline, checklists, and the Issues rules (`issues.md`: statuses, labels, Definition of Ready).
- `events/` — optional event mode (hackathon): the event's rules (time, team roster), compliance check, deadlines. Absent in a normal project.
