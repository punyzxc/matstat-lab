# Preflight — before the project starts

Items marked (event mode) apply only when the project is run as an event such as a hackathon.

## Rules
- [ ] (event mode) The event's rules are read: is AI allowed? is disclosure required? is prebuilt code allowed in advance?
- [ ] (event mode) `events/event.json` is filled in: start/end time, `team_members` (GitHub logins of team members only)

## Accounts and access (done by humans, not agents)
- [ ] Frontend and backend hosting, DB, auth service — accounts are created, someone on the team has access
- [ ] API keys (LLM, partners/sponsors) — in a shared password manager, **not in the repo**
- [ ] The GitHub organization, everyone on the team has permissions, Actions are enabled
- [ ] The repo is set up: `crew github setup` (see the plan) → `crew github setup --apply` — protection of `main`, the variable `CREW_HARNESS`, labels
- [ ] On a test PR the `crew-guard` status appears: `pending` without a review, `success` after `crew pr review <n> --verdict approve` from another agent

## Machines
- [ ] Everyone: `crew doctor` is green (node, git, gh authorized, claude/codex installed)
- [ ] Windows: `git config --global core.longpaths true` (otherwise git fails on long worktree and `node_modules` paths)
- [ ] Codex: the project is marked as trusted (otherwise it will not read `.codex/config.toml`)
- [ ] Claude Code: the ECC plugin is installed
- [ ] Subscription limits are checked and there are spare API keys

## Network and fallbacks
- [ ] 2+ people have mobile internet to share
- [ ] A plan for "what we show if everything is down": a recorded demo video

## Human roles
- [ ] Product lead (acceptance criteria, scope), Architect (contracts), Fleet operator (workers, unblocking, `crew:pause`), Demo owner (demo, E2E, pitch)
