# Convergence teaching discovery fixture

This is a bounded experiment, not product code or PRNG certification. The predeclared [plan](plan.json) selects two ideal models, three seeds, nine LLN prefixes, five CLT sizes and 4,096 replicate streams. This local teaching study defines 54 LLN events and 30 whole-CDF CLT events; its own family union bound allocates 0.001/84 to each, without assuming event independence. This study is separate from the proposed nine-case PR/nightly qualification family in [task #32](../../docs/research/qa-multiplicity.md); it does not replace or add to release qualification or change CI policy. No seed or threshold is tuned to the results. All 36 cases replay the complete canonical #14 scientific payload at draw budgets 1, 7 and 2048, and each case records its payload SHA-256. Results contain no timestamps.

Each LLN case uses successive prefixes of a single stream, not independent checkpoint samples. Uniform bands use Hoeffding's inequality clipped to [0,1]; Exponential bands use equal-tail Gamma quantiles. Each CLT case uses separate replicate-indexed streams and the engine's complete standardized histogram. Counts at -4 are underflow (z < -4); each interior edge accumulates bins strictly below the edge; the +4 endpoint includes equality, following the engine's bin convention. Underflow and overflow are preserved. The grid distance is the largest absolute difference at the 17 declared edges, not a full Kolmogorov supremum or a full-sample KS statistic. `means` retains only the first 256 of 4,096 means and cannot establish the full empirical CDF; it is not used for these comparisons.

The reference is independently computed in Python using SciPy's Irwin–Hall and Gamma finite-n distributions, normal CDF, and Gamma quantiles. Its DKW-Massart epsilon applies to the ideal iid empirical CDF; finite-n model comparison is the engine diagnostic. Normal-band compatibility is descriptive: finite-n Exponential means, especially n=1, are not normally distributed, so failure against Phi is not an engine failure. The probability bands assume ideal iid draws; the deterministic fixture mixer is an execution fixture and does not establish independence or certify a production generator. This study simulates only Uniform and Exponential; it makes no Normal, Cauchy, or Pareto simulation claim. A trajectory or a sequence of per-seed grid distances need not improve monotonically.

Reproduction requires the recorded Node/V8, Python, NumPy and SciPy versions; cross-runtime bitwise equality is not promised. From the repository root:

```sh
python3 spikes/convergence-teaching/reference.py --check
node spikes/convergence-teaching/run.mjs --check
node --test spikes/convergence-teaching/fixtures.test.mjs
```

To regenerate after an intentional change, run `python3 spikes/convergence-teaching/reference.py --write`, then `node spikes/convergence-teaching/run.mjs --write`. The runner validates the plan and independent reference before execution; hashes of the plan, engine, reference, and both generators plus runtime versions are recorded in results. Checks compare exact generated files and therefore detect drift, missing or changed references, and runtime differences. Results faithfully retain any diagnostic failures.
