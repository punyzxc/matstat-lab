# Conditional probability and Bayes kernel

Research for `lecture-conditional-bayes` (#43). Owner: punyzxc (Claude executor). Date: 2026-11-24.

**Question.** Which seeded kernel shows event algebra, conditional and total probability and Bayes as counts of simulated outcomes (lectures 1 and 2)?

**Deliverables.** `spikes/lecture-conditional-bayes/kernel.mjs` and `kernel.test.mjs` (`node --test`, 10 tests, green). The kernel follows the shared contract in `docs/research/lecture-module-map.md` (PR #48). The scene host from PR #49 already lists the station `bayes` with `kernel: 'lecture-conditional-bayes'`, so the station appears in the Orbital laboratory without layout work once both land. This task contains no UI code.

## Sources

- **Fact.** Lectures L1 §Operations on events, §Axioms and corollaries, §Independence and L2 §Conditional probability, §Multiplication theorem, §Independence in aggregate, §Total probability, §Bayes. The owner holds them; they are not committed here.
- **Fact.** The kernel contract and its host code: `spikes/visual-foundation/src/stations/kernel-contract.ts` and `kernel-station.tsx` on branch `crew/37-…` (PR #49). The host catches an exception thrown by `run()` and shows "The kernel rejected these parameters: …". The kernel uses that path to reject priors.
- **Fact.** Randomness: `fixtureUint32(seed, stream, index)` from `spikes/simulation-engine/engine.mjs`, mapped to (u + 0.5)/2³². Each quantity has its own stream, so the same seed gives the same points when a slider moves.
- **Fact.** Standard definition of mutual independence: every sub-family of at least two events must factor (Feller, *An Introduction to Probability Theory and Its Applications*, vol. 1, ch. V §3; Wikipedia, "Independence (probability theory)", section "More than two events").

## What the kernel shows

One station `bayes`, four views chosen by the slider `view`. The kernel also exports `stations` with one entry per view (`bayes-events`, `bayes-independence`, `bayes-hypotheses`, `bayes-guessing`), each with only its own sliders. A host can register these later without changing the kernel.

| View | Model | Exact value | Observed | Chart |
| --- | --- | --- | --- | --- |
| 1 Events | Uniform points in the unit square. A = [0, a] × [0, 1], B = [s, s + b] × [0, h] (clipped), C = [0, 1] × [0, c]. | Areas in closed form: P(A), P(B), P(C), P(AB), P(A∪B) by the addition theorem, P(A∪B∪C) by inclusion–exclusion, P(A\|B) = P(AB)/P(B), P(AB) − P(A)P(B). | Counts of points; P(A\|B) = #AB / #B. | Points coloured A only, B only, AB, neither; outlines of A, B and C. |
| 2 Independence | Bernstein's tetrahedron (red, green, blue, and a three-colour face), or an 8-outcome counterexample. | Integer counts, compared by cross-multiplication (no floats). | Frequencies of A, B, C, AB, AC, BC, ABC. | Exact PMF, the product of single probabilities, simulated frequencies. |
| 3 Bayes | Three hypotheses with priors q₁, q₂, q₃ and likelihoods P(A\|Bₖ). | P(A) = Σ qₖP(A\|Bₖ); P(Bₖ\|A) = qₖP(A\|Bₖ)/P(A). | Hypothesis drawn by the priors, then A by its likelihood; posterior = share of A-outcomes from Bₖ. | Priors, posteriors, observed shares. |
| 4 Guessing student | Knows the answer with probability p, otherwise picks one of m options. | P(guessed \| correct) = (1 − p)/((m − 1)p + 1); for m = 5 this is (1 − p)/(4p + 1). | Share of correct answers that were guesses. | The curve over p with its band, and the simulated point. |

**Band (predeclared).** Every observed frequency carries `band = theory ± 4·√(theory(1 − theory)/m)`, where m is the number of trials or, for a conditional frequency, the expected number of conditioning outcomes. The value 4 is fixed in code (`BAND_Z`) and tested on five fixed seeds; seeds were not chosen to pass. When the conditioning event is empty, the conditional readout is `null`, never NaN.

**Rejection.** `checkHypotheses` rejects priors outside [0, 1] and priors whose sum differs from 1 by more than 10⁻⁹. With the three prior sliders the student sees the rejection live as soon as the priors stop summing to 1.

## Acceptance criteria and tests

| Criterion | Test |
| --- | --- |
| P(A∪B), P(AB), P(A\|B) exact and simulated inside a band | `AC1` tests: closed-form areas checked against hand values (0.5, 0.3, 0.12, 0.68, 0.4, …), clipping, empty B; all counts inside the band for five seeds. |
| Bernstein: pairwise independence exact, mutual fails exactly | `AC2`: counts {A: 2, B: 2, C: 2, AB: 1, AC: 1, BC: 1, ABC: 1} of 4; 1·4 = 2·2 for each pair, 1·16 ≠ 2·2·2. |
| Priors not summing to 1 rejected; posteriors sum to 1; guessing student = (1 − p)/(4p + 1) | `AC3`: three rejection cases, P(A) = 0.045 and posteriors 2/9, 1/3, 4/9 for the default sliders; the formula for p = 0, 0.01, 0.25, 0.6, 0.99, 1; L2's die example. |
| Contract | Shape of `meta`, `params`, `series`; byte-identical output for the same seed (`JSON.stringify`). |

`crew check` runs only `tests/acceptance`. The spike tests are run separately with `node --test spikes/lecture-conditional-bayes/kernel.test.mjs`.

## Lecture errata and notes

| Where | Lecture | Correct | Lab behaviour |
| --- | --- | --- | --- |
| L2 §Independence in aggregate | The definition, as written, requires only the product over the whole family B₁ … Bₙ. | Every sub-family of two or more events must factor. The product over the whole family alone is not enough: with Ω = {1, …, 8}, A = B = {1, 2, 3, 4}, C = {1, 5, 6, 7}, P(ABC) = 1/8 = P(A)P(B)P(C), yet P(AB) = 1/2 ≠ 1/4. | View 2, model 2 shows this counterexample. Test `lecture pin`. **Fact** about the text extracted from the PDF; the owner may confirm against the PDF. |
| L2 §Total probability, remark | The hypotheses need only be disjoint and cover A, so P(A) ≤ Σ P(Bₖ) ≤ 1 is allowed (the die example, solution 1, uses Σ = 1/2). | This is correct mathematics. | The kernel requires a complete group (acceptance criterion). Adding the hypothesis "none of the others" with P(A\|·) = 0 completes the group and changes no number; the note in view 3 says so, and the die example is tested both ways. |
| L2 guessing student | The question calls "guessed" event A; the solution uses A for "answered correctly" and B₂ for "solved incorrectly". | The answer (1 − p)/(4p + 1) is correct. | The kernel names A = correct answer and states it in the note. |
| L2 remark on Bernstein | Refers to "axiom 3" for pairwise independence. | Axiom 3 is countable additivity and is unrelated. | No effect on numbers; the note cites Bernstein only. **Assumption:** this may be a text-extraction artefact. |

Checked and correct: L1 corollary 4 (addition theorem); L1 independence property 6 (disjoint events with positive probabilities are dependent; view 1 shows it when B lies right of A); L2 multiplication theorem; L2 die example, solution 2: 1/6 + 1/6 + (2/3)(1/4) = 1/2; L2 Bayes formula (10).

## Position

- **Proposal.** Use this kernel as the Bayes station: one station in orbit I with four views. It keeps the orbit at five stations, and the host's six-slot limit is respected.
- **Proposal for the host (#37).** Show only the sliders of the active view. Either register the four exported per-view stations, or add an optional `view` tag to a parameter in the contract. Until then every slider is listed, with a "Events:", "Bayes:" or "Student:" prefix.
- **Proposal.** A drag-the-rectangle interaction on the points chart would map directly to the sliders a, s, b, h, c. That is host UI work, not kernel work.
- **Unsure.** Whether the owner wants the generalised total probability (hypotheses that only cover A) as a fifth mode, instead of the strict complete-group check the acceptance criterion asks for.
