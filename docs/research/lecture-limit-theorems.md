# Limit theorems kernel (L6–L9), issue #41

**Question.** Which kernel shows uniform-sum convolution, Chebyshev bounds against real tails, Cauchy non-convergence and the CLT (lectures 6 to 9)?

**Answer.** `spikes/lecture-limit-theorems/kernel.mjs`, one kernel for three stations of orbit III:

| Station | Lectures | What the student sees |
| --- | --- | --- |
| `convolution` (Convolution) | L6 §Sums and convolution | m = 1…6 uniforms. Seeded histogram of the sums, the exact Irwin–Hall density (L6's piecewise formulas) and the normal with the same mean and variance, on a fixed 0…6 axis. Live while the slider moves. |
| `lln` (Chebyshev & LLN, new station) | L7 §Chebyshev inequality, LLN theorems, Cauchy example | View 0: five running means on a log₁₀ n axis inside MX ± 3σ/√n; for Cauchy no band, they keep jumping. View 1: exact P(\|X − MX\| ≥ kσ) against 1/k² for k = 0.5…4, with a simulated check at the chosen k. |
| `clt` (CLT) | L8 §Lindeberg–Lévy, Poisson lemma; L9 | View 0: histogram of (Sₙ − n·MX)/(σ√n) against N(0, 1). View 1: Kolmogorov distance to Φ for n = 1…100 with the Monte Carlo noise floor. View 2: Σₖ≤ₙ nᵏe⁻ⁿ/k! for n = 1…200 against 1/2. |

The existing **Convergence** station stays the prototype instrument (it carries the sample-record and preview tests); the Chebyshev and Cauchy material went to the new `lln` station instead of rewriting it.

## Findings

- **Fact.** The m = 2 and m = 3 densities in L6 (triangle; x²/2, 1 − (x − 1)²/2 − (2 − x)²/2, (3 − x)²/2) equal the Irwin–Hall density to 1e-12 (test AC1). The m = 4 density equals the numerical convolution of m = 3 with U(0, 1).
- **Fact.** Exact tails at k = 3: normal 2(1 − Φ(3)) = 0.0026998; Poisson(1) P(X ≥ 4) = 1 − e⁻¹(1 + 1 + ½ + ⅙) = 0.018988. Both are far under 1/9 = 0.111. Uniform: max(0, 1 − k/√3); exponential(1): e^−(1+k) + (k < 1 ? 1 − e^−(1−k) : 0).
- **Fact.** The mean of n standard Cauchy draws is standard Cauchy (checked: n = 400, R = 4000, Kolmogorov distance inside the 99.9% band). So no band is drawn and the readout says the limit does not exist.
- **Fact.** Σₖ≤ₙ nᵏe⁻ⁿ/k! = P(Poisson(n) ≤ n) → 1/2 from above; the excess is about 2/(3√(2πn)) (Ramanujan): 0.5266 at n = 100, 0.5084 at n = 1000. Computed in log space, exact to double precision up to n = 10⁴.
- **Fact.** Standardized sums approach N(0, 1) at rate ~1/√n: for the exponential law the distance falls from 0.16 (n = 1) to about 0.014 (n = 100); Poisson(1) keeps lattice jumps of order 1/√n.
- **Lecture note (L7), to confirm against the PDF.** The Cauchy example checks Khinchin's theorem by asking whether the variances are bounded. In the usual statement Khinchin's theorem needs i.i.d. terms with a finite mean only; bounded variances are Chebyshev's condition. The conclusion (no LLN for Cauchy) holds either way, because the mean itself does not exist, and the station's note says exactly that.

## Bands (predeclared)

- Kolmogorov distance of R draws from the true law: λ/√R with K(λ) = 0.999, λ = 1.9495 (from `lecture-special-functions`, #54).
- Simulated tail at k: ± 4 binomial standard errors, R = 20 000.
- Running means: MX ± 3σ/√n is a picture, not a test; the tests check only the final point.

## Coordination

Seeds and streams: every draw comes from `fixtureUint32(seed, stream, index)`; streams 100+ (convolution), 300+ (running means), 500+ (CLT), 900 (tail check). #33 (convergence fixtures) can reuse these. Special functions are imported from `spikes/lecture-special-functions/special.mjs` (#54), not copied.

## Position

Ship the three stations as above. Unsure: whether the owner wants the prototype Convergence station retired in favour of `lln` (it would free a slot in orbit III and remove duplication). That is a placement choice for the owner.
