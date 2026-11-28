# A controlled classroom comparison of sample sizes

**Fact — scope:** this answers [Discovery task #19](https://github.com/GredesCerber/matstat-lab/issues/19): which controlled sample-size comparison and which fixed seeds teach students to tell **single-run variation** apart from **expected estimator error**. The evidence is a throwaway fixture in [`spikes/teaching-comparison/`](../../spikes/teaching-comparison/). It contains no product code and no visual work, and it is separate from the distribution implementation (#13, T6/T8) and from QA fixture coverage.

**Fact — how the evidence was made:** [`comparison.mjs`](../../spikes/teaching-comparison/comparison.mjs) generates the lesson's draws and metrics in plain JavaScript. [`generate_reference.py`](../../spikes/teaching-comparison/generate_reference.py) is an independent Python re-implementation (NumPy 2.5.3, SciPy 1.18.1, Python 3.13) that shares no code with it. It writes [`reference.json`](../../spikes/teaching-comparison/reference.json). [`comparison.test.mjs`](../../spikes/teaching-comparison/comparison.test.mjs) holds 3 `node:test` cases, one per acceptance criterion, and they pass on Node 22.23.5. `python -I generate_reference.py --check` fails if any value changes.

## The lesson design

| Choice | Value | Why |
|---|---|---|
| Model | Exponential, rate λ = 1: mean 1, variance 1, skewness 2 | **Fact:** it is skewed and its mean equals its SD, so error is easy to read on one axis ([NIST 1.3.6.6.7](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3667.htm)). It is one of the six models in the brief. **Assumption:** skew makes small samples visibly misleading (see the findings), which is what the lesson is about. |
| Sizes | n = 10 and n = 100 | **Assumption:** a factor of 10 is the smallest change where the expected error visibly changes (RMSE drops from 0.316 to 0.100), while n = 100 still leaves a sizable chance that a single run gets worse. |
| What varies | **only n**: same model, same parameter, same sampler, same seed, same histogram edges | This is the controlled comparison the task asks for. |
| Estimator | the sample mean x̄, error |x̄ − 1| | **Fact:** for i.i.d. data E[x̄] = μ and Var(x̄) = σ²/n, so RMSE = σ/√n ([Casella & Berger, §5.2](https://www.routledge.com/Statistical-Inference/Casella-Berger/p/book/9781032593036)). |
| Draws | **independent** by default; nested as a named variant | See the next section. |
| Sampler and stream | inversion, one uniform per draw (#13); counter-based mixer addressed by (seed, stream, index) as in the #14 fixture | One uniform per draw keeps each sample addressable and replayable. **Assumption:** the mixer is a fixture stand-in until #14 and #13 pin the production RNG. When they do, the seeds below must be re-chosen and this table re-recorded. |

### Nested or independent draws

- **Fact — independent design:** replicate r draws the n = 10 sample from stream 1 + 2r and the n = 100 sample from stream 2 + 2r. The two samples share no draw, and the test checks this.
- **Fact — nested design:** replicate r uses stream 2²⁰ + r for both sizes. The n = 10 sample is exactly the first 10 draws of the n = 100 sample, and the test checks this too. In this design the two means are correlated, with corr(x̄₁₀, x̄₁₀₀) = √(10/100) ≈ 0.32 under i.i.d. draws.
- **Assumption — recommendation:** use **independent** draws in this lesson. The question is "if I run a bigger experiment, will my estimate be better?", and two separate experiments answer it. Nested draws answer a different question, "what happens when I keep collecting data?", which is the running-mean trajectory in the Convergence Laboratory (LLN). Mixing the two in one lesson blurs the distinction the lesson is meant to teach. The UI must say which design is in use, for example "Two independent samples" or "The first 10 of the same 100 draws".

## The protocol (about 20 minutes)

1. **Prediction (before any run).** Each student answers: "Two classmates each sample the same skewed distribution, true mean 1. One takes 10 values, the other 100. Whose sample mean will be closer to 1?" Options: "always the 100", "usually the 100", "it is a coin flip", "usually the 10". Then: "Out of 10 such pairs, how many times will the 10 win?"
2. **One run on the projector, seed 1.** Show both histograms and both ECDFs on **shared scales** (see below), with the theoretical PDF and CDF. The larger sample is closer: |x̄ − 1| is 0.163 for n = 10 and 0.051 for n = 100.
3. **The counterexample, seed 4.** Same model, same edges, a different seed. Now the larger sample is **further** from the truth: 0.107 for n = 10 against 0.179 for n = 100. Ask: "Did the law of large numbers fail?"
4. **Class tally.** Pairs of students run seeds 1 to 30 (one seed per pair) and report whether the 10 or the 100 won. The projector collects the tally. The fixture records that seeds 4, 5, 7, 14, 15, 20, 22, 24, 26 and 30 are counterexamples: 10 of 30.
5. **Repeated sampling.** One button runs R = 1000 independent replicates of both sizes under seed 1. Replicate 0 is exactly the run from step 2, so the projector run reappears as one dot among 1000. Show the two distributions of x̄ on a shared axis, with RMSE and mean absolute error beside the theory.
6. **Conclusion.** The class writes, in their own words, a sentence close to the one below, and compares it with their prediction from step 1.

**Assumption — the conclusion to aim for:** "A larger sample makes the estimator's *expected* error smaller: here RMSE falls from 0.32 to 0.10. Any *single* run can still go the other way: with n = 10 against n = 100 this happens in about 1 run in 5. One run shows variation; the error of a method shows only across many runs."

## Fixtures: seeds, expected metrics and the counterexample

All values below are in `reference.json`, computed independently in Python, and replayed by the Node test. Floats agree within a relative 10⁻¹². Histogram counts, overflow and the verdict agree exactly.

**Fact — single runs (edges 0, 0.5, …, 7; overflow above 7):**

| Design, seed | n | x̄ | abs. error | sample SD (n−1) | KS distance to the CDF | histogram counts | larger n closer? |
|---|---:|---:|---:|---:|---:|---|---|
| independent, 1 | 10 | 0.83697 | 0.16303 | 0.336 | 0.392 | 1, 7, 1, 1, 0… | **yes** (typical) |
| | 100 | 0.94863 | 0.05137 | 0.876 | 0.066 | 35, 30, 18, 6, 4, 3, 2, 1, 1, 0… | |
| independent, 4 | 10 | 0.89270 | 0.10730 | 0.656 | 0.237 | 3, 3, 2, 1, 1, 0… | **no** (counterexample) |
| | 100 | 0.82092 | 0.17908 | 0.801 | 0.117 | 47, 22, 17, 5, 2, 6, 0, 0, 0, 1, 0… | |
| nested, 1 | 10 | 0.53046 | 0.46954 | 0.563 | 0.375 | 6, 1, 2, 1, 0… | yes |
| | 100 | 0.82676 | 0.17324 | 0.856 | 0.137 | 52, 15, 20, 4, 2, 3, 1, 2, 1, 0… | |
| nested, 9 | 10 | 0.97273 | 0.02727 | 0.507 | 0.339 | 1, 6, 0, 3, 0… | **no** (counterexample) |
| | 100 | 0.94770 | 0.05230 | 0.925 | 0.071 | 43, 21, 13, 9, 5, 5, 2, 1, 1, 0… | |

- **Fact — how the seeds were chosen:** a scan from seed 1 upward. Seed 1 is the first typical run in both designs. Seeds 4 (independent) and 9 (nested) are the first counterexamples. They were not hand-picked for drama, and the document says so to avoid any suggestion of cherry-picking.
- **Fact — what seed 4 shows besides the mean:** the n = 100 sample has the **worse** mean but the **better** shape. Its KS distance to the CDF is 0.117 against 0.237. A single run can improve one quantity and worsen another. **Assumption:** this is a useful follow-up question: "Which picture looks more like the theory, and does that agree with the mean?"
- **Fact — small skewed samples hide the tail:** in all four n = 10 samples above, the largest draw is below 2.3 and the sample SD is between 0.34 and 0.66, while σ = 1. The n = 100 samples reach 4.1 to 4.9. This is an observation on four runs, not a general rate.

**Fact — repeated sampling, seed 1, R = 1000 replicates per size (replicate 0 is the step 2 run):**

| Design | n | observed RMSE | theory σ/√n | observed E\|x̄ − 1\| | theory | share of replicates where n = 100 is worse |
|---|---:|---:|---:|---:|---:|---:|
| independent | 10 | 0.3122 | 0.3162 | 0.2492 | 0.2502 | 0.200 |
| | 100 | 0.1015 | 0.1000 | 0.0823 | 0.0797 | |
| nested | 10 | 0.3328 | 0.3162 | 0.2569 | 0.2502 | 0.183 |
| | 100 | 0.1009 | 0.1000 | 0.0809 | 0.0797 | |

- **Fact — the theory column:** x̄ of n Exponential(1) draws is Gamma(shape n, rate n). Its mean absolute deviation is 2nⁿe⁻ⁿ/n!, which is 0.250220 for n = 10 and 0.079722 for n = 100. SciPy's numerical `gamma.expect` gives the same values to within 1.3×10⁻¹⁰. RMSE is 1/√n.
- **Fact — how often the counterexample happens:** for independent, centered, normally distributed errors A and B, P(|A| > |B|) = (2/π)·atan(sd_A/sd_B). With sd ratio √(10/100) this is **0.19498**. Over seeds 1 to 20 000, the fixture's independent design gave 3896 counterexamples (0.1948, Monte Carlo SE 0.0028), in agreement. The test checks this agreement with a 4-SE band declared before the run. **Assumption:** the normal approximation is close here even though x̄₁₀ is visibly skewed. The test passing is evidence for this design only, not a general rule.
- **Fact — the class tally is itself variation:** 10 of 30 seeds (33%) are counterexamples in the independent design, against an expected 19.5%. Under Binomial(30, 0.195) a count of 10 or more has probability of about 5%. **Assumption:** this is worth saying aloud in class. The tally is one more single run, and it is a second chance to make the lesson's point.

## Charts: shared scales, prediction and conclusion

- **Assumption — shared scales:** both histograms use the same edges, 0 to 7 in steps of 0.5, with overflow counted. The edges come from the model, not from either sample: F(7) = 1 − e⁻⁷, so 0.09% of the mass is overflow. Both use a **density** y-axis (count/(n·width)) with the same y-range, so that n = 10 and n = 100 are comparable and both sit on the same PDF curve. Raw counts would make the n = 100 histogram look ten times taller. The two ECDFs share the x-axis and are drawn over the same theoretical CDF. These follow the histogram and ECDF conventions proposed in [statistical-engine.md](statistical-engine.md).
- **Assumption — shared-scale requirements the fixture checks:** identical edges for both runs, counts plus overflow equal to n, and the same model, seed and sampler. The chart contract (T11) should reject a comparison whose edges differ.
- **Assumption — the prediction prompt:** it is recorded before the first run and shown again next to the conclusion. It has two parts: a categorical guess ("always / usually / coin flip / usually not") and a number ("out of 10 pairs, how many times will the 10 win?"). The number lets the class compare their guess with 0.195 directly.
- **Assumption — the conclusion text in the UI:** next to a single comparison, the UI shows "This is one run. Its error is one draw from a distribution." Next to the repeated-sampling chart, it shows the RMSE values beside σ/√n. The wording keeps "variation" for single runs and "expected error" (RMSE, E|x̄ − μ|) for the estimator, and never uses one word for both.

## Position

**Assumption — what I propose:**

1. Adopt this lesson as the first Estimation Laboratory scenario. Use Exponential(1), n = 10 against n = 100, independent draws, the sample mean, and shared density-scaled edges from the model.
2. Use seed 1 as the default projector run and seed 4 as the named counterexample. Use seeds 1 to 30 for the class tally, and seed 1 again with R = 1000 for the repeated-sampling step. Re-record these values once #13 and #14 pin the production RNG and sampler, because a different stream changes every number here.
3. Show the prediction before the first run and the conclusion next to both kinds of evidence. Label the draw design in the UI.

**What I am unsure of:** whether teachers prefer n = 10 against 100 or a less extreme pair such as 20 against 80 (counterexample rate (2/π)·atan(√(20/80)) ≈ 0.30), which is a question for the captain or a teacher. Whether the nested variant belongs in this lesson at all, or only in the Convergence Laboratory. Whether students read a density axis correctly at n = 10, which this research did not test with students.
