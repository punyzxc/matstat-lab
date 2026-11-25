# Scientific decision register

Issue #30. Question: which scientific choices from the merged research are decided, which are deferred, and who confirms each?

Sources, all merged into main on 2026-11-24:

| Note | Task | Topic |
| --- | --- | --- |
| [simulation-engine.md](simulation-engine.md) | #14, Jumalinova | Worker and convergence |
| [visual-accessibility.md](visual-accessibility.md) | #6, adekin06 | Independent scientific acceptance and Worker budgets |
| [explorer-chart.md](explorer-chart.md) | #4 | Snapshots |
| [inference-methods.md](inference-methods.md) | #15 | Estimators and intervals |
| [comparison-compatibility.md](comparison-compatibility.md) | #22 | Comparing saved runs |
| [functional-contract-draft.md](../functional-contract-draft.md) | shared draft | Numerical semantics |

The statistical engine research (#13) is still open. Every row that depends on it is marked as such. Line numbers refer to main at merge `f8daf7b`.

**Status meanings**

- **Decided:** a person confirmed it, and it is recorded in [decisions.md](../decisions.md).
- **Ready to confirm:** the notes agree and no note contradicts it. It only needs the named person's yes.
- **Conflict:** the notes disagree, and one person must choose.
- **Deferred:** evidence is missing. The row names what is missing.

## Ready to confirm (the notes agree)

| # | Choice | Value | Sources | Confirms |
| --- | --- | --- | --- | --- |
| R1 | Variance divisor | Default `n−1` (ddof = 1), undefined at n = 1. The plug-in divisor `n` is available but always labeled. CLT spread across replicate means uses `R−1` | simulation-engine L38, visual-accessibility L39, inference-methods (estimator table) | Statistics owner (GredesCerber, #13) |
| R2 | Histogram bins | Half-open `[a, b)`, last bin closed. Underflow and overflow are counted. Density uses total n | functional-contract-draft L20, explorer-chart L6, comparison-compatibility | Statistics owner |
| R3 | ECDF | Right-continuous fraction at or below x | explorer-chart L6, comparison-compatibility | Statistics owner |
| R4 | Exact equality | Counts, degrees of freedom, integer RNG words, schema versions and array lengths compare exactly | visual-accessibility L46 (simulation-engine L20 is consistent with it: its 1e-12 comparator cannot pass unequal integer counts) | QA owner (adekin06) |
| R5 | No per-run truth claims | Do not assert that every run's interval covers or that error shrinks at every n. Assert coverage as a proportion with a predeclared band | visual-accessibility L84, inference-methods (coverage) | QA owner |
| R6 | First interval methods | z with known σ (n ≥ 1) and Student t with unknown σ (df = n−1, n ≥ 2), two-sided. Typed failure for degenerate or invalid input | t: visual-accessibility L40 and L63, inference-methods. z with known σ: inference-methods only | Inference owner (to be named) |
| R7 | Replay promise | Exact replay needs the complete RunSpec, engine and RNG versions, reduction order and a pinned runtime. Replay runs only on an explicit user action | simulation-engine L22, explorer-chart L18 | Simulation owner (Jumalinova) |
| R8 | Stale Worker events | Dropped unless the run ID, version, type and increasing sequence match the active run | simulation-engine L48 | Simulation owner |
| R9 | Incompatible saved records | Kept and counted as unreadable, never coerced. Comparison returns an explicit incompatibility | explorer-chart L14, comparison-compatibility | Research-data owner (to be named) |
| R10 | Exponential transform | `−log1p(−u)` on the open-midpoint grid `(word + 0.5)/2³²` | grid: simulation-engine L36, visual-accessibility L75. Transform: simulation-engine L37 only | Statistics owner (also depends on the RNG choice in C2) |

## Conflicts (one person must choose)

| # | Question | Option A | Option B | Note on the choice | Confirms |
| --- | --- | --- | --- | --- | --- |
| C1 | Scalar comparator | `abs ≤ 1e-12 + 1e-12·max(\|a\|, \|b\|)`, which passed every Node/Chrome comparison (largest relative difference 2.65e-16; simulation-engine L20–22) | `abs ≤ 1e-12 + 1e-10·\|ref\|` against reference values, plus an `atol` of 1e-28 for far tails (visual-accessibility L46, L53) | The two serve different purposes. A compares runtimes with each other. B compares results with independent references, such as SciPy or closed forms. A third tolerance exists as well: relative 1e-12 for parameter and edge equality after a documented conversion (comparison-compatibility L39, L41). Proposal: keep all three under explicit names (`replayComparator`, `referenceComparator`, `conversionTolerance`) | QA owner with the simulation owner |
| C2 | Seed 0 | Valid: seeds are 0 through 2³²−1 (simulation-engine L30) | Rejected, because the xorshift specimen cannot take 0 (visual-accessibility L78) | It depends on the production RNG. A counter-based generator can accept 0. Keep the full range as the public contract, and let the RNG map seeds internally | Statistics owner when #13 chooses the RNG |
| C3 | Monte Carlo acceptance band | 6·SE around the mean (simulation-engine L114) | Exact binomial region at α = 0.001 for coverage, and 4·SE for oracle checks (inference-methods) | Different statistics need different bands. The real open point is the suite-wide false failure rate. #32 owns this | QA owner through #32 |
| C5 | Cancel deadline | A 1 s fallback timer that then terminates the Worker (simulation-engine L56) | The Worker closes within 500 ms (visual-accessibility L102) | Proposal: 500 ms as the test budget, with the 1 s timer as the last-resort terminate | Simulation owner with the QA owner |
| C6 | Benchmark environment | i5-12500H, Node 24.15, Chrome 157 (simulation-engine L60) | i5-13420H, Node 26.13 locally, Edge 158, and Node 22 in CI (visual-accessibility L90, L92) | Budgets measured on different machines do not compare. Name one baseline runner (this feeds D5) | QA owner |
| C7 | Non-Normal data in a Normal-theory interval | Warn and compute (inference-methods L82, L129) | Refuse | The notes propose "warn" only. Listed here because the choice is open and user-visible | Inference owner (to be named) |
| C8 | Algorithm version and cross-model comparisons | `algorithmVersion` must match exactly, and comparisons across models are refused (comparison-compatibility L123) | An equivalence table, and a separate cross-model mode | Open in the source itself | Research-data owner with GredesCerber (#19) |
| C4 | Normal 0.975 quantile reference | `1.9599639845400536` (visual-accessibility L52) | `1.959963984540054` (inference-methods) | These are about 2 ulp apart, far inside either comparator. They do not change any result. Pin one value in the #13 fixtures | Statistics owner |

## Deferred (evidence is missing)

| # | Topic | Missing | Owner or task |
| --- | --- | --- | --- |
| D1 | Production RNG, seed encoding and consumption order (including cached normals) | A selection with independent vectors | #13 (GredesCerber) |
| D2 | Per-function tolerances across runtimes | Functions from #13 measured on Node and Chrome | #13 with QA |
| D3 | Pinned SciPy and NumPy reference fixtures | A run on a pinned SciPy. The notes used documented values (visual-accessibility L19). One recalled value was already wrong by 2.4e-9 (inference-methods) | #13 |
| D4 | Maximum N, and the full or summary-only mode | A product decision on caps. The proposals are n·R ≤ 2,000,000 (simulation-engine L31) and N up to 10⁷ summary-only for the cancel test (visual-accessibility L102) | Product owner (punyzxc) |
| D5 | Memory and timing budgets | A calibrated runner. The current numbers come from two different machines (see C6) | QA owner with the simulation owner |
| D6 | Supported browsers and hardware | Firefox, Safari and ARM are not measured | Product owner |
| D7 | Storage quotas and retention, crash and unload recovery | Measurements on supported browsers | Research-data owner |
| D8 | Snapshot fields that comparisons need | Units, series kind, histogram normalization, ECDF scale and statistic definitions | #29 |
| D9 | Suite-wide false failure rate and mandatory cases | A correction rule and a case list | #32 (adekin06) |
| D10 | Convergence lesson fixtures | Default distributions, n values and seeds | #33 (Jumalinova) |
| D11 | Lecture alignment | The course PDFs were not found in the workspace | Product owner |

## Decided

Only the rows in [decisions.md](../decisions.md) are decided. This task adds one entry there: the interim merge rule while GitHub Actions is locked. No scientific row above is marked decided, because no owner has confirmed one yet.

## What this closes in the Discovery exit criteria

- "Record resolved or explicitly deferred scientific decisions, including replay bounds and interval eligibility." This register lists every choice with a status. Replay is covered by R7 and R8, and interval eligibility by R6. The criterion closes when the named people confirm R1–R10 and choose C1–C8. Until then it stays unchecked.
- The other exit criteria still need people:
  - confirming the remaining owners, including the inference and research-data owners and pluxha's access. pluxha owns #31 but has not yet accepted the repository invitation
  - the maintainer review in #16 and the scaffold in #31
  - the reviewed PRD on main

## Position

1. Confirm R1–R10 as they stand. They are consistent across independent notes, and each has a named confirmer.
2. Resolve C1 by keeping named comparators rather than choosing one. Take 500 ms for C5 and name one baseline runner for C6.
3. Leave C2 until #13 selects the RNG, but keep the public seed range at 0 through 2³²−1.
4. Let #32 settle C3.

The deferred rows block the PRD only where they set numbers in acceptance criteria: D1–D5. *Assumption:* the "to be named" inference and research-data owners will be named by the captain. The register does not assign them.
