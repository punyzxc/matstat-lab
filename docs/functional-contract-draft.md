# Shared experiment contract proposal

Status: Discovery proposal. Tasks #4, #6, #13, #14 and #15 validate and refine it independently.

## Requests, committed snapshots and chart data

| Boundary | Proposed fields and behavior |
| --- | --- |
| RunSpec | Run ID, experiment ID, module ID, labeled distribution parameters, sample size, repetitions, unsigned seed, PRNG version, algorithm version, method options and resource limits. Each outer request is validated before drawing. |
| Worker events | Run ID, monotonically increasing sequence, state, completed/total work, phase, optional typed partial summary, error code or committed snapshot. IDs disambiguate cancelled and replacement runs. Only completed snapshots reach the journal. |
| ExperimentSnapshot | Schema version, experiment and module IDs, complete RunSpec, method and version references, captured result time, execution metadata, warnings with applicability codes, empirical and theoretical measures, chart payloads, optional retained data, and truncation policy. Retention is explicit and stable across export and reload. |
| Chart payload | Series discriminant and units rather than rendering instructions. Histogram edges, counts, normalization and overflow. ECDF grouped x values and cumulative counts. PMF is discrete mass. PDF is continuous density. Running means carry prefix n and replicate ID. Intervals carry estimates, lower and upper bounds and coverage flags. |
| Journal | Versioned IndexedDB records keyed by experiment ID. A module's latest result is ordered deterministically among completed results. Renames and deletions commit consistently with latest-result lookup. Unsupported versions preserve original records. |
| Adapter | The UI requests a run using RunSpec, subscribes to progress and asks for last results by module. Saved chart payloads render with no fresh simulation. CSV exports only retained series. The JSON envelope preserves parameters, values and provenance. Reports expose method narrative and applicability. |

## Proposed numerical semantics

- Normal uses mean and standard deviation, Uniform uses finite ordered endpoints, Exponential uses rate with explicit conversion to scale, Bernoulli and Binomial use p in [0, 1], Binomial uses nonnegative integer trial count, and Poisson uses nonnegative λ. Zero-variance degenerate discrete laws are valid. Probe endpoint probabilities, large parameters and finite support explicitly.
- Use a documented sample quantile method with pinned fixtures. Report both population and corrected sample variance. The former is defined at n=1 and the latter starts at n=2. Define whether ties yield multiple modes. Pin high-offset stability cases and distinguish undefined output from zero.
- Histograms declare half-open bins with the right endpoint included in the final bin. Excluded draws are counted and density uses the documented total sample n. For comparisons agree on edges and scales before analysis. The ECDF is the right-continuous fraction at or below x. PMF and PDF carry separate tags and units.
- Reproducibility uses a versioned draw order and indexed replicate streams. Exact integer vectors are checked first. Continuous floating-point comparator and tolerances are set from separately recorded reference cases. Batch timing and presentation do not change scientific results.
- LLN uses successive prefixes of a trajectory. CLT uses independent replicate means with μ and σ²/n reported under finite variance. The normal approximation is explicit.
- Estimation methods state the true target, sample formula, estimate variance denominator and MSE. The initial interval candidates for i.i.d. Normal data use z with known σ and Student t with unknown σ and n ≥ 2. Unmet assumptions produce a structured warning or inapplicability. The coverage check fixes nominal p, R and a binomial-based band before seeing results. Use successes divided by R and report Monte Carlo uncertainty.
- For the later sign test, define a continuous null median, specify tail selection and tie handling, and compare exact probabilities to a binomial reference. Estimate power under a named alternative, with Monte Carlo error.

Each teaching module records its question, distribution and assumptions, formulas, controls, expected pattern, limitation, and a conclusion prompt. The common workbook scenario changes n while holding the model fixed. Primary course PDFs were not located among the supplied workspace materials. Treat lecture alignment as pending.

[Independent SciPy distribution and inference APIs](https://docs.scipy.org/doc/scipy/reference/stats.html)
