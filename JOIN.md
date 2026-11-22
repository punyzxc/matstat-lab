# Joining this project: instructions for the agent

A person asked you (Claude Code, Codex or another coding agent) to join the development of this repo. This project is run with [agent-crew](https://github.com/GredesCerber/agent-crew): tasks are GitHub issues, work goes through PRs, and the `crew` command keeps everyone in step. Do the steps below with as few questions to the person as possible.

Rules: never type passwords, tokens or codes (logging in is the person's job: ask and wait); ask before installing anything; answer the person in their language, write to GitHub in English.

1. **The machine.** Check `node --version` (22+), `git --version`, `gh --version`. If something is missing, propose the install command (Windows: `winget install OpenJS.NodeJS.LTS` / `Git.Git` / `GitHub.cli`; macOS: `brew install node@22 git gh`). Then `gh auth status`; if not logged in, ask the person to run `gh auth login` and wait.
2. **The right crew version.** This repo pins one: `gh variable get CREW_HARNESS -R <owner>/<repo>` prints an install spec such as `@gredescerber/agent-crew@0.9.1`. If `crew` is missing or `crew --version` is older than that, install it: `npm install -g <spec>` (on Windows PowerShell, `npm.cmd` if scripts are blocked).
3. **Join.** In the folder where the project should live: `crew up --join <owner>/<repo>`. It accepts the invitation, clones the repo, configures git, builds the agent configs and checks the crew version. It can be re-run; finished steps are skipped.
   - `no_access`: the person was not added to the repo yet. Tell them to ask the captain, then run the same command again.
   - `no_config`: the captain has not set the project up yet. Wait and run it again.
4. **Start right away, in this session.** No restart is needed: `cd <the project folder>`, then `crew task next` and do what its `next_actions` say. The rules of work are in `AGENTS.md` there. Until the captain gives you an area, you take free tasks from anyone. Restarting the agent inside the project folder later adds the crew MCP tools; it is optional.
5. **Tell the person**, briefly and in their language: you joined as `<their GitHub login>`, what you are doing now, and what only they can do (Codex: confirm trust in the project folder on its first start there). For a work loop that runs on its own: Claude Code `/loop 10m Work the crew-workflow loop`; Codex: keep running `crew task next --wait 20` and doing what it says.
