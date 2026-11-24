# Lecture 11: estimation, confidence intervals and homogeneity

Research for `lecture-estimation-intervals` (issue #46). Owner: punyzxc (Claude agent). Date: 2026-11-24.

**Question.** Which kernel shows estimator bias and MSE, the coverage of the normal-approximation, Student t and χ² intervals, and the two-series homogeneity test of lecture 11?

**Answer in one line.** One kernel, [`spikes/lecture-estimation-intervals/kernel.mjs`](../../spikes/lecture-estimation-intervals/kernel.mjs), serves three stations (Estimation, Confidence Intervals, Homogeneity) through the shared contract of `docs/research/lecture-module-map.md`. Its 12 `node:test` cases in [`kernel.test.mjs`](../../spikes/lecture-estimation-intervals/kernel.test.mjs) cover the four acceptance criteria. Run `node --test spikes/lecture-estimation-intervals/kernel.test.mjs` (Node 24, about 2 s).

## What the kernel contains

| Part | Lecture formula | Function |
| --- | --- | --- |
| Mean, sample variance (divisor n), corrected variance (divisor n − 1) | L11 (123), (124), (126) | `mean`, `variance(x, 'n' \| 'n-1')`, exact `oracles(n, σ², κ)` |
| Approximate interval for M: x̄ ± Φ⁻¹((1 + γ)/2)·√(s²/n) | L11 (128), (129), (131) | `approxMeanInterval` |
| Approximate interval for D: s² ± Φ⁻¹((1 + γ)/2)·√(2/(n − 1))·s² | L11 (130), (132) | `approxVarianceInterval` |
| Student t interval for M | L11 (133), (135), (136) | `tMeanInterval` |
| χ² interval for D | L11 (134), (137), (138) | `chiSquareVarianceInterval` |
| Two series of Bernoulli trials, H₀: p₁ = p₂ | L11 (139) | `homogeneityTest(m₁, n₁, m₂, n₂, α)` returns z, the two-sided p-value 2Φ(−\|z\|) and the decision |
| One series, H₀: p = p₀ | L11 (140) | `proportionTest(m, n, p₀, α)` |
| Coverage of R replicates with an exact binomial band | none (lab method) | `coverageAt`, `acceptanceBand` |

Special functions (`normalCdf`, `normalQuantile`, `studentTQuantile`, `chiSquareQuantile`, `erf`, `laplacePhi0`) are local copies in `special.mjs`, under the names that #54 will export from `spikes/lecture-special-functions/special.mjs`. When #54 merges, the switch is one import line. Quantiles are computed (Acklam plus a Halley step for the normal; bisection on the regularized incomplete beta and gamma functions for t and χ²). No table is used.

Randomness comes only from `fixtureUint32(seed, stream, index, 0x4611)` in `spikes/simulation-engine/engine.mjs`. Replicate r of a sample uses indices r·4096 + i. Each sample size n has its own stream, so a point for one n does not change when another n is added to a chart. Normal draws use the inverse CDF. The skewed law is a shifted exponential with the same μ and σ (excess kurtosis 6).

## Stations

All three open as panels inside the Orbital laboratory scene, through the host of #37 (`KernelStation`). The kernel exports `stations: { estimation, confidence, homogeneity }`, each with its own parameters. Every station has one chart, a readout table with theory next to observation, and teaching notes.

| Station | Parameters | Chart (`view`) | Readouts |
| --- | --- | --- | --- |
| **Estimation** | n, σ, law, R, view | 0: histograms of s² with both divisors, rules at σ² and at the average of the biased one. 1: bias against n, with the theory curve −σ²/n. 2: MSE against n for both divisors (consistency). | Bias of each divisor with a 4-SE band, MSE of each, Var(x̄), Var(median), efficiency Var(x̄)/Var(median) (2/π for normal data at large n) |
| **Confidence Intervals** | n, γ, target (M or D), law, R, view | 0: coverage hits/R against n for the approximate and the exact method, with γ and its 99.9 % Monte Carlo band. 1: the first 40 intervals at the chosen n, misses highlighted. | Coverage with hits/R and the band, mean widths, and the L11 example with the lecture's printed values next to the correct ones |
| **Homogeneity** | n₁, p₁, n₂, p₂, α, R | Histogram of z over R repeated experiments against N(0, 1), critical values ±z₁₋α/₂, the z of the first experiment | z, p-value and decision for the first experiment, the rejection rate (type I error when p₁ = p₂, power otherwise) with its band, the L11 examples for (139) and (140) |

The station parameters are numbers, because the contract sliders are numeric. A choice such as the law or the view is a 0/1/2 slider whose label names the options. *Assumption:* this is good enough for the spike. A product version would want a select control in the host contract (a question for #37).

## Facts

- **Fact.** For i.i.d. data with variance σ², E[Σ(xᵢ − x̄)²/n] = (n − 1)σ²/n, so the divisor-n estimator has bias −σ²/n, and the divisor n − 1 removes it. [Casella & Berger, *Statistical Inference*, 2nd ed., §7.3.1](https://www.routledge.com/Statistical-Inference/Casella-Berger/p/book/9781032593036). Lecture 11 states the same after (124)–(126).
- **Fact.** Var(s²) = σ⁴(2/(n − 1) + κ/n) for any law with a finite fourth moment, κ the excess kurtosis. For normal data (n − 1)s²/σ² ~ χ²(n − 1). Casella & Berger, Theorem 5.3.1; already used in [`docs/research/inference-methods.md`](inference-methods.md) (PR #25).
- **Fact.** For normal data the divisor-n estimator has the smaller MSE, (2n − 1)σ⁴/n² against 2σ⁴/(n − 1). It follows from the two facts above. The test pins 9/25 and 1/2 for n = 5.
- **Fact.** For normal data the t interval (136) and the χ² interval (138) have exact coverage γ at every n ≥ 2. [NIST/SEMATECH e-Handbook 7.2.2.1](https://www.itl.nist.gov/div898/handbook/prc/section2/prc221.htm) and [1.3.5.8](https://www.itl.nist.gov/div898/handbook/eda/section3/eda358.htm).
- **Fact.** The number of covering intervals among R independent replicates is Binomial(R, p). The kernel reports hits/R with the exact binomial region whose two tails each hold at most 0.05 % (a 99.9 % band). [Morris, White & Crowther (2019), *Statistics in Medicine* 38:2074](https://doi.org/10.1002/sim.8086).
- **Fact (spike output, seed 20261124, R = 4000, γ = 0.95, band 0.938–0.961).** Coverage, written as approximate/exact:

  | Target, law | n = 3 | 5 | 8 | 12 | 20 | 30 | 50 | 100 |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | M, normal | 0.804/0.944 | 0.876/0.942 | 0.903/0.951 | 0.922/0.950 | 0.940/0.953 | 0.942/0.952 | 0.947/0.954 | 0.948/0.950 |
  | M, skewed | 0.732/0.880 | 0.807/0.876 | 0.862/0.902 | 0.876/0.902 | 0.909/0.923 | 0.921/0.930 | 0.924/0.930 | 0.944/0.948 |
  | D, normal | 0.707/0.948 | 0.799/0.944 | 0.850/0.955 | 0.876/0.951 | 0.897/0.951 | 0.911/0.951 | 0.925/0.947 | 0.947/0.949 |
  | D, skewed | 0.550/0.880 | 0.621/0.812 | 0.662/0.792 | 0.673/0.755 | 0.690/0.733 | 0.691/0.726 | 0.692/0.700 | 0.680/0.690 |

  The approximate methods under-cover at small n and reach the band only near the lecture's own rule n > 20 (M) or later (D). The exact methods stay in the band for normal data. For the skewed law the χ² interval does not recover as n grows: it depends on normality through Var(s²), whose κ term does not vanish. This is a documented limitation of (138), not a bug, and it is the station's strongest teaching case.
- **Fact (spike output).** Under H₀ (n₁ = 200, n₂ = 300, p = 0.3, R = 2000, α = 0.05) the rejection rate of (139) stays in the binomial band around α. The lecture example gives z = −0.4474, p = 0.6546, H₀ not rejected.
- **Fact (spike output, seed 20261124, R = 2000).** With small expected counts the pooled z test leaves the band: p₁ = p₂ = 0.05, n₁ = n₂ = 50, α = 0.01 gives 4/1987 = 0.002 rejections against the band 0.004–0.018, and the readout marks it "below the band". The station then warns that the smallest expected count (here 2.5) is below 10 and z is only roughly normal. The band is computed over the non-degenerate replicates (p̃ = 0 or 1 is left out).

## Lecture errata (lecture 11)

The lab shows the correct value and names the lecture's value next to it.

| Where | Lecture prints | Correct | Check |
| --- | --- | --- | --- |
| Example data, s² | 0.0303 | 0.02799 (Σx = 66.7, Σx² = 202.81, divisor 21) | exact sum in tenths in the test |
| Approximate intervals, γ = 0.95 | 2.9593 < M < 3.1043, 0.0119 < D < 0.0487 | 2.9619 < M < 3.1017, 0.0111 < D < 0.0449 | follows from the correct s²; the method itself is the lecture's |
| t interval (136) | 2.9528 < M < 3.1108 (t = 2.08) | 2.9576 < M < 3.1060 (t₀.₉₇₅(21) = 2.0796) | Simpson integration of the t density |
| χ² interval (138) | χ² = 37.6 and 9.9, 0.017 < D < 0.064 | χ²₀.₉₇₅(21) = 35.479, χ²₀.₀₂₅(21) = 10.283, 0.0166 < D < 0.0572 | Simpson integration of the χ² density, and `chiSquareCdf` |
| Formula 140 example | numerator written 0.480 − 0.490 | 0.480 − 0.5; the printed value −1.26 matches it (−1.2649) | closed form |

Checked and correct: (139) on the lecture data gives z = −0.447; the decision rule 2Φ(−|z|) ≤ α (Φ integrated from −∞, as the lecture defines it before (128)).

## Position

- **Proposal.** Merge this kernel as the reference for the three L11 stations. In the scene host (#37), switch `estimation` and `confidence` in `catalog.ts` from `kind: 'legacy'` to `kind: 'kernel', kernel: 'lecture-estimation-intervals', issue: 46`. The legacy prototypes show only a known-σ z interval and a mean estimate; the kernel covers what lecture 11 teaches.
- **Owner decision needed (placement).** Orbit IV already has six stations, the maximum. Homogeneity is a seventh. Options: (a) it replaces the Randomness slot, which is not in the lectures (recommended); (b) it opens as a third view inside Confidence Intervals; (c) it stays reachable only by URL. Until the owner decides, the host can register it as `hidden: true`.
- **Why one kernel.** The three stations share the sampler, the estimators, the quantiles and the band. Splitting them would copy that code three times.
- **Performance.** All views run in 10–300 ms at default parameters in Node 24. The heaviest case (coverage against n with R = 4000) takes about 0.5–1 s and runs on the main thread in the host. *Assumption:* acceptable for a spike; the product should move `run` to a Worker, as the engine spike already does.
- **Unsure.** Whether to show the lecture's approximate intervals at all, since the exact ones exist. Proposal: keep them, because the under-coverage at small n is the point of the comparison and the lecture teaches them first.
