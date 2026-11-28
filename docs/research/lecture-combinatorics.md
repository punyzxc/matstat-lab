# Combinatorics: urn counts, the hypergeometric law and balls in boxes

This is the research for `lecture-combinatorics` ([#38](https://github.com/GredesCerber/matstat-lab/issues/38)). The original kernel and evidence were staged in [77bca2a](https://github.com/GredesCerber/matstat-lab/commit/77bca2a) and [75dccca](https://github.com/GredesCerber/matstat-lab/commit/75dccca). The integration uses the current Urn station contract and the lecture presets merged in #192.

**Question.** Which seeded kernel shows urn sampling counts, the hypergeometric law and the balls-in-boxes law exactly, next to a simulation (lecture 1)?

**Deliverables.**
- `spikes/lecture-combinatorics/kernel.mjs` and `kernel.test.mjs` (`node --test`, 7 tests, all passing).
- The kernel follows the shared contract in [`lecture-module-map.md`](lecture-module-map.md) and serves the catalog station `urn` (`spikes/visual-foundation/src/stations/catalog.ts`, issue 38).
- A Russian dictionary for the kernel, `spikes/visual-foundation/i18n/ru/kernels/lecture-combinatorics.json`. The lab opens in Russian and the prototype tests check kernel translations and formula rendering.
- There is no UI code.

## Sources

- **Fact.** The original research cites [lecture 1](https://github.com/GredesCerber/matstat-lab/blob/8dfee73781e39d6946d76c07866f2a0534a3d988/lectures/L01.pdf), §Elements of combinatorics (examples 1–7, polynomial coefficients, formula 4, and the n = 5 occupancy example) and §Classical method (example 8 and formula 3). The [lecture walkthrough](lecture-walkthroughs-probability.md) records the corresponding station presets and expected results.
- **Fact.** The counting results are standard: Feller, *An Introduction to Probability Theory and Its Applications*, vol. 1, ch. II §§2–6 (samples, occupancy, hypergeometric) and ch. IV §2 (empty cells). The empty-box count uses Stirling numbers of the second kind, S(n, j) = j·S(n−1, j) + S(n−1, j−1) ([DLMF 26.8](https://dlmf.nist.gov/26.8)).
- **Fact.** Reuse instead of a rewrite: the four scheme counts and the list of samples are imported from `countOf` and `enumerate` in `spikes/lecture-outcome-space/kernel.mjs` (the L1 combinatorics generator of #130). This kernel adds the probabilities, the lecture's separate stars-and-bars problem, the hypergeometric law, the balls-in-boxes law and the simulations.
- **Fact.** Randomness comes only from `fixtureUint32` in `spikes/simulation-engine/engine.mjs`, namespace `0x0c38`. There is one stream per view: 1 urn draws, 2 hypergeometric draws, 3 ball placements. Draw i reads indices 64·i + t.
- **Fact.** The tests use independent references that share no code with the kernel. These are brute-force enumeration of all ordered tuples, all r-subsets and all mⁿ placements, plus BigInt arithmetic.

## What the kernel shows

There is one station, `urn`, with three views. All probabilities are exact BigInt fractions, reported both reduced (`"24/625"`) and as doubles rounded to 6 significant digits.

| View | Input | Readouts (each with `convention`) | Chart |
| --- | --- | --- | --- |
| 1 Urn counts | scheme (ordered or not, with or without replacement), n ≤ 12, k ≤ 8, R | The exact count (nᵏ, Aₙᵏ, Cₙᵏ, C(n+k−1, k)) next to the enumerated count when it is at most 60. C(n+k−1, k) for combinations with repetition. The lecture's C(n+k−1, k−1), labelled as *n identical balls in k boxes*. P(all k balls show the same number) under ball-by-ball drawing, with the simulated frequency and band. For the unordered-with-replacement scheme, also the wrong "all multisets equally likely" value. | Exact P(sample) for each listed sample (`pmf`), simulated frequencies (`points`), ±4σ band (`band`). |
| 2 Hypergeometric (L1 ex. 8) | n ≤ 60 balls, k red, r drawn without replacement, s, R | P(A_s) = C(k,s)·C(n−k,r−s)/C(n,r), exact and simulated, with band. Σ P(A_s) = 1, exact. Mean rk/n and variance r·(k/n)(1−k/n)(n−r)/(n−1). | Exact PMF (`pmf`), simulated frequencies (`points`), band. |
| 3 Balls in boxes | n ≤ 12 balls, m ≤ 12 boxes, R | P(exactly e boxes empty) = C(m,e)·S(n, m−e)·(m−e)!/mⁿ for e = 0 … m−1, exact and simulated. For n = m = 5, also the lecture value. The total mⁿ. | Exact PMF, simulated frequencies, band. |

- **Fact.** The Monte Carlo band is predeclared: ±4 standard errors, √(P(1−P)/R). It is omitted when R·P(1−P) < 9, because the normal approximation to a frequency is poor there. This is the same rule as in the other lecture kernels.
- **Fact.** The same params and seed give byte-identical JSON. The source contains no `Math.random`, `document` or `window`.

## Lecture values and corrections

| Place in L1 | Lecture | Mathematics | Kernel |
| --- | --- | --- | --- |
| Ex. 6, combinations with repetition (k balls from n) | C(n+k−1, k−1) | C(n+k−1, k). The lecture's stars and bars puts n balls among k − 1 bars, so it counts **n identical balls in k boxes**. That is a different problem. The two agree only when n = k. Example: n = 2, k = 3 gives 4 multisets, but 6 placements. | `count` and `cbar` show C(n+k−1, k). `lectureBoxes` shows C(n+k−1, k−1) under its own name. |
| Ex. 6, what the count means | "the number of variants" | The C(n+k−1, k) multisets are counted, not equally likely. When balls are drawn one at a time with replacement, a multiset with multiplicities mᵢ has probability k!/(m₁!⋯mₙ!·nᵏ). For n = 3, k = 2, "both balls equal" has probability 1/3, not 3/6 = 1/2. | `same` (exact 1/3, simulated) next to `sameNaive` (1/2, labelled as the wrong model). |
| Ex. 8, formula (3), s = 0, 1, …, r | Sum over all s from 0 to r | Correct, because C(a, b) = 0 for b > a. P(A_s) > 0 only for max(0, r−n+k) ≤ s ≤ min(r, k). | Zero bars outside the support, and a note that names it. |
| Balls in boxes, n = 5 | 24/625, 48/125, 12/25, 12/125, 1/625 (sum 1) | The same. Enumeration of all 5⁵ = 3125 placements gives 120, 1200, 1500, 300 and 5. | `empty0` … `empty4`, each with `lecture` equal to `exact`. |

- **Fact.** The general formulas the lecture writes for A₂ and A₃ list occupancy patterns (such as 2211…100) that need n ≥ 6. For n = 5 those terms vanish, and the printed n = 5 answers are right. The kernel does not reproduce the lecture's pattern-by-pattern sum. It uses the Stirling formula, which is checked against enumeration for every n, m ≤ 6.

## Acceptance criteria

| Criterion | Test | Result |
| --- | --- | --- |
| AC1. For each scheme, the count equals full enumeration for all n ≤ 6, k ≤ 4 | `AC1` | 120 cases (4 schemes × 6 × 5). The count and the set of samples both match brute force over ordered tuples. |
| AC2. With repetition the count is C(n+k−1, k). The lecture's C(n+k−1, k−1) is shown as n identical balls in k boxes | `AC2` | C(n+k−1, k) matches enumeration. C(n+k−1, k−1) matches a brute-force count of occupancy vectors. The readouts are separate. Exact multiset probabilities sum to 1. |
| AC3. The hypergeometric PMF sums to 1 and matches exact rationals; seeded frequencies are inside the band | `AC3`, `AC3/AC4` | 6 urns checked against enumeration of all r-subsets. For n = 10, k = 4, r = 4 the PMF is 1/14, 8/21, 3/7, 4/35, 1/210. 5 seeds with R = 5000 stay inside the band. |
| AC4. For n = 5 balls in 5 boxes, the result is 24/625, 48/125, 12/25, 12/125, 1/625, the 5⁵ enumeration agrees, and so does the simulation | `AC4`, `AC3/AC4` | Exact, and equal to enumeration. Polynomial coefficients over all occupancy vectors sum to 5⁵ (formula 4). The simulation stays inside the band for 5 seeds. |
| AC5. The same params and seed give byte-identical JSON | `AC5` | Yes, for 4 parameter sets. Different seeds give different output. |

## Position

**Assumption — what I propose:**

1. Keep the scheme counts in one place. The `urn` station imports `countOf` and `enumerate` from the outcome-space kernel instead of copying them. When kernels become product code, these move into one shared combinatorics module.
2. Show the lecture's C(n+k−1, k−1) as a separate, correctly named problem (identical balls in boxes), not as an error message. That keeps the lecture's stars-and-bars picture and fixes the formula.
3. Make "counted is not equally likely" visible. For the unordered-with-replacement scheme, put the exact sequential probability next to the naive 1/C(n+k−1, k). This is the classic trap the lecture does not mention.
4. Use exact BigInt fractions for every readout in this station. The numbers are small (at most 12¹² placements), and the lecture prints fractions.

**What I am unsure of:**

- Whether the station should also cover the polynomial-coefficient view on its own, for example choosing an occupancy vector and counting its placements. The kernel exports `polynomialCoefficient`, and the test checks formula (4), but no view uses it yet.
- The limits n ≤ 12, k ≤ 8 and n ≤ 60 for the hypergeometric view are a guess for classroom use. Speed on phones was not measured.
