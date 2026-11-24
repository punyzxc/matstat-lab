# Decision log

| Status | Decision | Rationale and owner |
| --- | --- | --- |
| Supplied requirement | Use the existing public repository, web-node, Claude Code and Codex, team Discovery, and protected PR review. | Owner's bootstrap brief. |
| Confirmed by owner | Use GredesCerber as the sole deputy. The captain initiates and ends time-limited handoffs. | Configure `--handover deputies --deputies GredesCerber`. Leave automatic fallback disabled. |
| Proposal | Serve a static React/Vite application and run simulations in browser workers. Use IndexedDB and a versioned export. | Validate performance and replay requirements during Discovery. Platform brings the preset adjustments to the maintainer. |
| Proposal | Build Distribution Explorer as the first complete slice and reuse its measurable contracts for Convergence, Estimation and Confidence Intervals. | Establish a working theory-to-experiment loop early. Captain and six area owners review sequencing in Discovery. |
| Open | Candidate distributions, fixture tolerances, reproducibility across engines, browser targets, lesson language, projector defaults and data caps. | The research owners record evidence and a decision or explicit deferral before PRD approval. |
| Open | Final area ownership and supported integration path for project Skills and CI configuration. | Captain confirms the roster. Harness maintainer and owner agree and execute protected changes. |

When a proposal is accepted, record the approver, date, supporting research and the alternatives considered. [Discovery skill](https://github.com/GredesCerber/agent-crew/blob/main/skills/crew-discovery/SKILL.md)

## 2026-11-23 — Use a neutral monochrome palette and a restrained yellow signal

The project owner set black, white, neutral greys and minimal yellow as the required art direction. The previous violet instrument shell and green-tinted station study were considered during visual exploration. The team will review the Probability Atlas composition and prototype separately. This decision records the palette and the educational purpose. The prototype and the PRD still require their respective approvals.

## 2026-11-23 — Separate the functional build from owner-managed visual work

The project owner retains the interface, motion, graphic composition and design assets. The functional team delivers computation, prepared chart data, state, storage and tests through typed contracts. The owner requested populated Statistical Engine, Monte Carlo, Inference, Research Data, and QA streams. The approach is a static browser application with local persistence. Hypothesis Testing follows the core estimation and interval labs.

The protected area map and static scaffold are pending maintainer review. Role choices for inference, data and QA remain provisional until the team accepts repository access and confirms ownership. Distribution tolerances, replay scope, interval eligibility, caps and retention remain Discovery decisions. The functional PRD still requires independent review and human approval.

## 2026-11-24 — Merge manually while GitHub Actions is locked

The account's GitHub Actions jobs do not start because of a billing lock, so the required `check` and `crew-guard` statuses cannot turn green. Until the lock is lifted, a PR is ready when the full `crew check` and the task's own tests pass locally, `crew guard --pr <n>` reports no problems, one other-vendor review is recorded with `crew pr review`, and the PR states that CI did not start. The project owner (punyzxc) then merges manually. The owner approved this on 2026-11-24 by merging PRs #8, #9, #17 and #23–#28 that way, and asked to restart work under it. Agents do not rerun, waive or bypass checks. The alternative, pausing all merges until billing is fixed, stopped the team for a day. The rule ends when Actions runs again (see #18 and #27).
