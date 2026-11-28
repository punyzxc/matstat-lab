# Distribution contracts: formulas, limits and reference fixtures

**Fact — scope:** this answers [Discovery task #13](https://github.com/GredesCerber/matstat-lab/issues/13) for the six models named in the [brief](../brief.md): Normal, Uniform, Exponential, Bernoulli, Binomial and Poisson. The evidence is a throwaway fixture in [`spikes/statistical-engine/`](../../spikes/statistical-engine/). It touches no product code, contract, protected configuration or visual work. It feeds the PRD tasks T6 (continuous models) and T8 (discrete models), the chart series in T11, and the classroom comparison in [#19](https://github.com/GredesCerber/matstat-lab/issues/19).

**Fact — how the evidence was made:**

- [`generate_reference.py`](../../spikes/statistical-engine/generate_reference.py) writes [`reference.json`](../../spikes/statistical-engine/reference.json) from SciPy 1.18.1 and NumPy 2.5.3 on Python 3.13. For the cases where Float64 libraries drift, it adds `highPrecision` values from mpmath 1.4.1 at 50 significant digits. `python -I generate_reference.py --check` fails if any recorded value changes.
- [`distributions.mjs`](../../spikes/statistical-engine/distributions.mjs) is an independent plain-JavaScript implementation of all six models. It uses Float64 only and has no dependencies. [`distributions.test.mjs`](../../spikes/statistical-engine/distributions.test.mjs) holds 7 `node:test` cases, one or more per acceptance criterion, and they pass on Node 22.23.5. `node measure.mjs` prints the worst deviation per model and quantity.
- 21 parameter cases, 85 evaluation points, 7 fixed uniforms per case for the samplers, and 2 fixed samples.

## The six models

All formulas are the standard ones. Each row links two independent references: the NIST/SEMATECH e-Handbook or the NIST DLMF, and the SciPy page that defines the oracle's parameterization.

| Model | Parameters and legal limits | Support | PMF or PDF | CDF | Mean, variance, skewness, excess kurtosis | References |
|---|---|---|---|---|---|---|
| Normal(μ, σ) | μ finite; σ finite and **> 0**. SciPy: `loc=μ, scale=σ` | ℝ | φ = exp(−z²/2)/(σ√(2π)), z = (x−μ)/σ | ½·erfc(−z/√2) | μ, σ², 0, 0 | [NIST 1.3.6.6.1](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm), [DLMF 7.2](https://dlmf.nist.gov/7.2), [scipy.stats.norm](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.norm.html) |
| Uniform(a, b) | a, b finite, **a < b**, and b − a finite. SciPy: `loc=a, scale=b−a` | [a, b], closed | 1/(b−a) on [a, b] | (x−a)/(b−a), clamped to [0, 1] | (a+b)/2, (b−a)²/12, 0, −6/5 | [NIST 1.3.6.6.2](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3662.htm), [scipy.stats.uniform](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.uniform.html) |
| Exponential(λ) | **rate** λ finite and > 0. SciPy uses `scale = 1/λ` | [0, ∞) | λe^(−λx) for x ≥ 0 | 1 − e^(−λx), computed as −expm1(−λx) | 1/λ, 1/λ², 2, 6 | [NIST 1.3.6.6.7](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3667.htm), [scipy.stats.expon](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.expon.html) |
| Bernoulli(p) | p in **[0, 1]**, endpoints allowed | {0, 1} | 1−p at 0, p at 1 | 0 for x < 0; 1−p on [0, 1); 1 from 1 | p, p(1−p), (1−2p)/√(p(1−p)), (1−6p(1−p))/(p(1−p)) | Binomial with n = 1 (row below), [scipy.stats.bernoulli](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bernoulli.html) |
| Binomial(n, p) | n a **non-negative safe integer**; p in [0, 1] | {0, …, n} | C(n,k) pᵏ(1−p)ⁿ⁻ᵏ | I₁₋ₚ(n−k, k+1), the regularized incomplete beta, at k = ⌊x⌋ | np, np(1−p), (1−2p)/√(np(1−p)), (1−6p(1−p))/(np(1−p)) | [NIST 1.3.6.6.18](https://www.itl.nist.gov/div898/handbook/eda/section3/eda366i.htm), [DLMF 8.17](https://dlmf.nist.gov/8.17), [scipy.stats.binom](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.binom.html) |
| Poisson(λ) | λ finite and **≥ 0** | {0, 1, 2, …} | e^(−λ)λᵏ/k! | Q(k+1, λ), the regularized upper incomplete gamma, at k = ⌊x⌋ | λ, λ, 1/√λ, 1/λ | [NIST 1.3.6.6.19](https://www.itl.nist.gov/div898/handbook/eda/section3/eda366j.htm), [DLMF 8.4](https://dlmf.nist.gov/8.4), [scipy.stats.poisson](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.poisson.html) |

- **Fact — parameter names matter:** SciPy's `expon` takes a scale, not a rate. `expon(scale=0.5)` is Exponential with rate 2, mean 0.5 and variance 0.25. The fixture records both the rate the UI shows and the scale SciPy received. This matches the [functional contract draft](../functional-contract-draft.md): rate, with an explicit conversion to scale.
- **Fact — degenerate laws are valid:** Bernoulli p = 0 or 1, Binomial n = 0 or p ∈ {0, 1}, and Poisson λ = 0 are exact point masses. Their PMF at the point is exactly 1, and their variance is exactly 0. The spike reproduces this bit-for-bit.
- **Fact — higher moments of degenerate laws are undefined, and SciPy says so inconsistently.** SciPy returns `nan` skewness for Bernoulli p = 0, `inf` for Poisson λ = 0, and an excess kurtosis of **−9.22×10¹⁸** for Binomial p = 0 or p = 1. The last value is an integer-overflow artifact, not a moment. **Assumption — proposal:** the engine returns `null` with `degenerate: true` for skewness and kurtosis whenever the variance is 0. It never copies SciPy's value. The test `AC1: discrete …` enforces this.
- **Assumption — rejected values:** σ = 0 for Normal, a = b for Uniform and λ = 0 for Exponential are rejected with `INVALID_PARAMETER`. SciPy also has no valid model there, because a zero scale gives `nan`. Non-finite parameters, non-integer n, and a Uniform with an overflowing width (for example −MAX_VALUE to MAX_VALUE) are rejected as well. The spike tests 10 such inputs.
- **Assumption — upper caps:** Binomial n and Poisson λ are tested up to 10⁶. Values beyond that are mathematically legal. A product cap (for example n ≤ 10⁹, λ ≤ 10⁹) belongs to the PRD together with the simulation draw caps from #14. No evidence here supports larger values.

## Samplers

**Assumption — recommendation:** use inversion, x = F⁻¹(u), for all six models, with one uniform per draw. Inversion is the general method in [Devroye, *Non-Uniform Random Variate Generation*, ch. II](http://luc.devroye.org/rnbookindex.html). One uniform per draw keeps every draw addressable by (seed, replicate, index), the stream design measured in [#14](simulation-engine.md). It also gives a shared, checkable definition. Rejection methods such as BTPE or PTRS consume a variable number of uniforms. That breaks index addressing and makes cross-library replay impossible to check.

- **Fact — the ppf convention:** the discrete inverse is the smallest integer k with F(k) ≥ u, as in SciPy's `ppf`. For Bernoulli this means X = 1 exactly when u > 1 − p, not when u < p. On 7 fixed uniforms (2⁻³³, 0.025, 0.25, 0.5, 0.75, 0.975, 1 − 2⁻³³) the spike reproduces every SciPy `ppf` value for all 21 cases. The discrete draws match as exact integers, including Binomial(10⁶, ½) and Poisson(10⁶). The continuous draws match within a relative 2.1×10⁻¹⁵.
- **Fact — the uniform grid bounds the tails:** with the 32-bit midpoint grid u = (k + ½)/2³² from #14, the smallest uniform is 2⁻³³. The largest Normal draw is then |z| = 6.3379577545537895, and the largest Exponential draw is 33·ln 2/λ = 22.873856958478196/λ. Both values are SciPy-checked. The Normal mass beyond 6.34σ is about 2.3×10⁻¹⁰, so this does not matter in class. It should still be documented, because the generator can never produce a 7σ draw. **Assumption:** a 53-bit uniform from two uint32 words would extend the Normal limit to about 8.3σ at the cost of two words per draw. This is a decision for the stream owner (#14).
- **Fact — precision near u = 1:** for u > ½, 1 − u is exact in Float64. The spike's Exponential sampler uses −log(1 − u) above ½ and −log1p(−u) below. The Uniform sampler uses b − (b−a)(1−u) above ½. Both match SciPy to about 1 ulp at 1 − 2⁻³³.
- **Fact — the Normal inverse:** the spike uses Acklam's rational approximation followed by one Halley step against the erfc-based CDF. Without the Halley step the error is 1.6×10⁻⁹ relative. With it, the error is at most 2.1×10⁻¹⁵ on the fixtures. **Assumption:** production can use Wichura's AS 241, which reaches about 10⁻¹⁶ without refinement. Either choice must be pinned by an engine version, because replay compares exact bits.
- **Fact — cost:** on a 4-vCPU Xeon at 2.1 GHz under Node 22, a draw costs about 0.1 µs for Exponential and Uniform, 1.1 µs for Normal, 0.6–1.3 µs for small discrete laws, 11 µs for Binomial(10⁶, ½) and 21 µs for Poisson(10⁶). In the discrete case the search starts at the normal-approximation guess and evaluates the CDF at each step. **Assumption:** 2×10⁶ draws at the worst rate take about 40 s, too slow for the classroom. For large parameters, the production sampler should precompute the CDF table once per run and use binary search over it. That keeps the same inversion definition.
- **Fact — a replay hazard:** when u falls within rounding distance of a CDF jump F(k), two correct libraries can return k and k+1. The closest case in the fixtures is Poisson(10⁶) at u = 1 − 2⁻³³: F(1006344) exceeds u by only 1.3×10⁻¹⁴. The spike still returned SciPy's integer, but an engine change at this kind of point can flip a draw. **Assumption:** replay promises exact integers only within one engine version. Cross-library fixtures check the margin |F(k) − u| and choose u where it is larger than the CDF tolerance tier below.

## Fixtures and tolerances

### Edge cases recorded

| Edge | Cases in `reference.json` | Expected behavior |
|---|---|---|
| Zero | Normal at x = 0 and μ = 0; Exponential at 0 and at −10⁻³⁰⁰; Bernoulli p = 0; Binomial n = 0 and p = 0; Poisson λ = 0 | PDF at 0 is λ for Exponential (closed support). CDF(0) = 0 exactly. Point masses are exact. |
| Support endpoints | Uniform at a, b and just outside (±10⁻¹²); Binomial at −1, 0, n, n+1; Poisson at −1, 0; Bernoulli at 0.5 | The Uniform density is 1/(b−a) at **both** endpoints, matching SciPy. Outside the support: density 0, CDF exactly 0 or 1. The CDF steps between integers and the PMF is 0 off-integer. |
| Singleton sample | `[3.5]` | Mean 3.5. Variance with divisor n is 0. Variance with divisor n−1 is **undefined**: NumPy returns `nan` with a warning. The histogram has one count, and the ECDF jumps from 0 to 1 at 3.5. |
| Ties | `[1, 2, 2, 3, 7]` with edges 0, 2, 4, 6 | Counts [1, 3, 0] plus 1 overflow. The ECDF at distinct values is [0.2, 0.6, 0.8, 1]. |
| Large parameters | Normal μ = 10⁶, σ = 10⁻³; Normal tails at ±8 and ±38; Uniform on ±10¹⁵⁰; Exponential λ = 10⁶; Binomial(10⁶, ½) and (10⁶, 10⁻⁶); Poisson(10⁶) | Finite, monotone, normalized; see the findings below. |

### What the measurements show

- **Fact — closed forms are at round-off:** the Uniform, Exponential, Normal PDF and all moments match SciPy to at most 3.6×10⁻¹⁵ relative, and most match exactly.
- **Fact — SciPy is not a safe oracle for large discrete parameters.** Against 50-digit mpmath, SciPy 1.18.1's `poisson.pmf` at λ = 10⁶ is off by up to **1.6×10⁻⁹** relative. Its `poisson.logpmf` and `binom.logpmf` at n = 10⁶ are off by up to 1.9×10⁻¹⁰. The spike's values on the same points are within 6.7×10⁻¹⁶. **Assumption:** reference values for large parameters come from a high-precision oracle such as mpmath, and SciPy remains the oracle for conventions and moderate parameters. Comparing against SciPy at λ = 10⁶ with a 10⁻¹² tolerance would fail a correct engine.
- **Fact — the naive log-gamma formula loses accuracy at large parameters.** The first version of the spike computed log C(n, k) through lgamma. Its errors were up to 2.2×10⁻⁹ in the Binomial and Poisson PMF at n, λ = 10⁶, because lgamma(10⁶) ≈ 1.3×10⁷ cancels. Rewriting the PMF and the incomplete-function prefactors with [Loader's saddle-point method](https://www.r-project.org/doc/reports/CLoader-dbinom-2002.pdf) (`stirlerr` plus `bd0`) brought the PMF to within 7×10⁻¹⁶ and the CDF to within 3.3×10⁻¹³ of mpmath. **Assumption:** the production engine should use Loader's form, which is also what R's `dbinom` and `dpois` are built on.
- **Fact — pass p and q separately.** For Binomial(10⁶, 10⁻⁶), computing 1 − (1 − p) inside the incomplete beta gave a CDF error of 1.4×10⁻¹¹. Passing both p and q fixed it to 1.5×10⁻¹⁶.
- **Fact — SciPy flushes deep tails to zero.** SciPy returns Φ(−38) = 0. The true value is 2.885×10⁻³¹⁶, a subnormal number, and the spike returns it. Relative tolerances are meaningless there. **Assumption:** fixtures below 10⁻³⁰⁰ use an absolute floor or compare `logcdf` instead.

### Proposed comparators

The comparator is |actual − expected| ≤ abs + rel·|expected|. The spike's tests use these tiers. **Assumption:** they are the starting point for T6/T8, tightened only with new evidence.

| Tier | rel | abs | Applies to | Worst observed |
|---|---|---|---|---|
| Closed form | 10⁻¹⁴ | 10⁻³⁰⁰ | Uniform, Exponential, Normal PDF, moments, histogram heights | 3.6×10⁻¹⁵ |
| Special function | 10⁻¹³ | 10⁻³⁰⁰ | erfc-based CDF and SF, incomplete beta and gamma at moderate parameters, continuous inverse CDF, large-parameter PMF against mpmath | 6.3×10⁻¹⁵ |
| Large-parameter CDF | 10⁻¹² | 10⁻³⁰⁰ | Binomial and Poisson CDF with n, λ ≥ 10⁴, against mpmath | 3.3×10⁻¹³ |
| Exact | 0 | 0 | every discrete draw, support bound, histogram count, overflow count, ECDF count, n, and degenerate point mass | exact |

- **Fact — exact integer requirements:** discrete draws are safe integers within the support. Histogram counts plus underflow plus overflow equal n. ECDF cumulative counts are integers, and probabilities are count/n. These are compared with `===`, never with a tolerance. This matches the draft's "exact integer vectors are checked first".

## Theory for charts: mass is not density

- **Fact:** a PMF value is a probability (unitless, at most 1). A PDF value is a density in units of 1/x and can exceed 1. For example, Normal σ = 10⁻³ has a peak density of 398.9 in the fixtures. The draft contract already tags them as `pmf` and `pdf`. The spike returns `measure: 'pmf' | 'pdf'` on every model.
- **Assumption — continuous histogram convention:** bins are half-open [eᵢ, eᵢ₊₁), the last bin is closed, and draws outside the edges are counted as underflow or overflow, never dropped. This is [`numpy.histogram`'s convention](https://numpy.org/doc/stable/reference/generated/numpy.histogram.html), so NumPy fixtures apply directly. The fixture checks that a draw on the final edge lands in the last bin. Height = count/(n·width), where n is the **total** sample size, including draws outside the edges. Overlaid on the PDF, the bars then integrate to the visible probability, not to 1.
- **Assumption — discrete histogram convention:** use unit-width bins centered on the integers, [k − ½, k + ½). With width 1, the density height equals the relative frequency count/n and is directly comparable to PMF(k). No integer draw can land on an edge, so the half-open rule never decides a discrete count. The chart should draw the PMF as stems or dots on the integers, not as a curve. An interpolated line between integers would suggest a density that does not exist.
- **Assumption — shared edges:** when two runs are compared (for example, two sample sizes in #19), both use the same edges. For continuous models, edges come from the model's own quantiles, for example F⁻¹(0.001) to F⁻¹(0.999), not from either sample. Theory then sets the frame, the visible probability is known in advance, and overflow is honest.
- **Fact — the ECDF convention:** the ECDF is the right-continuous step F̂(x) = #{xᵢ ≤ x}/n. It is listed at the distinct sorted values with their cumulative probabilities, as `scipy.stats.ecdf` does ([docs](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ecdf.html)). The spike's output equals SciPy's on the tie fixture. **Assumption:** the theoretical CDF is drawn as a continuous curve for continuous models and as a right-continuous step with jumps at the integers for discrete models, so that the ECDF and the CDF have the same shape and can be compared vertically.

## Position

**Assumption — what I propose for the PRD:**

1. Adopt the parameterizations and legal limits in the table above. Use rate for Exponential, σ for Normal, and closed [a, b] for Uniform. Degenerate discrete laws are valid; zero-scale continuous laws are not. Higher moments of degenerate laws are `null` with a flag.
2. Use inversion samplers with one uniform per draw and SciPy's `ppf` convention, versioned together with the RNG. For large discrete parameters, precompute the CDF table.
3. Compute the Binomial and Poisson PMF and the incomplete-function prefactors with Loader's `stirlerr`/`bd0`, and pass p and q separately.
4. Fixtures: SciPy for conventions and moderate parameters, mpmath for large parameters and deep tails. Use the comparator tiers above and exact equality for every integer.
5. Charts: density-normalized histograms against the PDF, unit-bin relative frequencies against PMF stems, a right-continuous ECDF against a CDF of matching shape, and edges shared across compared runs.

**What I am unsure of:** whether 32-bit uniforms are acceptable (tail cap at 6.34σ) or the stream should use 53 bits, which is #14's call. Product caps above 10⁶ for n and λ. Performance on classroom phones, which was not measured. Cross-browser bit-for-bit equality of `Math.log`, `Math.exp` and `Math.expm1`, which ECMAScript does not require to be correctly rounded. That last point matters for exact replay across browsers, and #14 observed differences up to 2.2×10⁻¹⁶ between Node and Chrome. It is a strong reason to keep exact replay per engine version and runtime, and tolerance-based replay everywhere else.
