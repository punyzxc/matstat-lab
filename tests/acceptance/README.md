# tests/acceptance/

Acceptance tests for tasks' acceptance criteria. The builder writes them in the **first commit** of their task, before the implementation.

- One file per task: `test_<issue>_<slug>.*` / `<issue>-<slug>.spec.ts`.
- You may add new files. **Existing** ones are not changed or deleted: the `crew-guard` check rejects such a PR.
- The exception is a task whose "Changes acceptance" section lists these files (the `changes_acceptance` field in the PRD). The planner/analyst writes it, usually from human feedback ("login must be by phone, not by email").
- The reviewer agent checks that every Given/When/Then of the task is covered by a test and that the test is not fitted to the code.
- For `risk:high` the tests are written by **a different agent** in a separate task, in `tests/pending/<T>/` (CI does not run them there). The main task's executor moves them here unchanged in the first commit: `git mv tests/pending/<T>/* tests/acceptance/`.
