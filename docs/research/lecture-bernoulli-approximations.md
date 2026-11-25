# Lecture kernel: the Bernoulli scheme and its approximations (L3, L9)

Issue #39. Kernel: `spikes/lecture-bernoulli-approximations/kernel.mjs`, tests: `kernel.test.mjs` (node --test).
Station: `bernoulli` on orbit I (catalog entry already existed; it showed "No kernel" until this kernel landed).

## Question

Which kernel compares the exact binomial law with the local, integral and Poisson approximations and their errors
(lectures 3 and 9)?

## Findings

| # | Statement | Kind |
|---|---|---|
| 1 | `P_n(k) = C(n,k) p^k q^(n−k)` evaluated naively overflows `C(n,k)` and underflows `p^k` long before n = 10⁴. A plain log-gamma form sums to 1 only within about 6·10⁻¹² at n = 5000, p = ½ (measured here). | fact (measured in `kernel.test.mjs`) |
| 2 | Loader's saddle-point form (Stirling error `stirlerr` plus deviance `bd0`) keeps full relative precision; with it the law sums to 1 within 10⁻¹² for every n ≤ 10⁴ tested. It is the method behind R's `dbinom`. | fact: C. Loader, *Fast and accurate computation of binomial probabilities* (2000); measured in tests |
| 3 | The most probable number satisfies `np − q ≤ k₀ ≤ np + p` (L3, formula 13). The interval has length 1, so there are two modes exactly when `(n + 1)p` is an integer. | fact: checked against the exact law for 56 (n, p) pairs |
| 4 | L3 ex. 2 (n = 5000, p = 0.01): `P(k = 50) = 0.0566088`, lecture 0.0572; `P(0 ≤ k ≤ 50) = 0.537517`, lecture 0.5033. Local normal 0.0567032; plain integral 0.5; with continuity correction 0.528328. | fact: `spikes/lecture-worked-examples-audit/fixtures/references.json` (`L03-binomial-pmf`, `L03-binomial-cdf`, `L03-local-normal`, `L03-plain-normal-cdf`) |
| 5 | L3 frequency accuracy (ε = 0.01, γ = 0.98, p = ½): the exact quantile z = 2.326348 gives n = 13 530 (continuous 13 529.74); the lecture's table value z = 2.3 gives 13 225. Chebyshev asks for 125 000. | fact: fixture `L03-coin-size`; Chebyshev computed |
| 6 | L9 examples: exact binomial 0.9520, 0.5307, 0.7963 against the lecture's normal answers 0.92135, 0.5, 0.7888; the continuity correction gives 0.9442, 0.5288, 0.7962. | fact: fixtures `L09-defects`, `L09-first-grade`, `L09-guarantee` |
| 7 | At n = 100, Poisson has the smaller largest error at p = 0.02, the local normal at p = 0.5. | fact: kernel test (also the comparison #115 asks for) |
| 8 | Sampling one count per series by inverting the exact CDF (one uniform per series) gives the same law as n Bernoulli trials and keeps n = 10⁴ with R = 2·10⁴ series fast (under 20 ms here). | fact (law); assumption that the speed holds on slower laptops |

Every normal readout names its function: the station uses Φ, the CDF from −∞. Tables with Φ₀ (from 0) give the same
difference Φ(x₂) − Φ(x₁); `erf` is not used in this kernel.

## What the station shows

- **View 0, the law:** typed n, p, k and an interval [k₁, k₂]. The exact PMF (stems), the shares of R simulated series
  (bars), the local normal curve (dashed) and Poisson (dots). Readouts: k₀ (with the two-mode case), `P_n(k)` exact
  and simulated, local and Poisson with their absolute errors, the interval exact and simulated (4 SE band), the plain
  and the corrected integral theorem with their errors, and the largest error over all k of local and Poisson.
- **View 1, the frequency:** typed ε and γ. The normal design with the exact quantile, Chebyshev's size, and R series of
  the normal size: the share with |k/n − p| ≤ ε sits at γ. The typed n is read back as the guarantee it gives.
- Lecture 3 steps 1–4 and lecture 9 step 3 open the station with the lecture's numbers.

## Position

Use this kernel for the Bernoulli station: it reproduces every L3 and L9 fixture to 10⁻⁶ and puts the lecture value
next to the exact one, as the module map asks (mathematics wins, the lecture value is named). Unsure: whether the
frequency view should also offer the "unknown p" design with pq ≤ ¼; today p is typed, and p = ½ gives that bound.
The trials machine of #115 can build on view 0: each series is one count k, and its row of trials can be drawn by
placing k successes among n places.
