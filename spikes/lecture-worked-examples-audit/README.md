# Independent lecture worked-example audit (#42)

Research only. Calculations use Python's standard library, independent of all project kernels and lecture tables. The main deliverable is [the audit report](../../docs/research/lecture-worked-examples-audit.md).

From the repository root:

```powershell
python spikes/lecture-worked-examples-audit/test_audit.py
python spikes/lecture-worked-examples-audit/build_references.py --check
python spikes/lecture-worked-examples-audit/build_report.py --check
```

`fixtures/references.json` contains grouped expected values, source URL/page/line, printed answer, independent result, method, input parameters when relevant, Phi convention, verdict and limitations. `reusable:false` explicitly excludes invalid/ambiguous data from numerical acceptance oracles. A corrected group may retain a correct final answer while correcting an intermediate formula. Diagnostic inputs not assigned by the lecture are labeled as such. `fixtures/errata.json` audits all 15 existing correctness pins. The report table rounds for readability; JSON preserves the computed binary64 outputs.

To regenerate intentionally, omit `--check`. Review every numerical diff; do not regenerate fixtures just to make a failing kernel pass. Quantiles/integrals here are verified finite-case references, not a proposed production special-function implementation. Exact rational/binomial computations and continuous approximations have distinct precision claims in the report.

## Original sources

The PDF sources live only on the `course-lectures` branch, pinned at `8dfee73781e39d6946d76c07866f2a0534a3d988`. Never merge that branch or copy its PDFs into main. To verify provenance:

```powershell
git fetch origin course-lectures
python spikes/lecture-worked-examples-audit/extract_sources.py --check
```

Only the extraction check requires `pypdf` (version recorded in `fixtures/source-manifest.json`). Use the bundled runtime or an existing compatible environment. The script reads Git blob bytes without checking out/merging the source branch, verifies the manifest's 12 hashes/page counts and each fixture's page/line range, and writes numbered local text/PDFs under ignored `.crew/lecture-sources/`. Line references are tied to that extractor version. PDF page links remain usable without Python or a local extraction.

The initial tests failed with the missing calculator, then exposed an empty-box support-length bug, which was fixed in the calculator. The final checks verify exact rational small-binomial cases, exhaustive occupancy counts, the three distinct Phi functions, analytic quantile special cases, tails, both sample-variance divisors and fixture provenance.
