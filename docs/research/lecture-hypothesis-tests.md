# Lecture 12: critical regions, type I and II errors and power (research #47)

**Question.** Which kernel shows critical regions, type I and II errors and power for the z, t and F tests of lecture 12?

**Answer in one line.** The kernel `spikes/lecture-hypothesis-tests/kernel.mjs` serves three stations: Proportion, Mean and Variances. Each station has three views. View 0 shows the critical region on the null density, together with the alternative and β. View 1 shows the power curve: an exact theory curve, seeded Monte Carlo points and their 99.9% band. View 2 shows the simulated null distribution and the type I error. Every critical value is a computed quantile, and every power curve is exact.

Lecture references (L12 §…) point to the course lectures that the owner holds. They are not in this repository.

## What was built

| Piece | Where | Status |
| --- | --- | --- |
| Kernel: 3 stations × 3 views | `spikes/lecture-hypothesis-tests/kernel.mjs` | spike |
| 12 `node --test` checks against independent references | `spikes/lecture-hypothesis-tests/kernel.test.mjs` | green |
| Special functions | `spikes/lecture-hypothesis-tests/special.mjs`, a verbatim copy of #54 (PR #59, commit `5d0edf6`) | to be replaced by an import once #59 merges |

Run the checks with `node --test spikes/lecture-hypothesis-tests/kernel.test.mjs`. `crew check` does not cover `spikes/`.

### Stations and parameters

| Station | Test (L12 formula) | Parameters | Exact power used for the theory curve |
| --- | --- | --- | --- |
| `proportion` | U = (m/n − p₀)√n/√(p₀q₀), formula (2) | p₀, true p, n, α, H₁, R, view | Binomial sum over the critical region |
| `mean` | U = (x̄ − a₀)√n/σ (3) when σ is known; T = (x̄ − a₀)√n/s (5) when σ is unknown | σ known (0 or 1), true μ, n, α, H₁, R, view | z: Φ(u_cr − δ) in closed form. t: noncentral t, computed by one integral over the χ of s. |
| `variances` | F = s²/s², formula (6) | ρ = D(X)/D(Y), n₁, n₂, α, H₁, R, view | s²_X/s²_Y = ρ·F(k₁, k₂), exact |

- H₁ is coded as `tail`: 0 means two-sided (≠), 1 right (>), 2 left (<).
- The defaults of `proportion` are the L12 example (p₀ = 0.1, n = 50, α = 0.01, right-sided).
- `meta.params` points to the `mean` station.

### Series (ids are stable for tweens)

**View 0, critical region:**
- `null-pdf` (signal).
- `crit-left` and `crit-right`: accent bands under the null density, 61 points each.
- `alt-pdf`: the density under H₁. The Proportion station shows `null-pmf` and `alt-pmf` stems instead.
- `beta`: a muted band under the alternative over the acceptance region.
- `observed`: a rule at your sample's statistic.

**View 1, power:**
- `power-band`: the 99.9% Monte Carlo band.
- `power-theory`: the exact curve.
- `power-mc`: the simulated points.
- `alpha-line` and `true-value`.
- Mean also has `power-z`; Variances also has `power-lecture`.

**View 2, type I error:**
- `null-sim`: a histogram of the statistic simulated under H₀.
- `null-pdf` and the two critical bands.

**Stable shapes.** Both critical bands are always emitted. A side that H₁ does not use collapses to zero height at the axis edge, so the set of ids and the array lengths do not change with α, H₁ or the effect slider. A test checks this.

The Proportion chart uses the relative frequency m/n on a fixed [0, 1] axis, so its lengths depend only on n. The critical region is drawn as p₀ ± u_cr·√(p₀q₀/n).

## Facts

1. **Fact.** The critical value comes from a computed quantile, never from a table. The two-sided case puts α/2 in each tail. For an F test the left point is checked as 1/F(1 − α/2; k₂, k₁).
   - Implemented in `criticalRegion`.
   - Tested by round trips Φ(z) = p and F(z) = p, by F(1, k) = t²(k), and by the identity F_p(a, b) = 1/F_{1−p}(b, a).
2. **Fact (L12 example, checked).** n = 50, frequency 0.12, H₀: p = 0.1, α = 0.01, right-sided:
   - U = 0.02·√50/0.3 = 0.4714;
   - u_cr = Φ⁻¹(0.99) = 2.3263, where Φ₀(u_cr) = 0.49;
   - H₀ is kept.

   The lecture prints u_cr = 2.33, which is the table value rounded.
