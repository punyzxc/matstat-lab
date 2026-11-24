# Lecture module map

Research for `lecture-module-map`. Owner: punyzxc (captain). Date: 2026-11-24.

**Question.** How do the 12 course lectures ("Probability theory, mathematical statistics and combinatorics") map to laboratory modules, so that every lab mechanic matches the lecture material, is mathematically correct, uses real seeded simulation and opens inside the single scene of the Orbital laboratory?

## Sources

- **Fact.** The lectures are the course PDFs "Лекция 1" … "Лекция 12", held by the owner and not committed to this public repository. Below, "L3 §Poisson" means lecture 3, the section with that title. Issues reference lectures the same way.
- **Fact.** The visual base is the Orbital laboratory in `spikes/visual-foundation` (the Observatory scene, a globe and six instrument cards). On 2026-11-24 the owner chose it as the only prototype to keep. All other prototypes are reference material only.
- **Fact (owner, 2026-11-24).** The result is a web program, not a website. The whole interface and all navigation live on the scene of the main screen. There are no separate pages, no page scroll to sections and no extra windows. A module opens inside the scene.

## Product rule: one scene

| Rule | Consequence for every module |
| --- | --- |
| One screen, no document scroll | A module is a station that expands inside the scene (an in-scene panel or overlay that keeps the globe and the navigation visible). The browser page never scrolls. A long panel scrolls only inside itself. |
| Navigation lives on the scene | Lecture groups are orbits or rings around the globe. Stations sit on them. The header tabs "Experiments" and "Lab notes" stop being separate views. They become scene-level drawers, or the journal moves into each station. |
| Keyboard and URL state | Every station is reachable by keyboard. The open station, its parameters and its seed are encoded in the URL hash, so a link reproduces the run. |
| Same run contract everywhere | Each station runs a pure seeded kernel (contract below) and shows its readouts with theory next to observation. |

## Module map

The lectures group into four blocks. Each block is one orbit. The existing six cards keep their place, and new stations join the orbit of their block. The placement is a proposal that the owner confirms, because the visual layout is theirs.

