# Estimator metrics and the first confidence methods

Issue #15. Question: which oracles let the team check estimators and the first confidence intervals, and how should a coverage experiment be validated?

A throwaway reference implementation with 19 `node:test` cases is in [`spikes/inference-methods/`](../../spikes/inference-methods/). It is not product code. Run `node --test inference.test.mjs` from that folder (Node 24, about 1 s). It has no Worker and no UI dependency. Samples come from a fixed-seed generator that exists only in the spike.

## Facts

- **Bias, variance and MSE.** For an estimator θ̂ of θ, bias = E[θ̂] − θ, and MSE = Var(θ̂) + bias². [Casella & Berger, *Statistical Inference*, 2nd ed., §7.3.1](https://www.routledge.com/Statistical-Inference/Casella-Berger/p/book/9781032593036)
- **Sample mean.** For i.i.d. data with variance σ², the sample mean is unbiased with Var(X̄) = σ²/n. This holds for any law with finite variance. Same source, §5.2.
- **Variance with an explicit divisor.** s² = Σ(xᵢ − x̄)²/(n − 1) is unbiased for n ≥ 2. The plug-in σ̂² = Σ(xᵢ − x̄)²/n has bias −σ²/n and is defined from n = 1. NumPy exposes the same choice through `ddof`, with divisor `N − ddof`. [numpy.var](https://numpy.org/doc/stable/reference/generated/numpy.var.html)
- **Exact variance of s².** For any law with finite fourth moment, Var(s²) = σ⁴ (2/(n − 1) + κ/n), where κ is the excess kurtosis. κ is 0 for Normal and 6 for Exponential. For Normal data, (n − 1)s²/σ² ~ χ²ₙ₋₁, which gives Var(s²) = 2σ⁴/(n − 1). [Casella & Berger, Theorem 5.3.1](https://www.routledge.com/Statistical-Inference/Casella-Berger/p/book/9781032593036) · [Wikipedia: Variance of the sample variance](https://en.wikipedia.org/wiki/Variance#Distribution_of_the_sample_variance)
- **The biased divisor wins on MSE for Normal data.** MSE(σ̂²) = (2n − 1)σ⁴/n², which is below MSE(s²) = 2σ⁴/(n − 1). This is a useful teaching contrast: unbiased does not mean more accurate. It follows from the two facts above. The spike checks it for n = 5.
- **Interval with known σ (z).** For i.i.d. Normal data, x̄ ± z₁₋α/₂ σ/√n has exact coverage 1 − α for every n ≥ 1. [NIST/SEMATECH e-Handbook, 7.2.2.1](https://www.itl.nist.gov/div898/handbook/prc/section2/prc221.htm)
- **Interval with unknown σ (t).** x̄ ± t₁₋α/₂,ₙ₋₁ s/√n has exact coverage under normality. It needs n ≥ 2 and s > 0. [NIST/SEMATECH e-Handbook, 7.2.2.1](https://www.itl.nist.gov/div898/handbook/prc/section2/prc221.htm) · [scipy.stats.t](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.t.html)
- **Reference quantiles used in the tests.** All values except one are the published `scipy.stats.norm.ppf` and `scipy.stats.t.ppf` values:

  | Quantile | Value |
  | --- | --- |
  | z₀.₉₇₅ | 1.959963984540054 |
  | z₀.₉₉₅ | 2.5758293035489004 |
  | t₀.₉₇₅ with df = 1 | 12.706204736174698 |
  | t₀.₉₇₅ with df = 4 | 2.7764451051977987 |
  | t₀.₉₇₅ with df = 9 | 2.2621571627409915 |
  | t₀.₉₇₅ with df = 29 | 2.045229642132703 |
  | t₀.₉₉₅ with df = 9 | 3.249835541592118 (see below) |

  The spike's quantile code matches them to 1e-10. The df = 9 value was first recalled as 3.2498355440153697. That value disagreed with the spike by 2.4e-9, so it was recomputed from the closed-form Student t CDF for odd df (θ = atan(t/√ν), a finite cosine series). That formula is independent of the spike's incomplete-beta code, and it confirms 3.249835541592118 to 1e-16. *Assumption:* the other values are the standard published ones. SciPy was not available on this machine, so they were not re-run against a pinned SciPy version. #13 owns the pinned SciPy fixtures, and this case shows why they are needed.
- **Coverage is a binomial proportion.** If each of R independent intervals covers with probability p, then the number of hits H ~ Binomial(R, p). The Monte Carlo standard error of Ĥ/R is √(p(1 − p)/R), which is about 0.0049 for p = 0.95 and R = 2000. [Morris, White & Crowther (2019), "Using simulation studies to evaluate statistical methods", *Statistics in Medicine* 38:2074](https://doi.org/10.1002/sim.8086)
- **The t interval is not robust to strong skew at small n.** In the spike, Exponential(1) data at n = 5 gave 1783 hits out of 2000 (0.892), which is below the band. This is a documented limitation, not a bug. Morris et al. above discuss how assumptions shape coverage.
- **Exact sign test.** For a continuous law with median m₀, the number of observations above m₀ is Binomial(n′, 1/2), where n′ excludes ties with m₀. The two-sided p-value is min(1, 2·min(P(S ≤ s), P(S ≥ s))). [Conover, *Practical Nonparametric Statistics*, 3rd ed., §3.4](https://www.wiley.com/en-us/Practical+Nonparametric+Statistics%2C+3rd+Edition-p-9780471160687) · [scipy.stats.binomtest](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.binomtest.html)

## Estimator oracles

The oracles are for i.i.d. data with mean μ, variance σ², excess kurtosis κ and sample size n. The denominators are always explicit.

| Estimator | Defined for | Bias | Variance | MSE |
| --- | --- | --- | --- | --- |
| x̄ = Σxᵢ / n | n ≥ 1 | 0 | σ²/n | σ²/n |
| s² = Σ(xᵢ−x̄)² / (n−1) | n ≥ 2 | 0 | σ⁴(2/(n−1) + κ/n) | same as variance |
| σ̂² = Σ(xᵢ−x̄)² / n | n ≥ 1 (oracle from n ≥ 2) | −σ²/n | ((n−1)/n)² · σ⁴(2/(n−1) + κ/n) | variance + σ⁴/n² |

For a sample of size n, an estimator's output in the snapshot should carry its divisor name (`n` or `n-1`). This matches the `statistics.varianceDenominator` field proposed in #22.

**Monte Carlo check of an oracle.** The check is predeclared before it runs:

- R = 20 000 replicates
- a fixed seed for each case (20261123 for Normal, 20261124 for Exponential)
- acceptance when the observed bias is within 4 Monte Carlo standard errors, √(Var(θ̂)/R), of the oracle bias

The spike passes this check for Normal(μ = 1, σ² = 4) and Exponential(1), both at n = 5.

## Confidence methods for the mean of Normal data

| Method | Formula | Minimum n | Typed failures (no exceptions) |
| --- | --- | --- | --- |
| `z-known-sigma` | x̄ ± z₁₋α/₂ · σ/√n | 1 | `sigma-not-positive` (also when σ is missing), `level-out-of-range`, `non-finite-data`, `n-too-small` (n = 0), `non-finite-result` (overflow) |
| `t-unknown-sigma` | x̄ ± t₁₋α/₂,ₙ₋₁ · s/√n | 2 | `n-too-small` (n < 2), `zero-sample-variance` (s = 0), `level-out-of-range`, `non-finite-data`, `non-finite-result` (overflow) |

Each result lists its assumptions: `iid` and `normal`, plus `sigma-known` for z. When the data come from a non-Normal model, the result is still computed, but the UI must show a structured applicability warning. One example is the under-coverage of skewed data at small n described above. The interval is never silently withheld. *Assumption:* the module chooses this "warn, don't refuse" behavior for non-Normal models. Refusing would make the teaching case for skewed data impossible.

## Validating a coverage experiment

Declare all of these before running:

1. **Nominal target:** exactly 1 − α, with α = 0.05.
2. **Repetitions and seeds:** R = 2000 independent replicate samples. Each case uses its own fixed seed: 1000 + n for z, 2000 + n for t, and 77 for the Exponential case. A coverage run where no replicate is valid returns the typed failure `no-valid-replicates`, never NaN.
3. **Acceptance band:** an exact two-sided binomial region for H under p = 0.95, with at most 0.0005 in each tail (α_MC = 0.001). For R = 2000 this is [1867, 1931] hits, computed from the binomial PMF and not from the normal approximation.
4. **Reporting:** the hits, the valid replicates, the replicates where the method was not applicable, coverage = hits/valid, and its Monte Carlo standard error.
5. **Limitations:** the band tests "consistent with nominal". It cannot prove exact coverage. A band at α_MC = 0.001 still fails about 1 run in 1000 by chance. Running many cases (n, σ, level) multiplies that rate, so a later suite needs either a Bonferroni-adjusted α_MC or a fixed small set of cases.

Results in the spike (R = 2000, μ = 10, σ = 3):

| Method | n | Hits | Coverage | MCSE | Inside the band |
| --- | --- | --- | --- | --- | --- |
| z | 1 | 1915 | 0.9575 | 0.0045 | yes |
| z | 5 | 1891 | 0.9455 | 0.0051 | yes |
| t | 2 | 1911 | 0.9555 | 0.0046 | yes |
| t | 5 | 1895 | 0.9475 | 0.0050 | yes |
| t | 30 | 1899 | 0.9495 | 0.0049 | yes |
| t, Exponential(1) data | 5 | 1783 | 0.8915 | 0.0070 | no (expected limitation) |

## Later: the exact sign test

The spike includes a minimal two-sided `signTest(x, m0)`. It computes the p-value with exact integer arithmetic and returns `non-finite-data` or `all-ties` as typed failures. It has two exact reference cases. In the first, 8 observations above m₀, 2 below and 1 tie give p = 112/1024. In the second, 5 above and 0 below give p = 0.0625. For the later hypothesis-testing module:

- define the null median and require a continuous model
- drop ties and report how many were dropped
- support two-sided and one-sided tails
- compare p-values to exact binomial sums, and against `scipy.stats.binomtest` fixtures
- estimate power under a named alternative with R replicates and its Monte Carlo error, using the same predeclared-band method as above

## Assumptions and limits of the spike

- The spike's PRNG (mulberry32 with Box–Muller) is a stand-in. The engine owns the real versioned generator (#13, #14). The fixed-seed results above hold only for this spike.
- The quantile code works on the lower tail and uses symmetry, so it has no hidden range cap. One example is t₀.₉₉₉₇ with df = 1, about 1061. The tested cases agree to 1e-9 or better. For p within 1e-10 of 1, accuracy is limited by how precisely p itself is stored, at about 1e-6 relative. Production should use a vetted implementation, or pin its tolerance against SciPy fixtures from #13.
- Only the mean of Normal data is covered. Intervals for proportions, variance and differences of means come later and need their own applicability rules.
- *Assumption:* the course uses the n − 1 divisor for "sample variance". The lecture PDFs were not available (see `docs/functional-contract-draft.md` on `preview/discovery`), so the UI should name the divisor explicitly.

## Position

- **Estimators.** Ship the mean and both variance divisors, with the oracle table above as test truth. Show bias, variance and MSE side by side, so students see that σ̂² is biased but has the smaller MSE for Normal data.
- **Intervals.** Ship z (known σ, n ≥ 1) and t (unknown σ, n ≥ 2) first. Applicability failures are typed result codes, and model mismatch is a warning.
- **Coverage.** Validate every coverage claim against a predeclared exact binomial band, with fixed R and seeds.
- **Sign test.** Keep it for the hypothesis-testing iteration, along the path above.

I am least sure of two choices. One is the warn-versus-refuse choice for non-Normal data. The other is the 4-SE tolerance for the oracle checks. Both should be confirmed by the inference owner and by QA (#6).
