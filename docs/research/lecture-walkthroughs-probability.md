# Step-by-step scripts for lectures 1 to 3

This is the research for `lecture-walkthroughs-probability` ([#51](https://github.com/punyzxc/matstat-lab/issues/51)). Owner: GredesCerber (Claude executor). Date: 2026-11-25.

**Question.** Which step-by-step scripts for lectures 1 to 3 explain each idea and formula and link to the right station presets?

**Deliverables.**
- The scripts `spikes/visual-foundation/lectures/L01.json`, `L02.json` and `L03.json`, now `"status": "ready"`, with 20, 8 and 12 steps. They replace the drafts, which had 7, 3 and 4 steps.
- Their Russian text in `spikes/visual-foundation/i18n/ru/lectures/L01.json` … `L03.json`.
- `spikes/lecture-walkthroughs-probability/`: `inventory.json` maps every formula and worked example of the lectures to a step, or gives a reason for skipping it. `expected.json` lists the station readouts each step states. `walkthroughs.test.mjs` (`node --test`, 5 tests) checks both against the scripts and the kernels.
- The browser specs that opened steps by number (`lectures`, `combinatorics`, `bayes-tree`, `story`, `bernoulli`) now point to the new step numbers.

## Sources and format

- **Fact.** The lectures are `lectures/L01.pdf`, `L02.pdf` and `L03.pdf` on the `course-lectures` branch, commit `8dfee73`. The text was extracted with pypdf, and the PDFs are not copied to `main`. The independent audit [`lecture-worked-examples-audit.md`](lecture-worked-examples-audit.md) (#42) lists every evaluated example with recomputed values. The scripts use its values, and the two agree.
- **Fact.** The step format is the one from #50 ([`lecture-walkthrough-host.md`](lecture-walkthrough-host.md), `spikes/visual-foundation/lectures/README.md`). Each step has one idea, its formula lines in TeX, an optional worked example, teacher notes (shown in presenter mode) and an experiment link `{station, seed, params, label}`.
- **Fact.** Language. The issue asks for Russian scripts with English identifiers. Since #50 the lab is Russian by default and translates every lecture text through `i18n/ru/lectures/LNN.json`, and `npm test` fails on any untranslated text. So the scripts are written in both languages: English in `lectures/`, Russian in `i18n/ru/lectures/`, one pair per text. A teacher sees the Russian text. Formula lines with words have Russian twins.
- **Fact.** Every step that opens a station states, in its notes, what the station shows for that seed: the exact value and the simulated frequency. A teacher can say "you should see 0.4792" before opening it.

## Coverage (AC1)

| Lecture | Steps | Numbered formulas | Worked examples covered | Skipped, with reason |
|---|---|---|---|---|
| L1 | 20: random events, history, events and operations, axioms, consequences, independence, counting (2 steps), urn scheme, combinations with repetition, binomial, classical, ex. 7, hypergeometric, polynomial coefficients, balls in boxes, geometric, Bertrand, statistical, check questions | (1)–(5) | Intro ex. 1–4; combinatorics ex. 1–8; balls in boxes n = 5; geometric ex. 1–2; 450 heads in 1000; Buffon and Pearson | The sponge analogy for the σ-algebra (no formula). The general sums for two and three empty boxes: their patterns need n ≥ 6. Step 16 says so, and the station computes every n exactly. |
| L2 | 8: conditional probability, multiplication, independence (Bernstein), total probability, even face, Bayes, guessing student, check questions | (6)–(10) | Even face (two solutions); guessing student; the r/k picture | Fig. 4 (three ways to draw hypotheses): step 4 states its conclusion. |
| L3 | 12: Bernoulli formula, vanishing terms, most probable number, ex. 1, ex. 2, local theorem, integral theorem, ex. 2b by the integral theorem, the central band, Poisson, Bernoulli's theorem and sample size, check questions | (11)–(20) | Ex. 1; ex. 2a and 2b; the solved local and integral examples; P(40 ≤ k ≤ 60); typos; coin sample size | Fig. 5 (the station draws it live). Appendix tables 2–4: the stations compute the functions exactly. |

- **Fact.** `walkthroughs.test.mjs` checks this table. Each formula number (1)–(20) appears in the formula lines of the step the inventory names. Each inventory item points to an existing step or carries a reason. Each content step is claimed by an item.
- **Fact.** Each script ends with a "Check yourself" step: three questions in the example and the answers in the teacher notes. The answers were computed independently (for example, L3 Q2: exact 0.7063, normal 0.6827 without correction and 0.7063 with it).
- **Fact.** Two small examples were added where the lecture states a rule without a number. L2 step 2 uses two aces from 36 cards: 1/105. L2 step 3 uses Bernstein's tetrahedron, which the lecture only cites.

## Experiments and expected readouts (AC2)

27 steps open a station: 13 in L1, 5 in L2 and 9 in L3. They use `events`, `combinatorics`, `urn`, `darts`, `frequency`, `conditional`, `bayes`, `bayes-tree` and `bernoulli`.

- **Fact.** For each of them, `expected.json` holds the readouts the step states (83 checks in all). The test runs the station's kernel with the step's seed and params, and checks four things: every param key is declared by that station; the run is deterministic; each readout matches its stated value to the stated digits; and the stated text appears in the step.
- **Fact.** The `bernoulli` kernel is the one merged for #39 (PR #174), and the L3 steps use its parameters (`n`, `p`, `k`, `lo`, `hi`, `R`, `view`). The `urn` kernel (#38) is in its own PR. Until it merges, the test reports those steps as "not landed yet" instead of failing. With it in place, all 5 tests pass.
- **Fact.** Other checks pass too: `npm test` in `spikes/visual-foundation` (66 tests, including the KaTeX and Russian-translation checks), and the Playwright specs that touch lectures 1–3 (`lectures`, `combinatorics`, `bayes-tree`, `conditional`, `story`, `i18n`, `bernoulli`: 34 tests, Chromium, 1280×720).

## Correctness pins (AC3)

| Pin | Step | What the step says |
|---|---|---|
| Combinations with repetition | L1 step 10 | The correct value is C(n+k−1, k). The lecture's C(n+k−1, k−1) counts n identical balls in k boxes. The example has n = 2, k = 3: 4 multisets but 6 placements. A note adds that counted multisets are not equally likely (1/4, not 1/2). |
| Bertrand | L1 step 18 | Three schemes give 1/2, 1/3 and 1/4. The lecture's "the answer is 0.5, because it is the largest" is named and rejected. |
| L3 ex. 2 | L3 steps 5 and 8 | 0.0566, not 0.0572. The mode is 50, not 51. 0.5375, not 0.5033. The plain integral formula gives 0.5 and the continuity correction gives 0.5283. Step 9: the rough 0.7 for 40 ≤ k ≤ 60 is really 0.8652. |
| Φ conventions | L3 step 7 | Here Φ is counted from −∞. Lectures 9 and 12 use Φ₀ = Φ − 0.5 and erf, and mixing them shifts answers by 0.5. |
| L2 guessing student | L2 step 7 | (1 − p)/(4p + 1). The printed p/(4p + 1) in the last line is a typo. |
| L3 ex. 1 | L3 step 4 | The worded question (five days in a row, 0.2373) and the computed one (5 of 7, 0.3115) are both shown. |

`walkthroughs.test.mjs` checks that each of these steps states the correct value and names the lecture's version.

## Position

**Assumption — what I propose:**

1. Keep one step per idea, even when the lecture packs several ideas on one page. This gives 20 steps for L1, which is long but readable. The drawer lists every step by title, so a teacher can jump to any of them.
2. Put the expected station readout in the teacher notes. Keep the student-facing example to the lecture's own numbers. The machine-checked copy lives in `expected.json`, so a kernel change that moves a value fails a test.
3. Keep the English and Russian texts as pairs written together. The Russian is the teaching text, and the English keeps the code and the specs readable.

**What I am unsure of:**

- Whether the owner wants the historical step (L1 step 2) to show all thirteen portraits. Now it shows Pascal and Fermat, and the other names stay in the lecture's list.
- The lesson language is still open in `docs/decisions.md`. If the lab becomes Russian-only, the English text can be dropped without touching the step structure.
- The stated frequencies hold for the step's seed only. Every one is inside its predeclared band, but if a teacher changes the seed in class, the frequency lands somewhere else in the band.
