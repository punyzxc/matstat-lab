# A fixed error budget for Monte Carlo acceptance

**Fact — scope:** [issue #32](https://github.com/punyzxc/matstat-lab/issues/32), owner `adekin06`, research budget 2 hours, requires an inventory of #6/#14/#15 comparisons, corrected bands at R=2,000 and 20,000, and a first-release seed/schedule list. This note and [`spikes/qa-multiplicity/`](../../spikes/qa-multiplicity/) are discovery evidence only. No production tests, CI, protected configuration or existing thresholds were changed.

## AC1: what is currently being compared

**Fact — source baseline:** inventory at main `1f4187f2db7e66c8397cc8f5d9a192a59dc84cda` counts individual comparisons, not `test()` blocks, plotted points, or assertions that validate input shape. Repeating the same fixed-stream experiment in Node and a browser is replay of the same scientific event; it does not create independent random evidence. Sources: [#6 tests](../../spikes/visual-accessibility/reference.test.mjs), [#14 evidence runner](../../spikes/simulation-engine/evidence.mjs), [#15 tests](../../spikes/inference-methods/inference.test.mjs).

| Source | Count | Current rule and inputs | Status of a false-failure probability |
|---|---:|---|---|
| #6 reference checks | 5 test blocks, 0 random-comparison gates | Literal analytical/RNG/typed-record anchors | Deterministic; no statistical alpha |
| #15 estimator metrics | **18** comparisons | 3 estimators (mean, variance/n, variance/(n−1)) × 3 metrics (bias, variance, MSE) × 2 models; n=5,R=20,000; seeds Normal=20261123, Exp(1)=20261124; each uses 4 Monte Carlo SE | Normal-reference alpha only; finite-sample calibration not established |
| #15 nominal coverage | **5** comparisons | Normal(10,sd=3); z n=1/5 and t n=2/5/30; R=2,000; binomial alpha_MC=.001 | Valid binomial-model calibration under independent valid replicates with true coverage .95 |
| #14 overall means | **4** comparisons | Uniform(0,1)/Exp(1) × LLN/CLT; seed 2048; LLN N=65,536, CLT n=32,R=4,096,N=131,072; 6 theoretical SE | 6-SE is not an exact finite-sample probability level for these non-Normal outputs |
| #15 skewness illustration | **1** comparison | t on Exp(1),n=5,R=2,000,seed77; expect hits below 1867 | Deliberate undercoverage example; p is not .95, so do not count as a nominal coverage-null gate |

**Fact — arithmetic and statistical distinction:** the metric loop has 9 comparisons per model and is called twice: **18**, not 36. Therefore there are **27 nominal-model comparisons**, plus one model-mismatch illustration. The variance/MSE standard errors are estimated using fourth moments/squared errors from the same replicates. Their studentization, skewness and mutual dependence prevent treating their 4-SE cutoffs as exact size-controlled tests. Source: [`mcCheck` and its two calls](../../spikes/inference-methods/inference.test.mjs).

**Fact — current nominal reference calculation:** if, as an approximation, every standardized 4-SE/6-SE comparison were standard Normal, its two-sided size would be `a4=2*Phi(-4)=0.00006334248366624` and `a6=2*Phi(-6)=0.00000000197317529008`. A union calculation gives `18*a4 + 5*.001 + 4*a6 = .006140172599`, or about **0.6140%**. Assuming independence as well gives `1-(1-a4)^18*(1-.001)^5*(1-a6)^4 = .006123882504`, about **0.6124%**. These are **reference illustrations, not the actual established FWER**: the Normal-size and independence assumptions do not hold exactly for the source suite. Reproduction: [independent calculator](../../spikes/qa-multiplicity/policy.py), [recorded output](../../spikes/qa-multiplicity/evidence.json).

**Fact — discreteness matters:** for `H~Bin(2000,.95)`, the existing inclusive band `[1867,1931]` has actual rejected probability **.000832374126191437**, below .001. Replacing the five .001 terms with that exact-model size gives a smaller normal-reference union value .005302043230 (0.5302%); this still does not make the other 22 comparisons calibrated. The five coverage gates alone have union bound **.004161870631**, without assuming independence across gates. Sources: [finite-sum probability evidence](../../spikes/qa-multiplicity/evidence.json), [binomial PMF definition](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.binom.html).

**Fact — answer to “the current suite-wide rate”:** no defensible single exact finite-sample rate is available for the combined source suite, including the skewed illustration. An unqualified “27 × .001” or “the entire suite fails with probability .001” would be false. The current evidence supports the conditional bounds/reference calculations above and deterministic replay, not an empirical across-seed calibration. Source: the distinct rules in the three inventoried source files above.

## AC2: correction and numerical bands

**Fact — correction principle:** for valid per-comparison sizes `alpha_j`, `P(any false rejection) <= sum(alpha_j)` even when checks share draws or seeds. Bonferroni therefore allocates an error budget in advance; it cannot turn an uncalibrated plug-in SE rule into a valid test. See [NIST Bonferroni method](https://www.itl.nist.gov/div898/handbook/prc/section4/prc473.htm). The scientific intervals remain **95% intervals**; alpha_MC is a separate QA decision threshold.

**Assumption — proposed first-release budget:** fix **9 model-calibrated comparisons per scheduled evaluation**, and spend .0005 for a PR evaluation and .0005 for its paired nightly qualification. Combined family target: **.001 = 0.1%** across the explicitly declared 18 comparisons. Each comparison gets `alpha_j = .001/18 = 1/18000`, and each binomial tail gets `1/36000`. This is a release-evaluation pair budget, not a promise about all CI runs forever. Repeated qualification or additional cases require a new declared allocation.

**Assumption — preserve existing tests:** all deterministic model/oracle/estimator identities remain required on every PR. Keep the existing #15 18 metric checks unchanged until an authorized task approves any new gating policy; their proposed future role is mandatory **reported nightly diagnostics**, not evidence for the calibrated .001 family. Reclassifying or disabling current failing tests is not authorized by this research. The Exp(1) undercoverage example is likewise a named teaching/regression diagnostic, not a null that should satisfy .95 coverage.

### Exact-binomial-model coverage regions

**Fact — definition:** choose inclusive integers `[L,U]` so `P(H<L)<=alpha_j/2`, `P(H>U)<=alpha_j/2`, and moving either endpoint inward would violate its tail budget. Due to integer counts the actual rejected size is generally smaller than alpha_j. The calculation uses the binomial PMF, not a Normal approximation to the hit count. Source: [SciPy binomial definition and tail functions](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.binom.html), [existing region rule](../../spikes/inference-methods/inference.mjs).

**Fact — independently computed regions:** [`policy.py`](../../spikes/qa-multiplicity/policy.py) has no application imports. It evaluates a mode-centred PMF recurrence with **80-decimal-digit arithmetic**, normalized over all integer outcomes, for exact p=19/20. “Exact binomial” describes the distribution, not exact rational/interval arithmetic in software; the recorded excluded-tail probabilities and boundary masses demonstrate the decisions with ample numerical margins. [Python tests](../../spikes/qa-multiplicity/test_policy.py) also compare a small PMF against exact `Fraction` arithmetic.

| Policy | Per-comparison alpha_MC | R=2,000 inclusive hits | R=20,000 inclusive hits |
|---|---:|---|---|
| Current coverage rule | .001 | **[1867,1931]** | **[18897,19100]** |
| Bonferroni across all 27 nominal comparisons, one evaluation | .001/27 = 1/27000 | **[1857,1938]** | **[18870,19125]** |
| **Proposed 9 checks × 2 evaluations** | **.001/18 = 1/18000** | **[1859,1937]** | **[18874,19122]** |

**Fact — proposed-band actual sizes:** the last row rejects probability `.0000477674303347293` at R=2,000 and `.0000533051025643700` at R=20,000 under true coverage .95. Accepted coverage fractions are `[.9295,.9685]` and `[.9437,.9561]`. All lower/upper tail masses and inward-boundary tests are recorded in [evidence.json](../../spikes/qa-multiplicity/evidence.json), and [six integration tests](../../spikes/qa-multiplicity/band-integration.test.mjs) independently compare endpoints with #15's existing implementation.

**Fact — why the 27-check row is not the proposed guarantee:** it supplies the requested sensitivity comparison if every check could be calibrated at that alpha. Under a standard-Normal reference the corresponding metric cutoff would be `z_(1-1/54000)` (recorded in evidence), replacing 4, while interval coverage would use the second table row. Merely inserting that z into an empirical-SE metric check does not establish finite-sample size, especially for sample-variance/MSE estimates under skew. A small fixed list alone also does not control FWER without valid individual bounds. Source: [metric implementation](../../spikes/inference-methods/inference.test.mjs), [calculator](../../spikes/qa-multiplicity/policy.py).

### Finite-sample overall-mean bounds

**Fact — Uniform bound:** for independent draws in [0,1], Hoeffding gives `P(|mean-.5|>=e)<=2 exp(-2 N e^2)`. Thus `e=sqrt(log(2/alpha_j)/(2N))` is a finite-sample bound. Source: [Duchi, Probability Bounds, Hoeffding section](https://ai.stanford.edu/~jduchi/projects/probability_bounds.pdf).

**Fact — Exponential bound, derived:** for independent Exp(1), `M(t)=1/(1-t)` for t<1. Applying the Chernoff/Markov method and optimizing gives upper tail `exp[-N(e-log(1+e))]`; lower tail `exp[-N(-e-log(1-e))]`, with 0<e<1 for the lower side. Solve the two exponents separately for alpha_j/2; the limits are asymmetric. Sources: [exponential MGF](https://www.statlect.com/probability-distributions/exponential-distribution), [Chernoff method](https://ai.stanford.edu/~jduchi/projects/probability_bounds.pdf). The spike uses bisection and outward-rounded binary64 endpoints; these printed numbers are numerical evaluations of the analytic bound.

**Assumption — matched workloads:** for the proposed mean cases use N=32R raw draws for both LLN and CLT: LLN has one path of n=32R; CLT has n=32 and R independent replicates, and the checked statistic is the average of replicate means. Equal replicate sizes make its overall average the average of all N draws mathematically. This changes the **proposed manifest**, not #14's old recorded workloads.

| Model / bound | R=2,000, N=64,000: accepted overall mean | R=20,000, N=640,000: accepted overall mean |
|---|---|---|
| Uniform(0,1), Hoeffding | [0.49094665366708323, 0.5090533463329168] | [0.49713708051416494, 0.5028629194858351] |
| Exp(1), Chernoff | [0.9820024261442384, 1.018216141272428] | [0.994285084220464, 1.0057367725928603] |

**Fact — conditional guarantee:** the probability inequalities assume the specified laws and independent raw observations/interval replicates. Bonferroni does **not** require independence between the nine comparisons, which may share seeds or prefixes. A fixed pseudorandom stream is deterministic, and neither its independence nor its ideal continuous law is proved by a passing test. Floating-point arithmetic and provisional samplers add implementation error outside this ideal-model calibration. Source: [#14 limitations](simulation-engine.md), the concentration results above, and [#15 sampler](../../spikes/inference-methods/inference.mjs). Do not attach an unconditional real-PRNG guarantee to the .001 target.

## AC3: mandatory first-release cases and schedule

**Assumption — proposed fixed manifest:** the following nine comparison IDs and seeds are the complete calibrated family per evaluation. The machine-readable [manifest in evidence.json](../../spikes/qa-multiplicity/evidence.json) includes all parameters and both schedules. Freeze it before the run; no seed selection from observed results.

| ID | Model / statistic | Fixed seed | Every PR | Paired nightly |
|---|---|---:|---|---|
| coverage-z-n1 | Normal(10,sd=3), z, n=1 | 1001 | R=2,000 | R=20,000 |
| coverage-z-n5 | same, z, n=5 | 1005 | R=2,000 | R=20,000 |
| coverage-t-n2 | same, t, n=2 | 2002 | R=2,000 | R=20,000 |
| coverage-t-n5 | same, t, n=5 | 2005 | R=2,000 | R=20,000 |
| coverage-t-n30 | same, t, n=30 | 2030 | R=2,000 | R=20,000 |
| mean-uniform-lln | Uniform(0,1), final path mean | 2048 | n=64,000, repetitions=1 | n=640,000, repetitions=1 |
| mean-uniform-clt | Uniform(0,1), mean of replicate means | 2048 | n=32,R=2,000 | n=32,R=20,000 |
| mean-exponential-lln | Exp(1), final path mean | 2048 | n=64,000, repetitions=1 | n=640,000, repetitions=1 |
| mean-exponential-clt | Exp(1), mean of replicate means | 2048 | n=32,R=2,000 | n=32,R=20,000 |

**Fact — seed provenance:** coverage uses #15's `mulberry32` plus cached Box–Muller; mean cases use #14's `fixture-mix32-v1`/`simulation-fixture-v1`. These are **different provisional generators**, not interchangeable production seed contracts. The manifest pins the baseline source and versions; do not expect the same integer seed in a new RNG to reproduce these vectors. Source: [inference sampler](../../spikes/inference-methods/inference.mjs), [simulation engine](../../spikes/simulation-engine/engine.mjs).

**Assumption — always-run deterministic requirements:** every PR also runs the independent #6 scalar/RNG/typed-record witnesses, exact #13 model/parameter/support fixtures, fixed-array mean/variance/divisor and oracle identities from #15, interval quantiles/endpoints/typed error cases, sign-test exact sums where supported, and #14 replay/lifecycle/stale-event checks. These are not additional stochastic tests with a new alpha budget. Require zero failed/invalid replicate intervals in the five Normal coverage cases; do not quietly replace R with a smaller valid count after failures. Extra per-prefix probabilistic assertions would add comparisons and require a new allocation.

**Assumption — required nightly reports:** emit all 18 #15 bias/variance/MSE diagnostics at n=5,R=20,000, with existing seeds 20261123 (Normal mu=1,var=4) and 20261124 (Exp rate=1), estimates and MCSEs; do not infer a corrected finite-sample FWER from their empirical fourth moments. Also retain the Exp(1) t-interval example at n=5,R=2,000,seed77 as a clearly labeled undercoverage illustration (old recorded hits=1783). An approved change could freeze that illustration's seeded outcome as a deterministic regression; its unknown true coverage is not .95 and does not belong in the .95 binomial-null family. Source for old settings/results: [#15 note](inference-methods.md).

**Assumption — repeated runs and retries:** no retry-to-green, rerolling seeds, adding models after seeing results, or expanding a band around a failure. With pinned code/seed, repeating a failed run normally reproduces the same event; it is not an independent second chance. A new declared random-seed family must spend another budget. If an actual lifetime bound is required across indefinitely many qualified families, preallocate e.g. `alpha_t=.001/[t(t+1)]`, whose sum over t>=1 is .001, then divide each family's allocation across its scheduled comparisons. This changes bands over time and needs an owner decision; a per-family .001 is not a lifetime .001.

## Executed evidence and limits

**Fact — independent numerics executed:** CPython **3.12.14**, no third-party packages, generated [evidence.json](../../spikes/qa-multiplicity/evidence.json). Eight Python tests verify source-count arithmetic, a small exact-rational PMF, the old [1867,1931] anchor, all tail/maximality inequalities, allocation, monotonic widening and the mean-bound exponents. Six Node integration tests compare all table endpoints to the existing binomial-band implementation. All 19 existing #15 tests also pass unchanged. Sources: [Python tests](../../spikes/qa-multiplicity/test_policy.py), [Node tests](../../spikes/qa-multiplicity/band-integration.test.mjs).

**Fact — feasibility executed:** [`run-cases.mjs`](../../spikes/qa-multiplicity/run-cases.mjs) executes the nine frozen cases at both schedules against the existing discovery implementations. All **18 executions passed** without changing seeds or thresholds; [observed.json](../../spikes/qa-multiplicity/observed.json) records hits/means and the compared bands. This is a feasibility/replay observation, **not an empirical estimate of FWER**, a PRNG-quality study or production/browser acceptance. No new browser run was performed.

**Fact — harness validation:** full `crew check` was executed and returned `status: warning`, `green: true`, `verified: false`: every configured step was skipped because the current scaffold has no web/api package or executable acceptance tests. The 8 Python tests, 6 new Node comparisons, 19 unchanged inference tests, regeneration check and 18 fixed-case executions above are separate executed research evidence. Source: [checked-in crew configuration](../../crew.config.json) and the reproduction commands below. This is not a claim that product CI passed.

**Fact — reproduce from the repository root:** use the recorded Python interpreter and Node 26.13.1:

```text
python spikes/qa-multiplicity/test_policy.py
python spikes/qa-multiplicity/policy.py --check
node --test spikes/qa-multiplicity/band-integration.test.mjs spikes/inference-methods/inference.test.mjs
node spikes/qa-multiplicity/run-cases.mjs
```

**Assumption — integration and approval:** retain all existing mandatory checks. Adopt revised schedules/thresholds only through a new approved task and the authorized harness/infra path. This note addresses the open C3 in the [scientific decision register](scientific-decision-register.md) without editing or claiming agreement in that register. Use the captain's [#27 local-check/review/manual-merge procedure](https://github.com/punyzxc/matstat-lab/issues/27#issuecomment-7126240401) while Actions billing prevents job startup; never manually set successful statuses.

## Position

**Assumption — proposed position:** retain deterministic scientific identities as the hard correctness foundation. Use a predeclared nine-case, model-calibrated family with combined .001 budget for a PR/nightly qualification pair; use exact-binomial coverage regions and finite-sample mean bounds, not uncalibrated 4/6-SE rules advertised as exact probabilities. Keep the 18 estimator-metric comparisons and the skewed-coverage example explicit and reproducible, with their current checks unchanged pending owner approval. Open choices: the final release-family budget, production RNG contract and how to qualify variance/MSE diagnostics before they receive any finite-sample FWER claim. The current combined suite's true false-failure probability remains unestablished; the corrected proposal states exactly which conditional guarantee it can support.
