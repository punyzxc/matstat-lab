# Shared special functions for the lecture kernels

**Fact — scope:** this answers [Discovery task #54](https://github.com/punyzxc/matstat-lab/issues/54). The question: which special functions should every lecture kernel import, and which fixtures should they be checked against? The kernels for #39, #41, #45, #46 and #47 need Φ, the normal, t, χ² and F quantiles, and the Kolmogorov distribution. The evidence is a throwaway module, [`spikes/lecture-special-functions/special.mjs`](../../spikes/lecture-special-functions/special.mjs). It is not product code.

**Fact — how the evidence was made:**

- [`generate_reference.py`](../../spikes/lecture-special-functions/generate_reference.py) writes [`reference.json`](../../spikes/lecture-special-functions/reference.json) from SciPy 1.18.1 (`scipy.stats`, `scipy.special`; NumPy 2.5.3, Python 3.13). It also computes each CDF a second time with mpmath 1.4.1 at 40 digits: the incomplete beta for t and F, the incomplete gamma for χ², the alternating series for Kolmogorov K, and `loggamma`. It evaluates the CDF at every SciPy quantile, so every recorded quantile is also checked by the second method. All 175 SciPy quantiles agree with mpmath to 10⁻⁹ in p. `python -I generate_reference.py --check` fails if any value drifts.
- [`special.test.mjs`](../../spikes/lecture-special-functions/special.test.mjs) has 7 `node:test` cases covering the four acceptance criteria, and they pass on Node 22.23.5.

## What the module exports

| Function | Meaning | Method in the spike | Reference |
|---|---|---|---|
| `normalCdf(x)`, `normalSf(x)` | Φ(x) = P(Z ≤ x), the CDF **from −∞** (L3, L6), and 1 − Φ(x) without cancellation | ½·erfc(∓x/√2), with erfc from the regularized incomplete gamma Q(½, x²) | [DLMF 7.2, 7.11](https://dlmf.nist.gov/7.11), [scipy.stats.norm](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.norm.html) |
| `laplacePhi0(x)` | Φ₀(x) = ∫₀ˣ φ = Φ(x) − ½, the Laplace function **from 0** (L12 tables); odd | ½·P(½, x²/2), computed directly, never as Φ(x) − ½ | same |
| `erf(x)` | erf(x) = 2/√π ∫₀ˣ e^(−t²) dt (L9) | P(½, x²) with sign | [DLMF 7.2.1](https://dlmf.nist.gov/7.2), [scipy.special.erf](https://docs.scipy.org/doc/scipy/reference/generated/scipy.special.erf.html) |
| `normalQuantile(p)` | z with Φ(z) = p | Acklam's approximation plus one Halley step (as in #13 and the #15 spike) | [scipy.stats.norm.ppf](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.norm.html) |
| `studentTCdf(t, ν)`, `studentTSf`, `studentTQuantile(p, ν)` | Student t, any real ν > 0 | I_{ν/(ν+t²)}(ν/2, ½)/2 for the tail. The quantile is closed form for ν = 1 and 2, otherwise inverted | [DLMF 8.17](https://dlmf.nist.gov/8.17), [NIST 1.3.6.6.4](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3664.htm) |
| `chiSquareCdf(x, ν)`, `chiSquareSf`, `chiSquareQuantile(p, ν)` | χ² with ν > 0 | P(ν/2, x/2) and Q(ν/2, x/2). The quantile is closed form for ν = 2, otherwise inverted | [DLMF 8.2](https://dlmf.nist.gov/8.2), [NIST 1.3.6.6.6](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3666.htm) |
| `fisherCdf(x, d₁, d₂)`, `fisherSf`, `fisherQuantile(p, d₁, d₂)` | Fisher F | I_{d₁x/(d₁x+d₂)}(d₁/2, d₂/2), with both arguments passed so 1 − y is never formed | [NIST 1.3.6.6.5](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3665.htm) |
| `logGamma(x)` | ln Γ(x), x > 0 | Lanczos (g = 7) with an exact log-factorial table for integers up to 171 | [DLMF 5](https://dlmf.nist.gov/5) |
| `kolmogorovK(λ)`, `kolmogorovSf(λ)`, `kolmogorovQuantile(α)` | K(λ) = lim P(√n·Dₙ ≤ λ) = 1 − 2Σ(−1)^{k−1}e^{−2k²λ²} | The alternating series for λ ≥ 1. The Jacobi form (√(2π)/λ)·Σe^{−(2k−1)²π²/(8λ²)} for λ < 1, where the alternating series cancels | [scipy.stats.kstwobign](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.kstwobign.html), Kolmogorov (1933) |

- **Fact — one name per convention:** the lectures use three different "Φ" functions: Φ from −∞ (L3, L6), Φ₀ from 0 (L12) and erf (L9). They are related by Φ(x) = ½ + Φ₀(x) = ½(1 + erf(x/√2)), and the test checks both identities to 10⁻¹⁵. A kernel that reads Φ₀ from a table but calls a CDF from −∞ is off by exactly ½. **Assumption:** separate, explicit names are the cheapest guard against that mistake. #39's criterion that every readout "names the function used" can then be the function's own name.
- **Fact — quantile inversion:** for t (ν > 2), χ² (ν ≠ 2), F and K, the quantile is found by bracketing and then bisecting to the last representable bit. It runs on the lower CDF for p ≤ ½ and on the upper SF for p > ½, so p = 1 − 10⁻⁶ does not lose six digits to 1 − p. Bisection is slow but monotone and has no failure modes. On a 4-vCPU Xeon at 2.1 GHz a χ² or F quantile costs about 20 µs, which is enough for interactive lecture stations.
- **Fact — the ν = 1 trap:** the textbook Cauchy quantile tan(π(p − ½)) loses accuracy for small p, because p − ½ is rounded at the scale of ½. The spike's first version had a relative error of 1.5×10⁻¹¹ at p = 10⁻⁶. Rewriting it as −1/tan(πp) brings it to 10⁻¹⁵. The `studentTQuantile` in the [#15 spike](../../spikes/inference-methods/inference.mjs) shows the same 2.9×10⁻¹¹ at that point. That is still well inside this task's 10⁻⁶ limit, so it is a precision note, not a bug.
- **Fact — typed errors:** p outside (0, 1), ν ≤ 0, non-finite degrees of freedom, NaN or a non-number throw `SpecialFunctionError` with code `PROBABILITY_OUT_OF_RANGE`, `INVALID_DF` or `INVALID_ARGUMENT`. They never return NaN. The test checks 15 such inputs. Infinite x is a valid limit: Φ(±∞), χ²(∞) and K(∞) return 0 or 1.
- **Fact — purity:** the module has no imports, no DOM access, no randomness and no global state, and the test checks its source for these. Any kernel or Worker can import it.

## Fixtures and results

**Fact — documented domain, all inside the fixtures:**

- p ∈ {10⁻⁶, 10⁻³, 0.025, 0.5, 0.975, 0.999, 1 − 10⁻⁶}
- ν ∈ {1, 2, 3, 5, 10, 21, 30, 100, 1000} for t and χ²
- (d₁, d₂) ∈ {(1, 1), (1, 2), (2, 1), (3, 10), (5, 20), (10, 100), (30, 30)} for F
- x from −30 to 8 for the normal family
- λ from 0.2 to 3 for Kolmogorov
- log-gamma from 10⁻⁸ to 10⁶

| Check | Acceptance limit | Worst observed | Oracle |
|---|---|---|---|
| CDFs: Φ, Φ₀, erf, t, χ², F, K | 10⁻⁷ absolute | **3.8×10⁻¹⁵** | SciPy, and mpmath as a second method |
| Quantiles: z, t, χ², F, K⁻¹, including p = 10⁻⁶ and 1 − 10⁻⁶, ν = 1, 2 | 10⁻⁶ relative | **5.6×10⁻¹⁵** | SciPy, each value cross-checked by mpmath |
| log-gamma | 10⁻⁶ relative | within the same bound | mpmath |
| Round trip t: quantile then CDF, for ν = 1, 2, 5, 30 | — | below 10⁻¹² relative in p | self-consistency |

**Assumption — tolerances:** the issue's limits (10⁻⁷ and 10⁻⁶) suit lecture tables printed to 3 or 4 digits. The spike stays about eight orders of magnitude inside them. Product tests could tighten them to 10⁻¹² for CDFs and 10⁻¹⁰ for quantiles, matching the comparator tiers proposed in [statistical-engine.md](statistical-engine.md) (PR for #13), without changing the algorithms.

**Fact — lecture values reproduced:** at the lecture's own precision:

- χ²₀.₉₇₅(21) = 35.479 (35.47887…)
- χ²₀.₀₂₅(21) = 10.283 (10.28290…)
- t₀.₉₇₅(21) = 2.0796 (2.079614…)
- z₀.₉₉ = 2.3263 (2.326348…)
- K(1.36) = 0.95 (0.950514…)

The inverse also holds: K⁻¹(0.95) = 1.3581, which rounds to the familiar 1.36.

## Position

**Assumption — what I propose:**

1. One shared module with exactly these names. Kernels import it and never write their own Φ. Every readout names its convention: `normalCdf`, `laplacePhi0` or `erf`.
2. Use the numerical core shared with #13: Loader-style prefactors in the incomplete gamma and beta, and p and q passed separately. The upper-tail functions (`*Sf`) are exported, so kernels can compute p-values without 1 − CDF cancellation.
3. Use bisection for quantiles now, and closed forms where they exist (t with ν = 1, 2; χ² with ν = 2). A faster Newton step can come later if profiling on classroom devices asks for it. The tests above stay as they are.
4. The fixtures in `reference.json` become the acceptance fixtures for the product module. Use SciPy for values and conventions, and mpmath as the second method.

**What I am unsure of:**

- Whether the Kolmogorov readouts in the lectures need the finite-n distribution of Dₙ (`scipy.stats.kstwo`) as well as the limiting K(λ). For small n they differ noticeably. This spike covers only the limit, as the issue asks.
- Whether the lectures ever use Φ₀ tables for negative x without the odd symmetry.
- Speed on phones was not measured.
