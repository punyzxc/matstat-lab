# Comparing saved experiments on common axes

Issue #22. Question: which scientific metadata makes two saved experiments comparable before they are plotted on common axes?

Scope: this document owns the comparison policy across modules. Serialization and storage belong to #4, and the classroom scenario belongs to #19. The policy reads fields from the `ExperimentSnapshot` proposed in #4. That snapshot exists only in the unmerged [PR #23](https://github.com/punyzxc/matstat-lab/pull/23) (branch `crew/4-research-3h-versioned-experiment-snapsho`, commit `e97724c`) and in the shared contract draft on `preview/discovery` (`docs/functional-contract-draft.md`, commit `702d6c2`). If #23 changes, revisit the "Required metadata" table.

A throwaway comparator with fixture pairs is in [`spikes/comparison-compatibility/`](../../spikes/comparison-compatibility/). It is not product code.

## Facts

- **Raw histogram counts are not comparable across sample sizes.** NumPy's `density=True` divides each count by the number of values inside the range and by the bin width, so that the area integrates to 1 over the range. This makes histograms with different n share a vertical scale. The project contract draft deliberately divides by the total n instead, including draws outside the domain. Then the area shows how much mass fell inside the plotted range. This policy follows the contract, not NumPy, and a production reference check must use the same denominator. [numpy.histogram](https://numpy.org/doc/stable/reference/generated/numpy.histogram.html)
- **Automatic bin edges depend on n.** NumPy's `auto`, `fd`, `sturges` and other estimators compute the bin width from the data size, and some also use its spread. Two runs that differ only in n can therefore get different edges unless the edges are fixed. [numpy.histogram_bin_edges](https://numpy.org/doc/stable/reference/generated/numpy.histogram_bin_edges.html)
- **Bin convention.** In NumPy every bin except the last is half-open, and the last bin includes its right edge. The project contract draft adopts the same rule. It also says that density uses the total sample n, that draws outside the domain are counted separately, and that comparisons must agree on edges and scales before analysis. [numpy.histogram](https://numpy.org/doc/stable/reference/generated/numpy.histogram.html) · `docs/functional-contract-draft.md` on `preview/discovery`
- **The variance divisor is a definition, not a detail.** In `numpy.var` the divisor is `N - ddof`. The divisors n and n−1 give different numbers from the same data. The value with divisor n−1 is undefined at n = 1. [numpy.var](https://numpy.org/doc/stable/reference/generated/numpy.var.html)
- **Sample quantiles have many definitions.** `numpy.quantile` offers several methods that follow Hyndman and Fan (1996), with `linear` (type 7) as the default. These methods give different values for the same small sample. You cannot convert between them from the stored quantile alone. You need the raw data. [numpy.quantile](https://numpy.org/doc/stable/reference/generated/numpy.quantile.html)
- **Exponential parametrization.** SciPy uses `scale = 1/λ`, so the rate and scale forms describe the same law, with an exact conversion between them. [scipy.stats.expon](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.expon.html)
- **ECDFs of different sizes are directly comparable.** An ECDF is a fraction in [0, 1]. The standard two-sample Kolmogorov–Smirnov statistic compares two ECDFs with unequal sizes n and m. [scipy.stats.ks_2samp](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html)
- **What the #4 spike stores today.** It stores IDs, the distribution kind and parameters, seed, `sampleSize`, `rngVersion`, `algorithmVersion`, `schemaVersion`, histogram `edges`/`counts`/`underflow`/`overflow`, ECDF `x`/`cumulativeCounts`, and `retained` with `kind: 'complete'`. It has no axis units, no histogram normalization tag, no explicit series kind discriminant and no statistic definitions (variance divisor or quantile method). See `spikes/explorer-chart/snapshot.mjs` and `fixture.mjs` in PR #23.
- **Verified in the spike.** All 20 fixture pairs return the same decision and transforms in both argument orders. 6 numerical checks and 6 regression checks also pass, 52 `node:test` cases in total. The regression checks come from an independent read of the first draft: parameters with an unknown unit dimension, density heights under a unit change, rebinning, float rounding of converted edges, and malformed metadata. Run `node --test compare.test.mjs` from `spikes/comparison-compatibility` (Node 24).

## Policy for a sample-size comparison

A comparison has one purpose: show the same model at different n. The comparator returns exactly one of three outcomes:

- `compatible`: plot as stored.
- `compatible-after-transform`: plot only after applying the listed transforms. Each transform is exact or documented, and it preserves meaning.
- `incompatible`: do not plot together, and show the listed reasons.

Warnings never change the outcome. They are shown next to the plot.

| Check | Rule | Outcome |
| --- | --- | --- |
| Required metadata present | All fields in the table below are present in both views | missing → `incompatible` (`missing-metadata:<field>@a|b`) |
| Schema version | Both versions are supported by the reader | otherwise `incompatible` (`unsupported-schema-version`). The records are never coerced |
| Module | Same `moduleId` | otherwise `incompatible` |
| Algorithm version | Same `algorithmVersion`, because statistic definitions may differ between engines | otherwise `incompatible`. A future equivalence table can relax this |
| RNG version | It may differ, since the samples are independent anyway | warning `different-rng-streams` |
| Axis units | Equal, or both in a table of exact linear maps (spike: s/min/h). Both sides convert to the table's base unit, so the result does not depend on order | mapped → transform `rescale-units`. Unmapped → `incompatible` (`unit-mismatch`) |
| Model | Same kind, and parameters equal after canonical parametrization (exponential → rate, normal → sd) and after the unit map. Each parameter carries a declared power of the axis unit: min, max, mean and sd have power 1, and a rate has power −1. A parameter with no declared power cannot be rescaled. Equality allows a relative 1e-12 for conversion rounding | equal after conversion → transform `reparametrize:<kind>`. Different → `incompatible` (`parameter-mismatch`). An unknown power under a unit change → `incompatible` (`parameter-unit-unknown`) |
| Series kind | Same discriminant (histogram, ecdf, pmf or pdf). PMF is mass, PDF is density | otherwise `incompatible` (`series-kind-mismatch`) |
| Histogram edges | Identical edges. Otherwise one grid is an exact coarsening of the other (counts only). Otherwise both runs retain complete raw values. Edges compare with the same 1e-12 relative tolerance | coarsening → `merge-bins`. Raw values → `rebin-from-retained`. Otherwise `incompatible` (`histogram-domain-mismatch`) |
| Histogram scale | Counts with different n, mixed normalizations, or any rebinning (which yields counts again) | transform `normalize-density`: `count / (n_total × width)`, where n_total includes underflow and overflow |
| Density under a unit change | A density has units of 1/axis-unit | transform `rescale-density-heights`: divide by the unit factor |
| Outside-domain mass | Any underflow or overflow | warning `mass-outside-domain`: the area under the density is then below 1 |
| Variance divisor | Same divisor, or convert with `s² = σ̂² · n / (n−1)` | conversion → transform. If either n = 1, `incompatible` (`variance-undefined-at-n1`) |
| Quantile method | Same method, or both runs retain complete raw values | recompute → transform `recompute-quantiles`. Otherwise `incompatible` |
| Same seed and RNG, different n | Valid, but the smaller sample may be a prefix of the larger one, so the two are not independent | warning `shared-seed-prefix` |
| Same n | Valid, but this is not a sample-size comparison | warning `same-sample-size` |
| ECDF scale | Fractions compare as stored. The #4 spike stores `cumulativeCounts`, which need an exact division by n when n differs | transform `normalize-ecdf`. A missing or unknown scale → `incompatible` |

The comparator is symmetric: swapping the two runs gives the same outcome and the same transforms. Malformed metadata (a null `statistics`, missing statistic fields, a missing histogram or invalid edges) is an explicit incompatibility, not an exception.

## Required metadata

These fields must be in every snapshot, or derivable from it, before the comparison screen can make a decision. Fields marked **gap** are missing from the #4 spike and need to be added to the snapshot contract.

| Field | Why | In #4 spike |
| --- | --- | --- |
| `schemaVersion` | Refuses unknown layouts | yes |
| `moduleId` | Prevents comparing different lessons | yes |
| `algorithmVersion`, `rngVersion` | Same statistic definitions, and stream provenance | yes |
| `model.kind` + `model.params` + parametrization name | Same law, after the canonical conversion | kind and params yes. The parametrization is implied by key names |
| `sampleSize` (total n) | Density denominator and the n axis itself | yes |
| `seed` | Detects nested-prefix dependence | yes |
| `units` of the observation axis | Linear unit maps, and rescaling of the parameters | **gap** |
| series kind discriminant | Distinguishes PMF from PDF from histogram from ECDF | **gap** (implied by key names) |
| histogram `edges`, values, `underflow`, `overflow`, `normalization` | Common grid and scale | normalization is a **gap** (counts are implied) |
| ECDF `scale` (count or fraction) | Whether division by n is needed | **gap** (counts are implied) |
| `statistics.varianceDenominator`, `statistics.quantileMethod` | Statistic values shown next to plots | **gap** |
| `retained.kind` | Whether rebinning or quantile recomputation is possible | yes (`complete` only) |

## Expected decisions for the fixture pairs

These were written from the policy table above and then checked with `compare.mjs`. All of them match.

| Pair | Difference | Expected |
| --- | --- | --- |
| P01 | only n (counts) | after transform: normalize-density |
| P02 | only n (already density) | compatible |
| P03 | finer grid that nests | after transform: merge-bins, normalize-density |
| P04 | shifted grid, no raw data | incompatible: histogram-domain-mismatch |
| P05 | shifted grid, raw data in both | after transform: rebin-from-retained, normalize-density |
| P06 | different `max` | incompatible: parameter-mismatch |
| P07 | rate 0.5 vs scale 2 | after transform: reparametrize, normalize-density |
| P08 | 0.5/s vs 30/min | after transform: rescale-units, normalize-density, rescale-density-heights |
| P08b | 0.5/s vs 0.5/min | incompatible: parameter-mismatch |
| P08c | cm vs s | incompatible: unit-mismatch |
| P09 | divisor n vs n−1 | after transform: variance-denominator, normalize-density |
| P10 | divisor differs, one run has n = 1 | incompatible: variance-undefined-at-n1 |
| P11 | quantile method differs, no raw data | incompatible: quantile-method-mismatch |
| P12 | PMF vs PDF | incompatible: series-kind-mismatch |
| P13 | schema version 2 | incompatible: unsupported-schema-version |
| P14 | algorithm version differs | incompatible: algorithm-version-mismatch |
| P15 | units missing | incompatible: missing-metadata:units@b |
| P16 | same seed, different n | after transform: normalize-density. Warning shared-seed-prefix |
| P17 | ECDF as cumulative counts, only n differs | after transform: normalize-ecdf |
| P18 | ECDF as fractions, only n differs | compatible |

## Assumptions

- *Assumption:* a comparison is between two runs. Comparing more than two runs means checking each against a reference run with the same rules.
- *Assumption:* parameters are entered and stored exactly. Equality is exact up to a relative 1e-12 after a documented conversion. A parameter grid with rounding would need an explicit tolerance per parameter.
- *Assumption:* the unit table holds only exact linear maps. Affine maps such as °C to °F and non-linear maps are out of scope and stay incompatible.
- *Assumption:* a different `algorithmVersion` means the definitions may differ. If engines publish a changelog of definition changes, an equivalence table can relax this rule.
- *Assumption:* comparisons across models (for example Normal against Uniform at the same n) are a different mode that #19 may want. This policy refuses them and does not define them.

## Limitations

- The 20 pairs and the comparator were written by the same agent in one sitting. That does not fully meet the "independently authored" wording of the third criterion. Independent pairs from the numerical audit in #21, or from a reviewer, should be added before the policy becomes a contract.
- The spike implements the histogram path fully. For ECDF, PMF and PDF it checks only metadata and the series kind. Merging PMFs over a common integer support is not covered.
- Plotting with common axes (ranges and ticks) belongs to the owner's visual work and is out of scope. The comparator only returns `commonEdges` for histograms.

## Position

Adopt the three-outcome comparator as the gate of any comparison screen, with these rules:

1. Always plot densities, never raw counts, when n differs.
2. Fix the histogram edges per experiment configuration and never derive them per run. Then pairs that differ only in n need only `normalize-density`.
3. Keep incompatibility explicit and explained, with no silent coercion.

Before the snapshot contract is accepted, ask #4 to add the five gaps: `units`, the series kind discriminant, histogram `normalization`, ECDF `scale`, and `statistics.{varianceDenominator, quantileMethod}`. Without them, the comparison has to guess.

I am least sure about two points. The first is whether `algorithmVersion` should be strict. The second is whether teachers want comparisons across models, which is #19's call.
