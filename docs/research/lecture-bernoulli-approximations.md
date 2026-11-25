# Bernoulli scheme: exact law, de Moivre–Laplace and Poisson

This is the research for `lecture-bernoulli-approximations` ([#39](https://github.com/punyzxc/matstat-lab/issues/39)). Owner: GredesCerber (Claude executor). Date: 2026-11-25.

**Question.** Which kernel compares the exact binomial law with the local, integral and Poisson approximations and reports their errors (lectures 3 and 9)?

**Deliverables.**
- `spikes/lecture-bernoulli-approximations/kernel.mjs` and `kernel.test.mjs` (`node --test`, 9 tests, all passing).
- The kernel follows the shared contract in [`lecture-module-map.md`](lecture-module-map.md) and serves the catalog station `bernoulli` (`spikes/visual-foundation/src/stations/catalog.ts`, issue 39).
- A Russian dictionary for every text the kernel shows, `spikes/visual-foundation/i18n/ru/kernels/lecture-bernoulli-approximations.json`. The lab speaks Russian by default, and `npm test` in `spikes/visual-foundation` (58 tests) requires one for every kernel. Every label keeps its mathematics inside `$…$`.
- There is no UI code.

## Sources

- **Fact.** The lectures are `lectures/L03.pdf` (§Bernoulli scheme, formulas 11–20 and the examples) and `lectures/L09.pdf` (the three de Moivre–Laplace examples). Both are on the `course-lectures` branch, commit `8dfee73`, and the text was extracted with pypdf. The PDFs are not copied to `main`.
- **Fact.** Formulas: Bernoulli (11), most probable number (13), local theorem (15), integral theorem (17), Poisson (18), frequency deviation (20). These are the standard results in Feller, *An Introduction to Probability Theory and Its Applications*, vol. 1, ch. VI §§2–6 and ch. VII.
- **Fact.** Numerical core, reused rather than rewritten:
  - The PMF uses `logBinomialRaw` and `logPoissonRaw` (Loader's saddle point) from [`statistical-engine.md`](statistical-engine.md).
  - Φ, Φ₀, erf and the normal quantile come from [`lecture-special-functions.md`](lecture-special-functions.md).
  - Randomness comes from `fixtureUint32` (stream 0, one uniform per repetition).
- **Fact.** Independent reference in the tests: exact rational sums with `BigInt`. P(k₁ ≤ k ≤ k₂) is computed as Σ C(n,k)·aᵏ(b−a)ⁿ⁻ᵏ / bⁿ for p = a/b, scaled by 10⁴⁰ before conversion. It shares no code with the kernel.

## What the kernel shows

There is one station, `bernoulli`, with two views.

| View | Input | Readouts (each with `convention`) | Chart |
| --- | --- | --- | --- |
| 1 Approximations | n ≤ 10⁴, p, interval [k₁, k₂], R repetitions; or one of 7 lecture examples | Exact P_n(k) and P(k₁ ≤ k ≤ k₂). Local φ(x)/√npq. Integral Φ(b) − Φ(a), with and without continuity correction. Poisson, point and interval. k₀ by formula (13). Each approximation carries `error` = \|approximation − exact\|. Exact values also show the simulated frequency and a ±4σ band. | Exact PMF (`pmf`), simulated frequencies (`hist`), local normal curve (`line`), Poisson (`points`), k₁ and k₂ markers (`rule`). |
| 2 Sample size | ε, γ, p | z = Φ⁻¹((1+γ)/2). n from formula (20). n from Chebyshev, pq/((1−γ)ε²). For the L3 preset, the lecture's table value as well. | n against γ for both methods, and a marker at the chosen γ. |

- **Fact — log space:** the PMF is exp(log P_n(k)), with the log taken from Loader's form, so no binomial coefficient is formed. Summed smallest terms first, it equals 1 within 10⁻¹² for every n in {1, 2, 10, 137, 1000, 5000, 10000} and every p in {0, 0.001, 0.01, 0.3, 0.5, 0.75, 0.999, 1}. The test checks all 56 combinations. A full PMF for n = 10⁴ takes about 0.6 ms, so the station can recompute it live.
- **Fact — most probable number:** p is read as an exact decimal with at most 6 digits. Whether (n+1)p is an integer is then decided in integers, never by float comparison. The two-mode case returns both modes, (n+1)p − 1 and (n+1)p. The test compares formula (13) with the argmax of the exact PMF in 11 cases, including L3 ex. 1, where (n+1)p = 6 gives the two modes 5 and 6.
- **Fact — simulation:** each repetition draws one count by inversion on the exact CDF, using one uniform. Every simulated frequency has a band of exact ± 4·√(P(1−P)/R), clipped to [0, 1]. The band is omitted when R·P(1−P) < 9, the same rule as `lecture-conditional-bayes`. The test checks every band on 5 fixed seeds and 7 examples with R = 4000.
- **Assumption:** in a single-value example (k₁ = k₂) the plain integral formula gives Φ(x) − Φ(x) = 0. The kernel shows this rather than hiding it, because it is the clearest argument for the continuity correction.

## Lecture values against the exact law

All exact values are BigInt-checked in the tests.

| Example | n, p, event | Lecture | Exact | Approximations (absolute error) |
| --- | --- | --- | --- | --- |
| L3 ex. 1 | 7, ¾, k = 5 | 0.311 | 0.31146 | Local 0.3400 (0.029). Integral with correction 0.3300 (0.019). |
| L3 ex. 2a | 5000, 0.01, k = 50 | **0.0572** (exact), 0.057 (local) | **0.05661** | Local 0.05670 (9.4×10⁻⁵). Poisson 0.05633 (2.8×10⁻⁴). |
| L3 ex. 2b | 5000, 0.01, 0 ≤ k ≤ 50 | **0.5033** (exact), 0.5 (integral) | **0.53752** | Integral 0.5000 (0.0375). With correction 0.5283 (0.0092). Poisson 0.53752 (4.7×10⁻⁷). |
| L3 typos | 100, 0.001, k ≥ 1 | 0.0952 (Poisson) | 0.09521 | Poisson 0.09516 (4.5×10⁻⁵). |
| L9 defects | 50, 0.2, 6 ≤ k ≤ 50 | 0.92135 | **0.95197** | Integral 0.92135 (0.031). With correction 0.9442 (0.0078). |
| L9 first grade | 200, 0.6, 120 ≤ k ≤ 150 | 0.5 | **0.53066** | Integral 0.49999 (0.031). With correction 0.5288 (0.0019). |
| L9 service life | 15000, 0.04, 570 ≤ k ≤ 630 | 0.7888 | **0.79627** | Integral 0.78870 (0.0076). With correction 0.79621 (5.4×10⁻⁵). |
| L3 coin | ε = 0.01, γ = 0.98, p = ½ | n ≈ 13 225 (z = 2.3 from the table) | — | z₀.₉₉ = 2.3263 gives **n = 13 530**. Chebyshev gives n = 125 000. |

**Fact — lecture errata found (the mathematics wins; the kernel shows the lecture value as a note):**

1. L3 ex. 2a prints 0.0572 as the exact P₅₀₀₀(50). The exact value is 0.0566. 0.0572 is not even the local approximation (0.0567).
2. L3 ex. 2b prints 0.5033 as the exact sum. The exact value is 0.5375. This matches the module map's correctness pin.
3. L3 says k₀ = 51 for n = 5000, p = 0.01. Formula (13) gives [(n+1)p] = [50.01] = 50, and the exact PMF has its single maximum at 50. 51 is not a mode.
4. L3 estimates P(40 ≤ k ≤ 60) ≈ 0.037·20 ≈ 0.7. The exact value is 0.8652; the integral formula gives 0.8448, and 0.8644 with correction. **Assumption:** the lecture meant a rough order-of-magnitude estimate. The kernel does not preset it, and the walkthrough (#51) can quote the exact value.
5. L3 ex. 1 says "each of five days" but computes n = 7, k = 5. This is already pinned in the module map; the preset follows the formula.
6. L9 "defects" writes ½(Ф(16) + Ф(1)) with Ф(1) = 0.8427, which is erf(1). In the Φ-from-−∞ convention, this equals Φ(√2) = 0.92135. This is the Φ-convention pin. The readout's `convention` field says Φ, and the notes explain the L9 notation.

## Acceptance criteria and tests

| Criterion | Test |
| --- | --- |
| Log-space PMF sums to 1 within 10⁻¹² for n ≤ 10⁴. k₀ by formula (13), including two modes. | `AC1` (two tests): 56 (n, p) sums; a finite log at k = 0 for n = 10⁴; BigInt point checks; argmax comparison in 11 cases; the two-mode and degenerate cases. |
| Every approximation reports its absolute error. L3 ex. 2 shows exact 0.0566 and 0.5375. | `AC2`: BigInt exact values to 4 digits. Each `error` field equals \|approximation − exact\|. Local 0.0567, integral 0.5000, corrected 0.5283. |
| Sample size with the exact quantile (≈ 13 530), with Chebyshev beside it. | `AC3`: z₀.₉₉ = 2.3263, n = 13 530, Chebyshev 125 000, and the lecture's table value 13 225 as a separate readout. |
| L9 exact 0.9520, 0.5307 and 0.7963 next to the lecture's normal values. | `AC4`: BigInt exact values to 4 digits. The kernel matches within 10⁻¹². The lecture value is shown. The plain normal value differs by more than 0.005. |
| Every normal readout names Φ, Φ₀ or erf. | `AC5`: every readout of every example and of the sample-size view carries a `convention`. The normal readouts name φ or Φ. |
| Contract and Monte Carlo | Shape and series kinds. Byte-identical JSON for the same seed. No `Math.random`. All bands hold on 5 seeds. |

`crew check` runs only `tests/acceptance`. Run the spike tests with `node --test spikes/lecture-bernoulli-approximations/kernel.test.mjs`.

## Position

**Assumption — proposal:**

- Ship this kernel as the `bernoulli` station with view 1 as the default, opening on L3 ex. 2b (example 3). That example shows the three ideas of the lecture at once:
  - the exact sum 0.5375;
  - the plain normal answer 0.5 and its 0.0375 error;
  - the continuity correction and Poisson both landing close.
- Keep the continuity correction as its own readout. The lecture does not use it, but in every L9 example it shrinks the error by a factor of 4 to 140.
- The walkthrough for lectures 1–3 (#51) should link its L3 steps to `bernoulli` with `example` = 1, 2, 3, 4 and `view` = 2 for the coin. It should quote the exact values from the table above.

**Unsure:**

- The slider range: n is capped at 10⁴ (the acceptance criterion), but L9's service-life example already uses n = 15 000. It is served as a preset, which bypasses the slider cap. The host clamps sliders, not presets.
- Whether teachers want Φ₀-style readouts in view 1, to match the L9 tables.
