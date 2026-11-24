# Functional iteration and handoff

The production identifiers below are draft PRD task IDs. GitHub issues will be created by the approved crew kickoff. The five live research issues can work independently with fixture inputs.

| Iteration | Implementation tasks | Independent tests and dependency |
| --- | --- | --- |
| 1. Contracts and foundation | T1 static smoke scaffold, T2 experiment contracts, T4 seeded RNG | T3 tests the contracts before T2. T5 tests RNG before T4. |
| 2. Statistical core | T6 continuous laws, T8 discrete laws, T9 descriptive statistics, T11 scientific series | Continuous and discrete laws share T4. Summary T9 can start after T2. T11 consumes reviewed models and summaries. T7, T10 and T12 are independent acceptance. |
| 3. Simulation | T13 worker lifecycle and reproducibility, T15 LLN and CLT | T14 validates T13 independently. T15 consumes T9 and T13. |
| 4. Inference | T16 estimator metrics, T17 intervals and coverage | Both use the validated numerical core and simulation. T18 validates intervals independently. |
| 5. Persistence and integration | T19 journal and per-module last result, T21 comparison and export, T23 functional adapter | The journal can start immediately after T2. T20, T22 and T24 validate persistence, exports and integration. |
| 6. Advanced study | T25 exact sign test and power | Requires completed estimator and interval studies. |

## Functional queue

- GredesCerber can claim [#13](https://github.com/punyzxc/matstat-lab/issues/13) for distributions and independent numerical references.
- Jumalinova can claim [#14](https://github.com/punyzxc/matstat-lab/issues/14) for worker execution and convergence after handing off #12.
- The other three slots are [#15 inference](https://github.com/punyzxc/matstat-lab/issues/15), [#4 research data](https://github.com/punyzxc/matstat-lab/issues/4), and [#6 independent QA](https://github.com/punyzxc/matstat-lab/issues/6).
- GitHub confirmed write access for GredesCerber and Jumalinova and admin access for punyzxc at planning time. Invites for pluxha and adekin06 are pending. The remaining login is unconfirmed. Assign each open stream to an eligible participant when the roster and capacity are confirmed.

## Production gate

The proposed path split has passed the installed crew parser and dependency linter against the proposed areas. The live configuration still rejects the four new product areas. After maintainer approval and configuration, add the confirmed crew-team mapping, run `crew task lint`, confirm Discovery exits, have a different vendor review the PRD, merge through the required checks, and preview the reviewed plan with `crew kickoff`. The captain then approves that revision in the board. Only `crew kickoff --apply` publishes the production plan. The first ready build task is T1.
