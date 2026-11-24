# Sampling and goodness of fit (L10, L12)

Research for `lecture-sampling-goodness-of-fit` (#45). Owner: punyzxc (Claude executor). Date: 2026-11-24.

**Question.** Which kernel builds the variation series, histogram, ECDF, Kolmogorov and Pearson tests with correct degrees of freedom (lectures 10 and 12)?

**Answer.** `spikes/lecture-sampling-goodness-of-fit/kernel.mjs`. It follows the shared kernel contract (`docs/research/lecture-module-map.md`, PR #48). It serves the two stations that the scene host (#49) already registers, **Sample** and **Fit**. Its special functions are in `special.mjs`, under the names agreed for #54. 18 `node --test` checks pass. All of them use independent references.

## Sources

- **Fact.** Lectures 10 and 12 of the course (PDFs held by the owner, not committed). The sections are L10 §Sample, variation series (119), Tables 10–11, histogram, ECDF (120), Kolmogorov test, Pearson χ² with examples 1–2, and L12 §Pearson for the normal, uniform and exponential laws, §Kolmogorov, §Skewness and kurtosis.
- **Fact.** The exact finite-n law of Dₙ follows Marsaglia, Tsang & Wang, "Evaluating Kolmogorov's distribution", *J. Stat. Software* 8(18), 2003. The kernel test checks it against the closed form P(D₁ < d) = 2d − 1 and against a 20 000-run Monte Carlo for n = 10.
- **Fact.** The kernel contract and the host are `spikes/visual-foundation/src/stations/kernel-contract.ts`, `chart.tsx` and `catalog.ts` on the #37 branch (PR #49).
- **Fact.** Randomness comes from `fixtureUint32` in `spikes/simulation-engine/engine.mjs`, namespace `0x45`. Stream 0 is the shown sample. Streams 1…R are the Monte Carlo replicates.

## What the kernel does

| Station | Parameters | Chart | Readouts |
| --- | --- | --- | --- |
| **Sample** (L10) | law (0 normal, 1 uniform, 2 exponential), n, k (0 means 5·lg n), rounding to d decimals (makes ties), view (histogram or ECDF) | histogram Hᵣ = Wᵣ/h over the theoretical density, or Fₙ over F | Σ mᵣ against n, k against 5·lg n, histogram area against 1, range, distinct values, x̄, s² (n − 1), ECDF convention |
| **Fit** (L10, L12) | true law, H₀ law, n, α, Pearson intervals s, estimate parameters (0 or 1), merge cells with expected count below 5 (0 or 1), Monte Carlo replicates | Fₙ, the stepped band Fₙ ± λₙ(α), F of H₀, a marker where Dₙ is attained | D⁺, D⁻, Dₙ against the exact λₙ(α), √n·Dₙ against λ with K(λ) = 1 − α, exact and asymptotic p-values, χ² against χ²₁₋α(k), k = s − 1 − r, p-value, cells with expected count below 5, skewness and excess kurtosis (L12 (5)–(6)) with standard errors, false-rejection rates of both tests under H₀ with the band α ± 3σ |

All three laws have mean 1 and variance 1: N(1, 1), U(1 − √3, 1 + √3) and Exp(1). A test that tells them apart therefore reacts to shape, not to location or scale. **Assumption:** this makes the best teaching default, and the owner may prefer the lecture's own parameters instead.

Notes in the panel give the variation series (the first 12 values), the full interval table (Table 11), the df rule and every warning.

Checked by hand in the #49 host: both stations open in the scene dock with the chart, the readouts and the notes. Each run takes about 50 ms with the default 300 replicates. The Monte Carlo work is capped at n·R ≤ 300 000 so that sliders stay interactive.

## Acceptance criteria and evidence

| Criterion | How it is met | Test |
| --- | --- | --- |
| Counts sum to n, the histogram integrates to 1, k ≈ 5·lg n (adjustable) | Equal intervals [eᵣ, eᵣ₊₁). The last one is closed so that x_max is counted. Hᵣ = Wᵣ/h. | `AC1` for n ∈ {10, 50, 100, 730, 1000}, all laws, and k = 23 |
| The ECDF convention is stated and agrees with exact steps on ties | Fₙ(x) = #{xᵢ ≤ x}/n, emitted at its jump points. A tie of multiplicity m gives one step of m/n. | `AC2`: a hand-made sample and a rounded sample of 200 checked by brute force |
| Dₙ uses D⁺ and D⁻, √n·Dₙ is compared with K(λ), the band Fₙ ± λₙ(α) is emitted | L12 formulas. λₙ(α) is the exact critical value (Stephens' start, then secant steps on the exact law). | `AC3`: both directions dominate in turn, the brute-force supremum is matched, the band equals Fₙ ± λₙ clamped to [0, 1] |
| df = s − 1 − r, a warning below 5, Monte Carlo false-rejection rate within its band | L12 procedure (below). The band is predeclared as α ± 3·√(α(1 − α)/R). | `AC4`: R = 1000, n = 200, α = 0.05. Pearson and Kolmogorov fully specified, all three laws; Pearson with estimated parameters for the normal and exponential laws, all within [0.029, 0.071] |

The special functions are tested against closed forms: erf(1), χ²(1) = Z², χ²(2) quantile −2 ln(1 − p), the χ²(4) CDF, agreement of the two series for K(λ), and the n → ∞ limit of the exact law.

## Pearson procedure (L12) and what the simulation showed

- **Fact (L12).** The test uses s equal intervals between x_min and x_max. The parameters are estimated from the grouped sample, taking interval midpoints. The degrees of freedom are k = s − 1 − r, with r = 2 for the normal law (x̄, σ), r = 2 for the uniform law (a\* = x̄ − √3σ, b\* = x̄ + √3σ) and r = 1 for the exponential law (λ\* = 1/x̄).
- **Choice.** The outer cells are open to −∞ and +∞, so that Σ pᵢ = 1. L12's uniform formulas do the same with a\* and b\*. Otherwise, mass outside [x_min, x_max] would be lost.
- **Choice.** By default, neighbouring cells are merged until every expected count is at least 5, and s is the number of cells after merging. With merging off, the kernel reports the cells below 5 as a warning.
- **Fact (simulation, this kernel).** False-rejection rates at α = 0.05 with estimated parameters and s = 10:

| n | R | Normal | Uniform | Exponential |
| --- | --- | --- | --- | --- |
| 100 | 3000 | 0.059 | 0.084 | 0.047 |
| 200 | 1500 | 0.051 | 0.115 | 0.051 |
| 1000 | 300 | 0.060 | 0.123 | 0.110 |

  The L12 recipe holds α well for the normal and exponential laws at n ≈ 100–200. It drifts upwards as n grows, because the midpoint estimates carry a grouping bias that does not vanish when n grows while s stays fixed. For the uniform law it is anti-conservative at every n: a and b are endpoints of the support, so the usual asymptotics with k = s − 3 do not apply. A test pins the uniform case so that this document stays honest.
- **Fact (simulation).** The Kolmogorov test with parameters estimated from the same sample rejects almost never: 0.000 for the normal law and about 0.005 for the exponential law, against α = 0.05. This is why L10 and L12 require a fully specified F. The kernel withholds the Kolmogorov p-value in that mode, and the Monte Carlo readout shows the effect.

## Lecture errata and pins

"Mathematically correct" outranks "matches the lecture". Every number below was recomputed in `kernel.test.mjs`.

| Where | Lecture says | Correct | Lab behaviour |
| --- | --- | --- | --- |
| L10 §Pearson, df | k = (number of intervals) − 1, minus one per estimated parameter. Example 2 then uses n = 16 for both the sample size and the number of intervals. | k = s − 1 − r (L12), where s is the number of cells and does not depend on the sample size | Use s − 1 − r and show the arithmetic in the readout |
| L10 example 2, χ² critical value | χ² = 23.7 for 14 df at p = 0.95 | 23.685: correct to 3 significant figures. This is the only χ² quantile quoted in L10–L12. | Exact quantiles are computed and never read from a table |
| L10 example 2, statistic | χ²₀ = 16 · 0.0829 = 1.326 | The first summand is (F(5) − W₁)²/F(5) = 0.0174. It compares a **cumulative** probability with an **interval** frequency, so it is not Pearson's statistic, and the later summands cannot be reproduced from Tables 12–13. With interval probabilities, an open last cell and the lecture's own frequencies, χ² = 2.962 (df 14). | Not applicable anyway: every expected count is between 0.15 and 3.1, far below 5, and L10 itself asks for n > 50 |
| L10 example 2, Table 13 | Frequencies Wᵢ with x̄ = Σ τᵢWᵢ = 23.3 | Σ Wᵢ = 0.91: the mass beyond 80 min is dropped, so 23.3 is not a mean. Several Wᵢ also differ from the increments of Table 12 (at 30 min: 0.082 against 0.052). | Means are computed from normalised frequencies |
| L10 example 1, Table 12 | An empirical F for n = 16 observations | The table decreases (0.78 at 50 min, 0.72 at 55 min), and its values are not multiples of 1/16, so it cannot be the ECDF of 16 observations. Dₙ = 0.088 is attained exactly at that suspicious point. If 0.72 is a typo for 0.82, then Dₙ = 0.051 at 40 min. | The lab builds Fₙ from real samples only |
| L10 example 1, decision | z₀ = 0.352, "α₀ ≈ 0.999 > 0.2, accept" | 1 − K(0.352) = 0.9997, consistent with the lecture's table. The "accept if α₀ > 0.2" rule is the lecture's own. The lab uses a chosen α (default 0.05) and the exact finite-n law. | Show the exact and the asymptotic p-value side by side |
| L12 §Kolmogorov, λₙ(α) | λₙ(α) ≈ z/√(2n) − 1/(6n) (the extracted text is garbled) | **Assumption:** the intended formula is Bolshev's √(z/(2n)) − 1/(6n) with K(√(z/2)) = 1 − α, which equals λ/√n − 1/(6n). The kernel shows the exact λₙ(α) and the plain asymptotic λ/√n. | Exact critical value, with the asymptotic value in the readout note |
| L12 uniform | a\* = x̄ − √3·σ, b\* = x̄ + √3·σ, k = s − 3 | The formulas are right. With them, the test's real level is about 0.08–0.12 at α = 0.05 (above). | Shown by the false-rejection readout, not hidden |
| L12 exponential | "n′ᵢ = nᵢpᵢ" | n′ᵢ = n·pᵢ (typo) | n·pᵢ |
| L10 ECDF | Counts values "not exceeding x" (≤), yet calls Fₙ left-continuous (L5 defines F(x) = P(ξ < x)) | The two definitions differ at the jumps | Fₙ(x) = #{xᵢ ≤ x}/n, stated in the readout. The decision stays open (module map, decision 1). |

## Position

- Use this kernel for the **Sample** and **Fit** stations as it is. It needs no host changes: `catalog.ts` in #49 already points both stations at it.
- Keep three things visible in the station rather than hidden: the df arithmetic, the expected-count warning, and the Monte Carlo false-rejection rate. Together they let a student see when a textbook procedure stops meaning what it says (the uniform law, estimated parameters in the Kolmogorov test).
- When #54 lands, replace `./special.mjs` with `../lecture-special-functions/special.mjs`. The names match, so only the import path changes. Any differences in accuracy will show in this kernel's tests.
- **Unsure:**
  - Whether to offer a better estimator for Pearson (maximum likelihood on the grouped data, or the raw-sample MLE with a Chernoff–Lehmann note) alongside L12's midpoint recipe.
  - Whether the default laws should use the lecture's parameters rather than mean 1, variance 1.
  - The ECDF convention, which is the owner's decision.
