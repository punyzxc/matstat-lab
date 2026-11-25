# Frequency and geometric probability kernel (L1, L4), issue #40

**Question.** Which seeded kernel shows frequency stabilisation, geometric probability and the three Bertrand chord schemes?

**Answer.** `spikes/lecture-geometric-probability/kernel.mjs`, one kernel for two orbit-I stations:

| Station | Lectures | What the student sees |
| --- | --- | --- |
| `frequency` (Frequency) | L1 §Statistical definition | Five sequences of N trials of an event with probability p. Running frequencies m/n on a log₁₀ n axis inside the predeclared band p ± 3√(p(1 − p)/n). Live slider. |
| `darts` (Darts) | L1 §Geometric method, L4 | View 0: L1 example 1, x ~ U(0, π), hits where sin²x ≤ 1/2, exact 1/2. View 1: points in [0, 1]², hits in the quarter disc, exact π/4 and an estimate of π. View 2: the three Bertrand schemes' running shares of long chords against 1/2, 1/3, 1/4. Live slider. |

## Findings

- **Fact.** L1 example 1: √(0.5 − sin²x) exists on [0, π/4] ∪ [3π/4, π], measure π/2 of π, so P = 1/2 (independently checked by a 10⁶-point Riemann sum).
- **Fact.** Bertrand, unit circle, long chord = longer than √3: random point on a radius, d < 1/2, P = 1/2; random endpoints, central angle in (2π/3, 4π/3), P = 1/3; random midpoint uniform in the disc, r < 1/2, P = 1/4. The simulation confirms all three within 3 SE.
- **Lecture remark (L1).** The lecture states 0.5 as "the" answer, on the grounds that it is the largest. The mathematics does not single out any scheme: each answer belongs to its own experiment. The station shows all three and its note says that none is "the" answer.
- **Fact.** Frequency series are exact prefix counts (test recomputes them from the raw draws).

## Bands (predeclared)

Final frequency and every hit share: ± 3√(p(1 − p)/n) (fails with probability 0.0027 per check).

## Host change

Chart points now honour their tone (accent = signal yellow, muted = grey). Before, hits and misses rendered in the same colour; this also fixes the Confidence station's "misses" and the Estimation bias points.

## Position

Ship as above. Seeds and streams: frequency 10–14, darts 30–31, Bertrand 40–42, all from `fixtureUint32`.
