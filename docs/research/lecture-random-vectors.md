# Lecture random vectors: Moments, Transform, Scatter

Research for `lecture-random-vectors` (#44). Owner: punyzxc (Claude executor). Date: 2026-11-24.

**Question.** Which kernel shows moments, the 3σ rule, functions of a random variable, correlation and regression lines (lectures 5 and 6), and how does it appear in the Orbital laboratory scene?

**Deliverables.**
- `spikes/lecture-random-vectors/kernel.mjs`: one kernel for the stations Moments, Transform and Scatter (station ids from the scene catalog in #49).
- `spikes/lecture-random-vectors/kernel.test.mjs`: `node --test`, 14 tests, references recomputed from first principles.
- Additive host work in `spikes/visual-foundation/src/stations/` (stacked on the #49 branch): a rotatable 3D joint-density surface and live morphing of the charts while a slider moves.

## Sources

- **Fact.** Lectures 5 and 6 of the course ("Лекция 5", "Лекция 6") are held by the owner and are not committed to this public repository. References like "L6 (44)" are the lecture's formula numbers.
- **Fact.** The kernel contract is the one in `docs/research/lecture-module-map.md` (#36, PR #48) and `spikes/visual-foundation/src/stations/kernel-contract.ts` (#37, PR #49).
- **Fact.** All randomness comes from `fixtureUint32(seed, stream, index)` in `spikes/simulation-engine/engine.mjs`. Each draw has fixed indices, so one point never shifts another: Box–Muller uses `(stream, i)` and `(stream + 1, i)`; the disc uses r = √u, θ = 2πu′ (no rejection); a lottery draw r uses indices r·64 + i.
- **Fact (owner, 2026-11-24, issue #44 comment).** The old static dotted 3D surface and bell-fan glyphs were removed as decoration. A surface is allowed only when it is computed from the chosen ρ and the sample, rotatable and animated by parameter changes. The density family may morph as a parameter slider moves.

## What each station shows

### Moments (L5 §Main laws, L6 §Expectation … kurtosis, §3σ rule)

- Display ranges and bin counts are fixed per law over the whole slider span, so moving σ or λ visibly changes the shape (a scale-only change with an auto-scaled axis would look identical). Draws outside the fixed range are counted in every readout and reported in a note.
- Six laws: Bernoulli(p), Binomial(m, p), Poisson(λ), Uniform[−σ√3, σ√3], Exponential(λ), Normal(0, σ).
- Readouts, theory next to sample: Mξ, Dξ, σ, median, mode, skewness Sk, excess kurtosis Ek, and P(|ξ − Mξ| < kσ) for k = 1…4.
- **Fact (tested).** The closed forms in the kernel agree with direct summation of the PMF and with Simpson quadrature of the density to 1e-6 or better, for all six laws. For the normal law Ek = 0 exactly.
- **Conventions, stated in every readout.**
  - s² uses divisor n − 1.
  - Sk = m₃/m₂^1.5 and Ek = m₄/m₂² − 3 use central moments with divisor n.
  - The sample median is the middle value (the mean of the two middle values for even n).
  - The median of a discrete law is the smallest x with F(x) ≥ 1/2. When F = 1/2 on a whole step, the readout says that every point of the step is a median.
  - Mode:
    - Binomial has two modes when (m + 1)p is an integer, and Poisson when λ is an integer. Both are shown.
    - The uniform law has no single mode; the readout says "every point of [−h, h]".
    - For a continuous sample, the mode is the centre of the tallest of 40 bins.
- The 3σ readouts are given for every law, not only the normal one. The note says the rule is a property of the normal law. For example, Exponential gives 0.9817 inside 3σ, and Uniform gives 1.
- **Bands (predeclared in the test).**
  - Mean: 4σ/√n.
  - Variance: 4√((μ₄ − σ⁴)/n).
  - Shares inside kσ: 4√(p(1 − p)/n).
  - Skewness and kurtosis: per-law absolute tolerances (largest: 1.5 for Ek of Exponential, whose sample kurtosis has a heavy tail).
  - At n = 20 000 all laws pass for 30 seeds in a separate sweep, not only for the test seed.

### Transform (L6 §Functions of one random argument, formula (44))

- φ is one of αx + b with ξ ~ N(0, σ), eˣ with ξ ~ N(0, σ), e^(−βx) with ξ ~ Exp(λ), or x² with ξ ~ Exp(λ).
- The density curve is formula (44): f_η(y) = f_ξ(φ⁻¹(y)) · |dφ⁻¹/dy|. The absolute value is what joins the lecture's (42) and (43) for increasing and decreasing φ. α < 0 is allowed. At α = 0 (the slider passes through it) η = b is a constant with no density: the station shows the atom P(η = b) = 1 and says that (44) needs a strictly monotone φ.
- x² is not monotone on ℝ. It is used only with Exp(λ), where the support x ≥ 0 makes it monotone. This is the one-branch case, and the note says so.
- **Fact (tested).**
  - Every transformed law has total mass 1, checked through the CDF. This is robust where f is unbounded at 0 (e^(−βξ) with λ < β, and ξ²).
  - f equals dF/dy at interior points.
  - ∫f over an interior interval equals the CDF difference to 1e-8.
- **Fact (tested).** The L6 example η = e^(−βξ), ξ ~ Exp(λ) gives F(y) = y^(λ/β) on [0, 1]. The derivation is P(e^(−βξ) < y) = P(ξ > −ln y/β) = e^(λ ln y/β). The lecture's result is correct.
- The comparison with the seeded histogram uses expected bin heights (F(b) − F(a))/width, which stay exact where f is unbounded.
- Readouts: the largest bin deviation in standard errors, counting only bins with an expected count ≥ 5 (as a maximum over up to 40 bins it stays below 4.0 in about 99 % of runs, Bonferroni); the Kolmogorov distance with the 95 % critical value 1.358/√n; and Mη.
- An unbounded curve is cut at 1.6 times the tallest bar, and the note says so.

### Scatter (L6 §Random vectors, covariance, correlation, regression lines (61)–(64), the lottery)

- **Bivariate normal.** σ(ξ) = 1, σ(η) = σ₂, and ρ ∈ [−0.95, 0.95]. The range stops short of ±1, where the density is singular.
  - Readouts: Cov, r with its 99 % Fisher-z band, the slopes of (63) and (64), the acute angle between them, and the share inside the dispersion ellipse with c = 2 (theory 1 − e⁻² = 0.8647).
  - The 2D chart shows the points, both theoretical lines, both sample lines and the ellipse. At ρ = 0, line (64) is vertical and is drawn as a vertical rule.
- **Fact (tested).** The sample lines (63) and (64) built from sample moments equal the least-squares fits from the normal equations. This is the exercise L6 leaves to the reader.
- **Fact (tested).** The angle formula tan θ = (1 − r²)σ₁σ₂ / (|r|(σ₁² + σ₂²)) matches the angle between the two fitted lines, and gives 90° at r = 0.
- **3D surface.** The theoretical f(x, y; ρ) and the sample's 2D histogram density are on the same 31 × 31 grid.
  - **Fact (tested).** Each integrates to 1 ± 0.01, and no cell with p > 0.001 deviates by more than 5 standard errors at n = 20 000.
  - Rotate it by drag or arrow keys. As ρ moves, the mesh morphs.
- **Uniform disc.** Cov = 0 and r ≈ 0, yet ξ and η are dependent. The kernel shows this with two numbers:
  - corr(ξ², η²) = −1/3. **Fact (tested):** this was derived by polar quadrature (E ξ² = 1/4, E ξ⁴ = 1/8, E ξ²η² = 1/24).
  - P(|ξ| > 0.75 and |η| > 0.75) = 0, while the product of the marginals is 0.0208.
- **Lottery (matching problem).** n cards are shuffled with a seeded Fisher–Yates shuffle, and the number of fixed points is counted.
  - **Fact (tested).** The exact law P(M = k) = (1/k!) Σⱼ₌₀ⁿ⁻ᵏ (−1)ʲ/j! matches brute-force enumeration of all n! permutations for n ≤ 7.
  - **Fact (tested).** Mean and variance are both exactly 1 for every n ≥ 2.
  - The simulated mean and variance stay within their bands: 3.5 standard errors, with the exact μ₄ for each n, plus 12/K for the χ²-shaped n = 2 case.

## Lecture errata (the lab shows the correct value and names the lecture's)

| Where | Lecture says | Correct | Lab behaviour |
| --- | --- | --- | --- |
| L6 §3σ rule | P(\|ξ − a\| < 3σ) = 1 − 2Φ(−3) = 1 − 0.00135 = 0.9973 | 1 − 2Φ(−3) = 1 − 0.0027 = 0.9973; 0.00135 is one tail | Note shows both tails |
| L6 Table 3, k = 1 and k = 2 | 0.6826 and 0.9544 | 0.68269 and 0.95450 (rounding, last digit) | Exact values in readouts |
| L6 Table 3, k = 4 | 0.9997 | 0.999937 | Exact value; note names 0.9997 |
| L6 Table 3, "%" column | 32 %, 5 %, 0.7 %, 0.07 % outside | 31.7 %, 4.6 %, 0.27 %, 0.0063 % | Note gives the correct shares |
| L6 lottery | "M + D = 1 + 1 = 2 prizes" | Mean plus variance mixes units; the usual allowance is M + σ. It is the same number only because D = σ = 1 | Note explains |

**Assumption.** The Table 3 entries were read from text extracted from the lecture PDF; the owner should confirm the 4σ entry and the "%" column against the printed page before the lab quotes them as the lecture's values.

All of these were checked with exact computation in the tests (erf by its convergent series, cross-checked against Simpson quadrature and 12-digit reference values).

Checked and correct:
- the moments of the six laws (L6);
- Ek = 0 for the normal law;
- formula (44) and the linear example;
- F(y) = y^(λ/β) for e^(−βξ);
- Cov = 0 for the uniform disc;
- (63)–(64) and "perpendicular lines ⇔ r = 0";
- M = D = 1 in the lottery.

## Host work (stacked on #49)

- **Additive contract fields.** These are optional and backward compatible:
  - `KernelResult.surface` = `{ x, y, z, zSample, labels, title }`;
  - `stations[id].live`, which asks the host to re-run the kernel on the draft parameters while a slider moves. The link (URL hash) still changes only on Run.
- **Live morph.** Series with the same id and length tween over about 280 ms. `prefers-reduced-motion` snaps instead.
- **Decision (assumption).** The coordinator agreed to a cheap `preview()` export, but live re-runs of the full kernel replaced it. A full run costs under about 20 ms at the default sizes (all 15 station/mode runs take 59 ms in Node). The morph then shows the real sample moving together with the theory, not only the theoretical curve.
- **Surface.** The surface is SVG, drawn in painter's order. Its projection and depth sorting live in a DOM-free module with its own `node --test` tests. Labelled x, y and z axes come from the kernel. It rotates by drag and by arrow keys, and has a reset button.

## Position

- Keep one kernel for the three L6 stations. They share the moment helpers and the seeded samplers, and the scene catalog already points all three at `lecture-random-vectors`.
- Treat the live run as the default for cheap kernels. Large-sample stations (CLT with many repetitions) should declare `live: false` and keep the Run button.
- In production, the parameter "law" or "experiment" should be a segmented control, not a numeric slider. The contract has only numeric sliders today. Proposal for #29 (snapshot fields): add an optional `options: [{ value, label }]` to `KernelParam`.
- **Unsure.**
  - Sample-kurtosis bands for heavy-tailed laws are wide at n = 20 000. A teaching readout may need a "noisy at this n" hint rather than a bare number.
  - The 31 × 31 grid is enough for ρ ≤ 0.95; a ridge sharper than that would need a finer grid.
