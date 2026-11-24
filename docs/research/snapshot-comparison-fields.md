# Snapshot fields that comparisons need

Issue #29. Question: which fields must the next `ExperimentSnapshot` version add, so that comparisons and exports never guess, and how do version 1 records migrate?

This note builds on two merged notes:

- [explorer-chart.md](explorer-chart.md) (#4) defines snapshot versions 0 and 1.
- [comparison-compatibility.md](comparison-compatibility.md) (#22) lists the metadata a comparison needs and marks five gaps.

A throwaway decoder with migration and 8 `node:test` cases is in [`spikes/snapshot-comparison-fields/`](../../spikes/snapshot-comparison-fields/). It is not product code. It reuses both merged spikes directly: the v1 codec validates the shared core, and the #22 comparator checks the decisions. Run `node --test snapshot-v2.test.mjs` from that folder (Node 24).

## Facts

- **What version 1 stores, and what it lacks.** Version 1 stores the distribution kind and parameters, seed, sample size, RNG and algorithm versions, histogram `edges`/`counts`/`underflow`/`overflow`, ECDF `x`/`cumulativeCounts`, and `retained` values. It has no axis units, no series kind discriminant, no histogram normalization tag, no ECDF scale and no statistic definitions. [explorer-chart.md](explorer-chart.md) · `spikes/explorer-chart/snapshot.mjs`
- **What the comparator needs.** The comparator refuses a pair when a required field is missing (`missing-metadata:<field>`). It reads units, the series kind, the histogram normalization, the ECDF scale, the variance divisor and the quantile method. [comparison-compatibility.md](comparison-compatibility.md), "Required metadata"
- **Why the divisor and the method must be stored.** NumPy names the variance divisor through `ddof` and offers several quantile methods that give different values on the same data. [numpy.var](https://numpy.org/doc/stable/reference/generated/numpy.var.html) · [numpy.quantile](https://numpy.org/doc/stable/reference/generated/numpy.quantile.html)
- **Shared rules from the decision register (#30).** The variance divisor defaults to n−1 and is always labeled (R1). Histogram counts are validated against the retained values (R2). Incompatible records are kept and counted, never coerced (R9). [scientific-decision-register.md](scientific-decision-register.md), which is under review in the #30 PR.
- **Verified in the spike.** All 8 tests pass:
  - a native version 2 record decodes unchanged
  - version 0 and version 1 records migrate without mutating their input
  - version 3 is reported as unsupported
  - six kinds of corrupt version 2 records are rejected, including a wrong histogram count in the shared core
  - a migrated record with unknown units is refused by the #22 comparator
  - two native version 2 records that differ only in seed compare without transforms

## Fields added in version 2

| Field | Type and allowed values | Needed by | Version 1 → 2 migration |
| --- | --- | --- | --- |
| `axis.units` | one of a closed vocabulary (spike: `1` for dimensionless, `s`, `min`, `h`, `cm`, `m`, `kg`), or `null` | comparison (unit map, parameter rescaling), export headers | **`null` (unknown).** Version 1 never recorded units, and "dimensionless" would be a guess |
| `series.histogram.kind` | `'histogram'` | comparison (series kind), renderer adapter | `'histogram'`, derived from the key name |
| `series.histogram.normalization` | `'count'` \| `'relative'` \| `'density'` | comparison (scale), export | `'count'`. The version 1 codec checks counts against the retained values, so this is a fact |
| `series.ecdf.kind` | `'ecdf'` | comparison, renderer adapter | `'ecdf'` |
| `series.ecdf.scale` | `'count'` \| `'fraction'` | comparison (`normalize-ecdf`) | `'count'`. Version 1 stores `cumulativeCounts` |
| `statistics.varianceDenominator` | `'n'` \| `'n-1'` \| `'not-reported'` \| `null` | comparison, report labels | `'not-reported'` if version 1 reported no variance or SD, otherwise **`null` (unknown)** |
| `statistics.quantileMethod` | `'hf1'` … `'hf9'` (Hyndman–Fan type) \| `'not-reported'` \| `null` | comparison, report labels | `'not-reported'` if version 1 reported no quantile, otherwise **`null`** |
| `migratedFrom` | `0` \| `1`, absent on native version 2 records | audit, export | set by the migration |

Rules for these fields:

- `null` always means "unknown". The comparison view passes it through, so the #22 comparator refuses with `missing-metadata`.
- A migration never writes a default that changes the meaning of a record.
- `not-reported` means the statistic is not in the record, so its definition does not matter.

## Expected decoder results

| Input | Expected |
| --- | --- |
| Native version 2, all fields valid | `ok`, unchanged, `migrated: false` |
| Version 1 fixture (reports a mean only) | `ok`, `migrated: true`: units `null`, normalization `count`, ECDF scale `count`, both statistic fields `not-reported` |
| Version 0 fixture | `ok`, `migratedFrom: 0`. The input object is not changed |
| Version 1 that reports a variance | the variance divisor is `null` |
| Version 3 | `unsupported-version` |
| Version 2 with an unknown unit, a missing `axis`, an unknown normalization, a wrong ECDF kind, an unknown quantile method, or a wrong histogram count | `invalid-snapshot` |

## Assumptions and open points

- *Assumption:* a closed unit vocabulary is enough for the first release. The lessons use dimensionless values, and time units appear only in the Exponential examples. A free-form unit string would weaken the comparison check.
- *Assumption:* the quantile method is named by its Hyndman–Fan type rather than by a library name. That keeps it independent of NumPy's method names.
- **Follow-up for the production comparator.** The #22 spike treats any two different divisor values as convertible. With `not-reported` added, a pair of `n-1` and `not-reported` must not produce a `variance-denominator` transform. The variance is simply absent on one side. The spike comparator does not yet handle this. This is recorded for the production task, and is not fixed in the throwaway spike.
- The spike validates the new fields only for one histogram and one ECDF, as the version 1 spike does. Typed series for each module (PMF and PDF, convergence trajectories, intervals) need the same `kind` discriminant. The statistics engine (#13) and the convergence fixtures (#33) should add them.

## Position

Add these fields as snapshot version 2. Migrate version 0 and version 1 records:

- Fill the series kind, normalization and ECDF scale, which are facts derivable from what version 1 stored.
- Store units and any statistic definition that version 1 used but did not name as `null`.
- Keep comparisons refusing on `null`. Users can still open and export old records, but they cannot compare them until a person sets the units.

I am least sure about the unit vocabulary and about letting a person edit units on an old record later. That would be a user-visible, logged metadata change. The research-data owner should decide it.