| Orbit | Lecture and section | Station | What the student does and sees | Kernel task |
| --- | --- | --- | --- | --- |
| I. Probability | L1 §Combinatorics (urn scheme, examples 1–7, polynomial coefficients) | **Urn** | Chooses n, k, with or without replacement, ordered or not. Sees the exact count (nᵏ, Aₙᵏ, Cₙᵏ, and C(n + k − 1, k) with repetition, see the pins) next to the enumerated list for small n and the simulated frequency of a chosen pattern. Hypergeometric PMF (L1 ex. 8) and balls in boxes (L1, n = 5, the number of empty boxes). | `lecture-combinatorics` |
| I | L1 §Classical method, §Statistical definition | **Urn**, then **Frequency** | Repeats an experiment and watches the relative frequency settle near the classical value (coin, die, Buffon and Pearson runs as presets). | `lecture-geometric-probability` |
| I | L1 and L4 §Geometric method, Bertrand paradox | **Darts** | Throws seeded points into a region. Sees the area ratio, the hit frequency and its band. For Bertrand, three chord-sampling schemes run side by side and give three different answers. | `lecture-geometric-probability` |
| I | L1 §Operations on events, §Independence; L2 §Conditional probability, §Total probability, §Bayes | **Bayes** | Drags event regions on an area diagram (Venn and partition). Reads P(A∪B), P(A\|B) and posterior weights as counts of simulated points. Includes Bernstein's example (pairwise independent, not mutually independent) and the "guessing student" posterior (1 − p)/(4p + 1). | `lecture-conditional-bayes` |
| I | L3 §Bernoulli scheme, §Local and integral de Moivre–Laplace, §Poisson; L9 examples | **Bernoulli** | Sets n and p. Sees the exact binomial PMF, the most probable number k₀, the local and integral normal approximations and the Poisson approximation, with the error of each. Also the sample size needed for a target frequency accuracy (normal approximation compared with the Chebyshev bound). | `lecture-bernoulli-approximations` |
| II. Random variables | L4 §Kolmogorov axioms; L5 §Distribution function, §Density, §Main distributions | **Distribution Explorer** (existing) | Uses the existing explorer, extended to the six lecture distributions (Bernoulli or indicator, Binomial, Poisson, Uniform, Normal, Exponential), with F, the PMF or PDF, and the sample histogram and ECDF. | existing engine work (#13, statistics tasks in the PRD) |
| II | L6 §Expectation, mode, median, §Moments, skewness, kurtosis, §3σ rule | **Moments** | Compares theoretical and sample mean, median, mode, variance, skewness and excess kurtosis for each distribution. The 3σ panel shows the exact P(\|ξ − a\| < kσ) for k = 1…4. | `lecture-random-vectors` |
| II | L6 §Functions of random variables | **Transform** | Applies y = φ(x) (linear, eˣ, e^(−βx), x²). Sees the transformed histogram over the density from formula (44). | `lecture-random-vectors` |
| II | L6 §Random vectors, §Covariance and correlation, §Regression lines; the lottery example | **Scatter** | Samples a bivariate normal with chosen ρ (the ellipse of dispersion), and the uniform disc (uncorrelated but dependent). Sees both regression lines and the angle between them. The matching ("lottery") problem shows M = D = 1 for every n. | `lecture-random-vectors` |
| III. Limit theorems | L6 §Sums and convolution (uniform sums, ex. with 2–4 terms) | **Convolution** | Adds m uniforms. Sees the exact piecewise density (L6 formulas) and the simulated histogram moving towards the normal curve. | `lecture-limit-theorems` |
| III | L7 §Chebyshev inequality, §Chebyshev, Khinchin, Bernoulli, Poisson and Markov theorems, Cauchy example | **Convergence** (existing, extended) | Watches running means for finite-variance models and for Cauchy, where they do not settle. Compares the Chebyshev bound with the real tail probability. | `lecture-limit-theorems`, #33 |
| III | L8 §Lindeberg–Lévy, §Lyapunov, Poisson lemma; L9 §Characteristic functions, de Moivre–Laplace | **CLT** | Standardizes sums of n i.i.d. draws from a chosen law. Sees the histogram of standardized sums against N(0, 1), the Kolmogorov distance as n grows, and Σₖ≤ₙ nᵏe⁻ⁿ/k! → 1/2. | `lecture-limit-theorems` |
| IV. Statistics | L10 §Sample, variation series, frequency table, histogram, empirical distribution function | **Sample** | Draws a sample. Sees the variation series, the frequency table, the histogram with k ≈ 5·lg n bins (adjustable) and the ECDF with its convention stated. | `lecture-sampling-goodness-of-fit` |
| IV | L10 §Kolmogorov test, §Pearson χ²; L12 §Pearson for normal, uniform, exponential, §Kolmogorov, §Skewness and kurtosis check | **Fit** | Tests a hypothesised law. Sees Dₙ with the band Fₙ ± λₙ(α), χ² with the correct degrees of freedom, the p-value, and a Monte Carlo check of the false-rejection rate. | `lecture-sampling-goodness-of-fit` |
| IV | L11 §Point estimates (unbiasedness, efficiency, consistency), s² with n and n − 1 | **Estimation** (existing, extended) | Repeats samples and sees the bias of s² with divisor n, the variance of competing estimators and their MSE as n grows. | `lecture-estimation-intervals` |
| IV | L11 §Confidence interval (normal approximation, Student t, χ² for variance), §Statistical homogeneity | **Confidence Intervals** (existing, extended) | Draws many intervals. Sees how many cover the true value for each method and n, and the two-proportion homogeneity z-test (formula 139). | `lecture-estimation-intervals` |
| IV | L12 §Hypotheses, errors of type I and II, power, critical regions; z-test for p, z- and t-tests for the mean, F-test for variances | **Hypothesis Testing** (existing, extended) | Chooses H₀, H₁ (two-sided, right, left) and α. Sees the critical region on the null density, the observed statistic, the decision, and simulated type I error and power curves. | `lecture-hypothesis-tests` |
| IV | (existing) | **Randomness** (existing) | The runs test on draw order. It is not in the lectures; keep it as an extra. | none |

## Kernel contract (shared by all lecture spikes)

Each lecture spike lives in `spikes/<id>/` and contains:

1. `kernel.mjs`. Plain ES module, no DOM and no UI library.
   - `meta`: `{ id, lectures: ['L3'], title, params: [{ key, label, min, max, step, default }] }`.
   - `run(params, { seed, station })` returns `{ readouts, series, notes, axes }`:
     - `readouts`: `[{ key, label, observed, theory, unit, convention }]`
     - `series`: `[{ id, kind, x, y, y2, label, unit, tone }]`
       - `kind` is one of `'pmf' | 'pdf' | 'cdf' | 'hist' | 'ecdf' | 'line' | 'points' | 'band' | 'rule'`.
       - `band` fills between `y` and `y2`.
       - `rule` draws vertical markers at each `x`.
       - `hist` puts `x` at the bin starts.
       - `tone` is `'default'` (observed), `'signal'` (theory or reference), `'muted'` (context) or `'accent'` (highlighted region).
     - `notes`: short teaching notes, one per lecture formula used.
     - `axes`: optional `{ x, y }` axis titles.
   - One kernel may serve several stations (Moments, Transform and Scatter share `lecture-random-vectors`). It exports an optional `stations: { <stationId>: { params } }`, and `run` receives `options.station`.
   - The host clamps every parameter to `[min, max]` and snaps it to `step` before calling `run`. The source of truth is `spikes/visual-foundation/src/stations/kernel-contract.ts` (PR #49), and `spikes/scene-module-host/kernel.mjs` is a working example.
   - It is deterministic: the same params and seed give byte-identical output (checked with `JSON.stringify`).
   - Randomness comes only from `fixtureUint32(seed, stream, index)` in `spikes/simulation-engine/engine.mjs` (counter-based, `fixture-mix32-v1`). Kernels do not use `Math.random`.
2. `kernel.test.mjs`. `node --test` checks exact values against independent references (closed forms, exact enumeration, or values recomputed from first principles). Monte Carlo checks use a predeclared band.
3. The research document `docs/research/<id>.md`: facts, assumptions, a position, and the lecture errata found.

The station UI is not part of a kernel task. The scene host (`scene-module-host`) imports `kernel.mjs`, draws `series` with one shared chart component and shows `readouts`.

## Correctness pins (the lecture is wrong or ambiguous)

"Mathematically correct" outranks "matches the lecture". The lab shows the correct value and, where useful, a note on the lecture's version. Checked independently with exact sums in Node.js.

| Where | Lecture says | Correct | Lab behaviour |
| --- | --- | --- | --- |
| L1 and L4, Bertrand paradox | The answer is 0.5 | No unique answer. Random midpoint on a radius gives 1/2, random endpoints give 1/3, random midpoint in the disc gives 1/4. | Simulate each scheme separately and endorse none. |
| L1 ex. 6, combinations with repetition | C(n + k − 1, k − 1) for choosing k balls out of n with repetition | C(n + k − 1, k). The lecture's stars-and-bars argument (n balls, k − 1 bars) counts n identical balls in k boxes, which is the other problem. | Show both problems and both counts, each with a 3-by-3 enumeration. |
| L3 ex. 1 | "in each of five days", computed with n = 7, k = 5: 0.311 | The formula matches n = 7, k = 5 (0.3115). The wording is inconsistent. | Preset uses n = 7, k = 5 and says so. |
| L3 ex. 2b | P(0 ≤ k ≤ 50) ≈ 0.5033 (n = 5000, p = 0.01); normal approximation 0.5 | Exact 0.5375 | Show exact, plain normal (0.5) and the continuity-corrected approximation side by side. |
| L3 coin sample size | n ≈ 13 225 (z = 2.3 from the table) | z₀.₉₉ = 2.3263 gives n ≈ 13 530 | Use exact quantiles and show the table-rounded value as a note. |
| Φ conventions | L3 and L6 integrate from −∞; L12 integrates from 0; L9 uses Ф(1) = 0.8427, which is erf(1) | Three different functions share the letter Ф | Every readout names its function: Φ(x) (CDF), Φ₀(x) = Φ(x) − 0.5, or erf. |
| L6 §3σ rule | "1 − 0.00135 = 0.9973" | 1 − 2Φ(−3) = 1 − 0.0027 = 0.9973 | Show both tails. |
| L7 Chebyshev example | Normal: P(\|ξ − M\| ≥ 3σ) ≈ 0.00135; Poisson: ≥ 1/9 | Normal two-sided 0.0027. Poisson(1): 0.019. Chebyshev gives only the bound ≤ 1/9. | Show the bound and the real tail for each law. |
| L5 vs L10 ECDF | F(x) = P(ξ < x), left-continuous; L10 counts sample values "not exceeding x" and also calls Fₙ left-continuous | The two definitions differ at the jumps. | Decision needed (see below). Every ECDF and CDF readout states its convention. |
| L10 Pearson df | r = n − 1 (n = number of intervals), 16 intervals for a sample of 16 | k = s − 1 − r (L12), and the expected counts must be large enough (L10 itself asks for n > 50) | Use L12's df. Warn when expected counts are below 5. |
| L11 coin example | Numerator written as 0.480 − 0.490 for H₀: p = 0.5 | Value −1.26 matches 0.480 − 0.5 = −1.265 | Use p̂ − p₀. |
| L11 example data | x̄ = 3.0318 and s² = 0.0303 | The 22 listed values give Σx = 66.7, Σx² = 202.81, x̄ = 3.0318 and s² = 0.02799 (divisor n − 1). The lecture's s² does not match its own data. | Compute s² from the data. |
| L11 t-interval | 2.9528 < M < 3.1108 | With s² = 0.02799, n = 22 and t₀.₉₇₅(21) = 2.0796: 2.9576 < M < 3.1060 | Use s/√n with the stated divisor. |
| L11 χ² interval for D | χ² = 37.6 and 9.9 for γ = 0.95, r = 21, which gives 0.017 < D < 0.064 | χ²₀.₉₇₅ = 35.48 and χ²₀.₀₂₅ = 10.28. With s² = 0.02799 this gives 0.0166 < D < 0.0572. | Compute quantiles, do not use table values. |
| L9 examples | Normal approximations given as answers (0.92135, 0.5, 0.7888) | Exact binomial: 0.9520, 0.5307, 0.7963 | Show exact and approximate together, with the error. |

Checked and correct: L1 balls in boxes for n = 5 (24/625, 48/125, 12/25, 12/125, 1/625 by full enumeration of 5⁵ cases); L1 sin² example (0.5); L2 posterior (1 − p)/(4p + 1); L3 P₅₀₀₀(50) ≈ 0.0566; L3 typo example 0.0952; L11 two-series z = −0.447; L12 U = 0.471.

`lecture-worked-examples-audit` (adekin06) repeats every check above independently, covers all remaining worked examples, and publishes the reference values as fixtures that the kernel tests reuse.

## Decisions needed

1. **CDF and ECDF convention (owner, scientific).** Lecture 5 uses F(x) = P(ξ < x). The current spikes and the draft PRD use P(ξ ≤ x), which is standard in modern texts and in SciPy. Proposal: keep P(ξ ≤ x) internally and in all charts, and show a one-line note in Sample and Distribution Explorer: "The lecture defines F(x) = P(ξ < x). It differs only at the jumps." To be recorded in `docs/decisions.md` once the owner agrees.
2. **Station placement (owner, visual).** The four orbits and the station names above are a proposal. The owner may rename stations or merge them.
3. **Language of the interface.** The lectures are in Russian. The interface text language is still open in `docs/decisions.md` ("lesson language").

## Position

- Build the lecture content as small pure kernels (one per lecture block) with independent reference tests. This follows the 2026-11-23 decision to separate functional work from visual work, and lets five people work in parallel without touching `spikes/visual-foundation`.
- The captain builds the in-scene host once (`scene-module-host`). Each kernel then becomes a station by registration, without new layout work.
- The production versions of these kernels go into the PRD as an epic "Lecture modules" when the area map (#16) and the PRD are approved. Until then these are discovery spikes, as the phase requires. The epic exists only in this document and in the section heading of `docs/discovery.md`, because `crew discover plan` creates research tasks, not epics.
- Unsure: whether characteristic functions (L9) deserve a station of their own. Proposal: a short note inside **CLT** (the product of characteristic functions for sums), not a separate station.
