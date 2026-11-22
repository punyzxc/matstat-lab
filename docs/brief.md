# STATUM LAB

STATUM LAB is an interactive Monte Carlo laboratory for students and instructors studying mathematical statistics. Its central question is how sample size and the properties of a distribution affect estimator accuracy and the reliability of statistical conclusions.

Students choose a distribution, set its parameters and sample size, make a prediction, and run a reproducible experiment. They compare theory with simulated results, explain discrepancies, and save the settings and findings for reuse. Instructors use the same experiments in a projector view with readable charts and controls.

| Experiment | Learning outcome |
| --- | --- |
| Distribution Explorer | Connect the sample histogram and empirical CDF with the distribution, expectation, variance, and standard deviation. |
| Convergence Laboratory | Distinguish the law of large numbers from the central limit theorem using running means and repeated sample means. |
| Estimation Laboratory | Measure bias, variability and MSE. Compare variance estimates with divisors n and n−1 and explore consistency. |
| Confidence Interval Laboratory | Compare nominal confidence with observed coverage across independent samples, methods and sample sizes. |

All four experiments use one statistical engine. A run supports seeded replay, parameter changes between runs, pause and resume, reset, repeated sampling, two-run comparison, local research notes, and export. Experiments include predictions, worked explanations, assumptions, and interpretation questions. The application supports light and dark themes, keyboard operation, reduced motion, and responsive and projector layouts.

The first foundation milestone is one complete Distribution Explorer workflow. The remaining three experiments follow once their mathematical contracts and reference tests have been reviewed. Hypothesis testing, Bertrand's paradox and other random-sampling methods are candidates for a later release. The first release is a browser-only application, with local history and no account requirement.

Scientific quality requires documented formulas and parameter domains, seeded deterministic tests, numerical stability checks, and independent NumPy/SciPy reference fixtures. The UI clearly identifies theoretical quantities, empirical measurements, and approximations. Synthetic results come from the engine and fixtures, with methods and versions recorded.

The six-person team uses the existing public GitHub repository and agent-crew in team Discovery mode. The native queue, host adapters, worktrees, PR checks, independent review, and main protection govern implementation. The initial bootstrap includes the project brief, research questions, tooling and onboarding. The captain approves the PRD revision after Discovery and before foundation work.

Source material for this brief is the project bootstrap and product description supplied by the project owner. Primary course lecture PDFs are pending.