3. **Fact (the proportion test's real size).** U is discrete. For the L12 example the critical region is m ≥ 10, and P(m ≥ 10 | p = 0.1, n = 50) = **0.0245**, not α = 0.01.
   - Exact binomial sum, recomputed independently in the tests.
   - The Proportion station checks the simulated rejection rate under H₀ against this exact size and shows the nominal α beside it.
   - The lecture does not mention this.
4. **Fact.** For the z, t and F tests with normal data, the type I error equals α exactly. Seeded runs (R = 2000, n = 12, n₁ = 8, n₂ = 13) fall inside the predeclared 99.9% binomial band around α for every H₁. A 99.9% band still flags about 1 run in 1000 by chance: an independent sweep of 432 runs flagged one (Variances, n₁ = n₂ = 3, R = 200), and pooling 40 seeds there gave 0.0586 against an exact 0.0588. A flag on one run is therefore not proof of bias.
5. **Fact (t power).** The noncentral-t integral agrees with an independent Monte Carlo run within 4.5 standard errors.
   - The run had 40 000 replicates, n = 10, δ = 0.8σ√n, drew from its own LCG with Box–Muller, and used no kernel code.
   - At δ = 0 the integral returns α to a relative error below 10⁻⁶ for every n ≥ 2 and α ≥ 0.001 on the sliders.
   - The first version had a fixed 800-node Simpson grid. An independent check found that it gave 0.0018 instead of α = 0.001 at n = 2, where t_cr ≈ 318 and the integrand switches from 1 to 0 within Δw ≈ 0.003. The grid is now cut at the points where c·w/√k − δ runs over −9…9. A regression test covers n = 2, 3 and 5 at α = 0.001, 0.002 and 0.05.
6. **Fact (F test, two-sided).** "Larger s² over smaller, compared with F(1 − α/2; k_larger, k_smaller)" is the same test as the equal-tailed region on s²_X/s²_Y. Its size is exactly α, so the lecture's two-sided rule is correct.
7. **Fact (F test, one-sided: a lecture error).** For H₁: D(X) > D(Y) the lecture again takes "the ratio of the larger corrected variance to the smaller" and compares it with F_кр(α; k₁, k₂). That rule also rejects when s²_Y is the larger one.
   - Its size is P(F(k₁, k₂) > F_{1−α}(k₁, k₂)) + P(F(k₂, k₁) > F_{1−α}(k₂, k₁)) = **2α**.
   - Exact by `fPower(…, { lectureRule: true })`.
   - The seeded run with R = 4000 falls in the band around 2α.
   - The correct one-sided statistic is s²_X/s²_Y in the order H₁ names, with df (n_X − 1, n_Y − 1).
8. **Fact (randomness).** All randomness comes from `fixtureUint32(seed, stream, index, 0x4712)` (`spikes/simulation-engine/engine.mjs`), and normal draws are Φ⁻¹(u). A test checks that the same seed and parameters give byte-identical JSON.
9. **Fact (common random numbers).** Each power curve reuses one set of draws for every point on its grid: a shift for z and t, a scale for F, and a uniform threshold for p. The curve is then monotone where it should be, and neighbouring points are correlated. Each point's band is the exact Binomial(R, power) 99.9% acceptance region.
10. **Fact (cost).** Measured in Node on this machine, the average of 5 runs:

    | Run | Time |
    | --- | --- |
    | View 0 | 4–7 ms |
    | View 2 | 4–6 ms |
    | View 1 (power) | 20–40 ms at default R = 1000 |
    | View 1 at maximum parameters (R = 4000, n = 200) | 140–400 ms |

## Lecture errata (the lab shows the correct value and names the lecture's)

| L12 place | Lecture | Correct | Lab |
| --- | --- | --- | --- |
| Example, test for p | u_cr = 2.33 (table) | 2.3263 | Shows 2.326 and notes the table value |
| Example, test for p | The test is run at α = 0.01 | Its real size is 0.0245, because U is discrete | The type I error readout shows nominal α against the exact size |
| F test, one-sided H₁ | F = larger s² over smaller, against F_кр(α; k₁, k₂) | F = s²_X/s²_Y in the order of H₁. The lecture's rule has size 2α. | Uses the correct rule. A `lecture-rule` readout and the `power-lecture` curve show the 2α. |
| F test text | "критическую точку Fнабл(α; k₁; k₂)" | It is the critical point F_кр, not the observed value | Labels it F_cr |
| Φ convention | Ф(x) integrated from 0 (stated in L12) | Φ₀(x) = Φ(x) − 1/2 | Readouts name Φ₀ and give Φ₀(u_cr) = (1 − 2α)/2 for one-sided and (1 − α)/2 for two-sided |

**Also correct in the lecture:**
- the two-sided z and t rules;
- the one-sided z and t rules;
- the df k = n − 1;
- the two-sided F rule;
- the definitions of type I error, type II error and power.

## Assumptions

- **Assumption.** The Mean station fixes a₀ = 0 and σ = 1, and the Variances station fixes D(Y) = 1. The picture depends only on (μ − a₀)/σ and on ρ, so one slider each is enough. A teacher who wants the lecture's units would need two more sliders.
- **Assumption.** The map (`docs/research/lecture-module-map.md`, PR #48) has one "Hypothesis Testing" slot. I use three stations because each test has its own parameters; one shared `effect` slider with three meanings would be confusing. The host can put them under the one slot as tabs, or on three neighbouring slots on orbit IV. That is the owner's call.
- **Assumption.** `live` is not set on any station. View 0 alone is cheap (under 10 ms), but `live` is per station, and view 1 at maximum parameters takes up to 0.4 s. If the host gets per-view `live`, or moves power to the Worker runner (#55), view 0 can go live.
- **Assumption.** The alternative density in the t view is truncated to the window [min(−5, δ − 5), max(5, δ + 5)]. For very small n the noncentral t has a heavy right tail outside it: about 4% at n = 5, δ = 2.7, checked by simulation. The β and power values are exact regardless, because they come from the integral, not from the drawn curve.

## Position

- **Proposal.** Take `lecture-hypothesis-tests` as the kernel of the Hypothesis Testing slot:
  - three stations, each with views 0, 1 and 2;
  - `special.mjs` replaced by an import from `spikes/lecture-special-functions/special.mjs` (later the product module) once #59 merges.
- **Why.**
  - It meets all four acceptance criteria with exact references.
  - It teaches the two points students usually miss: a discrete test does not have size α, and a one-sided F test must keep the order of H₁.
  - Its output follows the contract, including stable ids for tweens.
- **Unsure about:**
  - whether the owner wants three stations or one station with a test selector;
  - whether the Proportion station should also offer the exact binomial test (size ≤ α) beside the lecture's normal-approximation test. That is an easy addition, but it is not in L12.
