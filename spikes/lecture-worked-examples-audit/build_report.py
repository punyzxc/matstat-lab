from pathlib import Path
from collections import Counter
import json
import sys

HERE=Path(__file__).parent
ROOT=HERE.parents[1]
data=json.loads((HERE/'fixtures/references.json').read_text(encoding='utf8'))
manifest=json.loads((HERE/'fixtures/source-manifest.json').read_text(encoding='utf8'))

pins=[
 ('Bertrand paradox','confirmed','L01-bertrand, L04-bertrand','No unqualified unique answer; three specified schemes give 1/2, 1/3, 1/4.'),
 ('L1 combinations with repetition','confirmed','L01-repetition','Choosing k from n types gives C(n+k-1,k); source argument instead counts allocation of n objects among k boxes.'),
 ('L3 five days / seven trials','confirmed','L03-five-days','Wording and solved event differ; retain both answers and mark the event ambiguous.'),
 ('L3 at most 50 defects','confirmed','L03-binomial-cdf','Exact .537517164966; printed .5033 is incorrect. Plain normal .5 is a separate approximation.'),
 ('L3 coin sample size','confirmed with scope','L03-coin-size','Normal design gives continuous 13529.7361, ceiling 13530. This does not prove an exact finite-binomial minimum.'),
 ('Phi conventions','confirmed with detail','L03-plain-normal-cdf, L06-sigma-3, L09-defects, L09-guarantee, L12-proportion-test','CDF from -infinity, integral from zero, and erf all appear. L9 last example switches conventions within the calculation.'),
 ('L6 three-sigma arithmetic','confirmed','L06-sigma-3, L06-sigma-4','Both tails total .002699796. Also correct the percent row and four-sigma probability.'),
 ('L7 Chebyshev comparison','partly disputed','L07-normal-tail, L07-poisson-bound','Normal .00135 is wrong for a two-sided tail. BUT original PDF says Poisson <=1/9, already correct. No Poisson parameter is specified; the map\'s >= sign and universal .019 implication are unsupported.'),
 ('L5 versus L10 ECDF','confirmed','L05-indicator-jumps, L10-ecdf-jumps','Strict left-continuous convention is valid; L10 counts <= yet calls its function left-continuous.'),
 ('L10 Pearson df','partly disputed','L10-pearson-df, L10-pearson-data','Source explicitly includes fitted-parameter adjustments and uses df=16-2=14 in its example. Actual problems are invalid/incomplete frequencies, omitted tail, wrong expected probabilities and sparse counts.'),
 ('L11 coin numerator','confirmed','L11-coin-null','Printed (.480-.490) does not produce -1.26; (.480-.5) does.'),
 ('L11 22-observation variance','confirmed','L11-sample22','Exact sums 66.7 and 202.81 give corrected variance .027987012987, not .0303.'),
 ('L11 t interval','confirmed with extra error','L11-student-data, L11-student-given','Data-derived interval [2.95764453,3.10599183]. Source p10 additionally substitutes sqrt(.0303/21) instead of sqrt(.0303/22).'),
 ('L11 chi-square variance interval','confirmed','L11-chi-data, L11-chi-given','Recompute quantiles df21: 10.2828978 and 35.4788759. Distinguish raw-data and given-summary versions.'),
 ('L9 approximate answers','confirmed as approximations','L09-defects, L09-first-grade, L09-guarantee','Exact inclusive binomial probabilities differ from the printed normal approximations; both are published and named.'),
]
errata={'source':'docs/research/lecture-module-map.md at 1f4187f2db7e66c8397cc8f5d9a192a59dc84cda, Correctness pins',
        'pins':[dict(zip(['pin','verdict','fixture_ids','evidence'],r)) for r in pins]}


def fmt(v):
    if isinstance(v,float): return format(v,'.10g')
    if isinstance(v,list): return '['+', '.join(fmt(x) for x in v)+']'
    if isinstance(v,dict): return '; '.join(f'{k}: {fmt(x)}' for k,x in v.items())
    return str(v).replace('|','\\|').replace('\n',' ')


