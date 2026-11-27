# STATUM LAB

STATUM LAB is an interactive Monte Carlo laboratory for students and instructors of probability and mathematical statistics. Its central question: how do sample size and the shape of a distribution affect estimator accuracy and the reliability of statistical conclusions? Students pick a distribution, predict, run a seeded experiment, and compare theory with the simulated result; instructors use the same experiments on a projector.

**Status:** the project is in the `discovery` phase. The plan ([PRD](docs/prd.md)) is a draft awaiting the captain's approval, and the working prototype lives in [`spikes/visual-foundation/`](spikes/visual-foundation/). No production code exists yet.

> **New on the team?** Ask the captain to add you to this repo, then tell your coding agent (Claude Code or Codex), in any language: **"Join the development of punyzxc/matstat-lab"**. The agent reads [JOIN.md](JOIN.md) and does the rest; you only log in to GitHub when it asks.

## Run the prototype

You need Node.js 22.18+ and, for the browser tests, an installed Chrome.

```sh
cd spikes/visual-foundation
npm ci
npm run dev -- --host 127.0.0.1 --port 4175
```

Open http://127.0.0.1:4175/. The orbital scene opens the experiment stations; the **Lectures** drawer plays the twelve course lectures step by step.

| Command (in `spikes/visual-foundation/`) | What it does |
| --- | --- |
| `npm test` | unit tests: statistics, kernels, lectures, translations |
| `npm run build` | type check and production build |
| `npm run e2e` | Playwright browser tests |

How to use the lab (controls, autoplay, saved results) is in the [prototype README](spikes/visual-foundation/README.md).

## Where things are

| Path | What |
| --- | --- |
| [docs/brief.md](docs/brief.md) | the project brief as given |
| [docs/brief-analysis.md](docs/brief-analysis.md) | demo scenario and requirements `R*` |
| [docs/prd.md](docs/prd.md) | what we build (draft) |
| [docs/decisions.md](docs/decisions.md) | decisions taken during discovery |
| [docs/architecture.md](docs/architecture.md) | how it is structured |
| [docs/research/](docs/research/) | research notes, one per discovery task |
| [docs/playbooks/](docs/playbooks/) | timeline, checklists, issue rules |
| [spikes/](spikes/) | discovery experiments; [visual-foundation](spikes/visual-foundation/) is the running prototype |
| [spikes/visual-foundation/lectures/](spikes/visual-foundation/lectures/) | lecture scripts `L01`–`L12` |
| [contracts/](contracts/) | API contracts between areas |
| [tests/](tests/) | acceptance tests |

## How we work

This project is built by people and AI agents together with [agent-crew](https://github.com/GredesCerber/agent-crew).

- Tasks are GitHub issues; every change goes through a crew task and a reviewed PR.
- Rules for agents and humans: [AGENTS.md](AGENTS.md).
- Team status: the pinned "crew digest" issue.