def report():
    counts=Counter(r['verdict'] for r in data['values'])
    out=['# Independent audit of lecture worked examples','',
 '**Fact - scope.** Task [#42](https://github.com/punyzxc/matstat-lab/issues/42), by `codex@desktop-8hl5nad`, 2026-11-25. The audit inventories the evaluated numeric worked examples and numerical illustrations across all 12 original course PDFs, and separately classifies parameterized examples without a fixed numerical answer. It publishes '+str(len(data['values']))+' reference groups, not '+str(len(data['values']))+' distinct textbook exercises: some examples contain several outputs, some are duplicated across lectures, and a few rows are explicitly labeled diagnostic instantiations of symbolic examples. Sources: [course index #79](https://github.com/punyzxc/matstat-lab/issues/79), the PDF/page links in the table below, and [reference fixtures](../../spikes/lecture-worked-examples-audit/fixtures/references.json).','',
 '**Fact - source integrity.** All '+str(sum(r['pages'] for r in manifest['lectures']))+' pages were extracted from source commit `'+data['source_commit']+'`, with SHA-256 hashes, page counts and extractor version recorded in [source-manifest.json](../../spikes/lecture-worked-examples-audit/fixtures/source-manifest.json). The original PDFs stay on `course-lectures`; no PDF is merged into main. Page numbers are one-based PDF page positions, not inferred textbook pagination. `lNNN` references use the numbered pypdf extraction regenerated by [extract_sources.py](../../spikes/lecture-worked-examples-audit/extract_sources.py); formulas, tables and ambiguous powers were checked against rendered original pages. Extraction alone was not trusted: for example, L1 contains sin-squared, not sin, and L2\'s final printed numerator is p while its preceding fraction is 1-p.','',
 '**Fact - outcomes.** Group classifications: '+', '.join(f'{k}={v}' for k,v in sorted(counts.items()))+'. `corrected` identifies at least one incorrect printed output or formula in the group; `approximation` separates a valid approximation or coarse rounding from an exact answer; `ambiguous` means no unique valid answer can be inferred from the supplied event/data. These counts are not counts of independent errors. All 15 pre-existing correctness pins are reviewed below, including two partially disputed readings of the original. Sources: [fixtures](../../spikes/lecture-worked-examples-audit/fixtures/references.json), [pin audit](../../spikes/lecture-worked-examples-audit/fixtures/errata.json).','',
 '## Findings that affect scientific fixtures','',
 '**Fact - additional source errors.** L2 p7 ends the guessing posterior with `p/(4p+1)` after correctly deriving `(1-p)/(4p+1)`. L3 p4 gives a wrong point probability (.0572 instead of .05660875177) and wrong mode (51 instead of 50). L6 p15 reverses the probabilities of the squared variable: P(X squared=0)=1/3 and P(X squared=1)=2/3. Its independent-product law is valid only for two independent copies, since the same X multiplied by itself equals X squared. L6 p14 also has wrong outside-tail percentages and a wrong four-sigma central probability. L6 p33 makes the sum CDF zero above its support; it must be one. L6 p37 gives a constant disc marginal where chord integration gives `2*sqrt(R^2-x^2)/(pi*R^2)`; covariance zero and dependence are still correct. Each statement links to an original PDF through its row below; these are discoveries for review, not changes to other participants\' kernels.','',
 '**Fact - four-uniform convolution.** The displayed middle polynomials in L6 p32 fail independent exact-volume checks: the printed first middle branch evaluates to 79/48 at x=1.5, while the correct density is 23/48; the second middle branch evaluates to 1/2 at x=2.5, while symmetry gives 23/48. The source has `(x-3)^3` where `(x-1)^3` is required in the first branch, and a denominator 6 where 3 is required for its `(3-x)^3` term in the second branch. The fixture publishes the printed branches, corrected branches and rational-grid evaluations, rather than transcribing the source into an oracle. Source: L6 p32, `L06-uniform-density-4`.','',
 '**Fact - L10 cannot supply valid goodness-of-fit acceptance fixtures.** The cumulative table drops from .78 at t=50 to .72 at t=55 and its entries are not empirical step multiples of 1/16. Recomputed grid discrepancy .08795009138 agrees with the rounded .088, but the invalid table cannot establish a Kolmogorov statistic or p-value. Pearson weights sum to .91, their midpoint products to 23.285, and the 15 printed contribution entries sum to .06321, not .0829. The theoretical table resembles cumulative probabilities rather than bin probabilities and omits a column. A tail is missing. No replacement KS/chi-square p-value is fabricated; these groups have `reusable:false`. Source: L10 pp9-13, fixture rows `L10-kolmogorov-data` and `L10-pearson-data`.','',
 '**Fact - preserve the inputs of L11 p10.** Its separately stated summaries are mean=3.0318, corrected variance=.0303, n=22. They differ from the earlier raw sample. The fixtures publish both interpretations: intervals recomputed from the 22 listed values, and intervals computed from the p10 summaries as given. The p10 Student substitution also uses denominator 21 under the standard-error square root where n=22 is required. This separates an erroneous source variance from an additional interval-substitution error; it does not silently reinterpret the problem. Source: L11 pp5-6 and p10; `L11-sample22`, `L11-student-data`, `L11-student-given`, `L11-chi-data`, `L11-chi-given`.','',
 '**Fact - two map claims need correction.** The L7 original states Poisson `<=1/9`, not `>=1/9`, and does not fix its parameter. Its normal two-sided .00135 claim is still wrong. L10 already discusses losing degrees of freedom for fitted parameters and explicitly calculates 16-2=14 for the exponential example. Its input/table validity is the defect, not absence of parameter fitting. Also qualify the map\'s later “M=D=1 for every n” lottery assertion: enumeration gives variance zero when n=1 and variance one for n>=2. Sources: L7 p3, L10 pp11-13, L6 pp36-37; pin table and fixture rows below.','',
 '## Inventory by lecture','',
 '**Fact - inventory classification.** The following entries distinguish evaluated numerical answers from symbolic examples, qualitative arguments, historical observations and independently supplied diagnostic inputs. The full calculation table follows.','',
 '| Lecture | Coverage |','|---|---|']
    out += [f'| {lec} | {desc} |' for lec,desc in data['lecture_coverage'].items()]
    out += ['', '**Assumption - scope boundary.** Generic identities, graph tick marks, historical dates and uninstantiated distribution families are not additional evaluated worked examples. L5 has six parameterized distribution examples but no fixed-parameter numerical answer. L8 has parameterized CLT examples and an asymptotic 1/2 limit, not an exact finite-n probability; its strict-event sum should end at n-1. Historical count ratios are recomputed arithmetically without verifying the historical events. Unanswered exercises, such as L10\'s proposed eight-bin exercise, have no printed numerical answer to audit.', '',
      '## Independent computation and precision','',
      '**Fact - methods.** [audit_math.py](../../spikes/lecture-worked-examples-audit/audit_math.py) imports no project kernel, special-function spike or lecture table. Small finite spaces are exhaustively enumerated; sample sums use rational arithmetic; binomial probabilities use 80-digit Decimal finite recurrences. Continuous calculations use standard-library erf, normal inverse CDF, adaptive Simpson integration of the Student density, and integer/half-integer incomplete-gamma recurrence with bisection for chi-square quantiles. The relevant definitions are documented by [Python NormalDist](https://docs.python.org/3/library/statistics.html#statistics.NormalDist.inv_cdf), [NIST Student distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3664.htm) and [NIST chi-square distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3666.htm). No quoted lecture table is used as an oracle.','',
      '**Assumption - numerical reuse.** These are independent finite-case scientific references, not a general special-function library or a formal floating-point error proof. Decimal binomial sums are rounded evaluations of the exact law; rational intermediate values are exact before JSON conversion. Store roughly 8-10 significant digits in downstream continuous comparisons, with an appropriate absolute tolerance, rather than asserting bitwise equality across Python/libm versions. Quantile tests include exactly solvable t(df1) and chi-square(df2) cases. The explicit reproduction check compares the recorded output unchanged in this environment.','',
      '**Fact - Phi metadata.** Every fixture group records `phi` as `none`, `normal_cdf` (integral from -infinity), `zero_integral` (normal density integral from 0), `erf`, or `mixed`. The identities are `Phi0(x)=Phi(x)-1/2` and `erf(x)=2*Phi(sqrt(2)*x)-1`. L9 p7 uses erf-scaled arguments; p8 also switches to zero-origin normal table values. Treating all letter-Phi occurrences as the same function would reproduce wrong values. Sources: L3 pp7-8, L6 p14, L9 pp7-8, L12 pp3-4.','',
      '## Printed values versus recomputation','',
      '**Fact - table notation.** Values are rounded here to 10 significant digits for reading; full precision, named input parameters, method and limitations are in JSON. Each source cell names its PDF page and numbered extracted lines. `reusable:false` groups are evidence of ambiguity or invalid input and must not become a numerical acceptance oracle. Diagnostic parameters not supplied by the lecture are explicitly identified in their JSON note.', '',
      '| Fixture / example | Original source | Printed value | Independent result | Verdict |','|---|---|---|---|---|']
    for r in data['values']:
        s=r['source']
        refs='; '.join(f"[{r['lecture']} p{v['page']}]({s['pdf']}#page={v['page']}), {v['lines']}" for v in [s,*s.get('related',[])])
        out.append(f"| `{r['id']}` {r['title']} | {refs} | {fmt(r['lecture_value'])} | {fmt(r['recomputed'])} | {r['verdict']} |")
    out += ['', '## Audit of the existing correctness pins','',
      '**Fact - existing register.** All 15 table entries in [lecture-module-map.md](lecture-module-map.md#correctness-pins-the-lecture-is-wrong-or-ambiguous) at base `1f4187f` are addressed below. The shared map is left for its owner to update after review; this task supplies evidence and a machine-readable pin audit.', '',
      '| Existing pin | Verdict | Evidence / clarification |','|---|---|---|']
    out += [f'| {name} | {verdict} | {evidence} Fixtures: `{ids}`. |' for name,verdict,ids,evidence in pins]
    out += ['', '## Reproduction and handoff','',
      '**Fact - reproduction.** Run `python spikes/lecture-worked-examples-audit/test_audit.py`, `python spikes/lecture-worked-examples-audit/build_references.py --check`, and `python spikes/lecture-worked-examples-audit/build_report.py --check`. To validate PDF hashes and every page/line range, fetch `course-lectures` without merging and run `extract_sources.py --check` with the recorded pypdf version. Instructions are in the [spike README](../../spikes/lecture-worked-examples-audit/README.md). These explicit scientific checks are separate from full `crew check`, whose configured application steps are skipped in the current discovery checkout (`verified:false`).','',
      '**Assumption - position.** Reuse the corrected deterministic reference values, exact count cases and explicitly labeled approximations in later kernel tests, after independent review. Keep invalid L10 data and ambiguous Bertrand/five-days events out of numerical acceptance fixtures until the owner supplies a repaired specification. Preserve the source numbers next to corrected values for teaching, and retain Phi conventions and variance divisors in every consumer. Do not make a quiet global L11/L12 renumbering: the course index\'s topic titles disagree with much of the source body content; audit IDs here follow original PDF filenames. This is research evidence, not approval to change the captain\'s scientific decisions or other participants\' kernels.', '']
    return '\n'.join(out)


def main():
    targets={HERE/'fixtures/errata.json':json.dumps(errata,ensure_ascii=False,indent=2)+'\n',
             ROOT/'docs/research/lecture-worked-examples-audit.md':report()}
    for path,output in targets.items():
        if '--check' in sys.argv:
            if path.read_text(encoding='utf8')!=output: raise SystemExit(f'Recorded report differs: {path.name}')
        else: path.write_text(output,encoding='utf8')
    print('Report and all 15 pin audits '+('reproduced unchanged' if '--check' in sys.argv else 'written'))


if __name__=='__main__': main()
