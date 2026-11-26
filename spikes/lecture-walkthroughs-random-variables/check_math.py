"""Independent numerical checks of the teaching pins; no project kernel imports."""
from fractions import Fraction
from pathlib import Path
import itertools
import json
import math
import numpy
import scipy
from scipy.stats import binom, norm, poisson, irwinhall

ROOT = Path(__file__).parent
AUDIT = json.loads((ROOT.parent / 'lecture-worked-examples-audit/fixtures/references.json').read_text())
REF = {r['id']: r for r in AUDIT['values']}
EVIDENCE = json.loads((ROOT / 'evidence.json').read_text())['presets']
checks = 0


def close(actual, expected, tol=5e-12):
    global checks
    assert math.isfinite(actual) and abs(actual - expected) <= tol, (actual, expected, tol)
    checks += 1


def theory(step, key, expected, tol=5e-7):
    row = next(r for r in EVIDENCE[step]['readouts'] if r['key'] == key)
    close(row['theory'], expected, tol)


for k in range(1, 5):
    value = 1 - 2 * norm.sf(k)
    close(value, REF[f'L06-sigma-{k}']['recomputed']['inside'])
    theory('L06-three-sigma', f'rule{k}', value)
close(2 * norm.sf(3), REF['L07-normal-tail']['recomputed'])
theory('L07-chebyshev', 'exact', 2 * norm.sf(3), 5e-8)
theory('L07-chebyshev', 'chebyshev', 1 / 9)
theory('L07-tails', 'exact', poisson.sf(3, 1), 5e-8)
theory('L08-poisson', 'poisson-lemma', poisson.cdf(10, 10))
close(poisson.cdf(9, 10), REF['L08-poisson-limit']['recomputed']['finite_n_10_strict'])
close(poisson.cdf(10, 10), REF['L08-poisson-limit']['recomputed']['finite_n_10_inclusive'])

for name, n, p, lo, hi in [
    ('defects', 50, .2, 6, 50), ('first-grade', 200, .6, 120, 150),
    ('guarantee', 15000, .04, 570, 630),
]:
    exact = binom.cdf(hi, n, p) - binom.cdf(lo - 1, n, p)
    close(exact, REF[f'L09-{name}']['recomputed']['exact'])
    mu, sd = n * p, math.sqrt(n * p * (1 - p))
    plain = norm.cdf((hi - mu) / sd) - norm.cdf((lo - mu) / sd)
    corrected = norm.cdf((hi + .5 - mu) / sd) - norm.cdf((lo - .5 - mu) / sd)
    close(plain, REF[f'L09-{name}']['recomputed']['plain_normal'])
    close(corrected, REF[f'L09-{name}']['recomputed']['continuity_corrected'])
    if name != 'guarantee':
        theory(f'L09-{name}', 'range', exact)
        theory(f'L09-{name}', 'plain', plain)
        theory(f'L09-{name}', 'corrected', corrected)

assert Fraction(98, 100) * Fraction(2, 100) / (Fraction(4, 100) * Fraction(2, 100) ** 2) == 1225
assert 1 - Fraction(4, 100) ** 2 / (16000 * Fraction(1, 1000) ** 2) == Fraction(9, 10)
assert 1 - Fraction(4, 100) ** 2 / (16001 * Fraction(1, 1000) ** 2) > Fraction(9, 10)
assert Fraction(1) - Fraction(2500, 500 ** 2) == Fraction(99, 100)
assert Fraction(1) - Fraction(9, 2500) / Fraction(3, 10) ** 2 == Fraction(96, 100)
assert Fraction(1) - Fraction(3, 10) * Fraction(7, 10) / (10000 * Fraction(1, 100) ** 2) == Fraction(79, 100)

# Enumerate atoms and independent pairs rather than repeating a transformation formula.
atoms = (-1, 0, 1)
assert sum(x*x == 0 for x in atoms) == 1
assert [sum(x*y == z for x, y in itertools.product(atoms, repeat=2)) for z in (-1, 0, 1)] == [2, 5, 2]
for n in range(1, 7):
    counts = [sum(i == v for i, v in enumerate(p)) for p in itertools.permutations(range(n))]
    close(float(numpy.mean(counts)), 1)
    close(float(numpy.var(counts)), 0 if n == 1 else 1)
for n in (2, 3, 4):
    ref = REF[f'L06-uniform-density-{n}']['recomputed']
    for x, value in zip(ref['x'], ref['density']):
        close(irwinhall.pdf(x, n), value)
for x, expected in [(.5, 1/8), (1, .5), (1.5, 7/8), (3, 1)]:
    close(irwinhall.cdf(x, 2), expected)

theory('L06-mean', 'mean', .1)
theory('L06-mean', 'variance', 4.59)
theory('L06-shape', 'mean', .5)
theory('L06-shape', 'variance', .25)
theory('L06-shape', 'skew', 2)
theory('L06-shape', 'exkurt', 6)
theory('L06-exp-transform', 'mean', 2/3)
theory('L06-exp-transform', 'F05', .25)
theory('L06-gaussian-vector', 'slope63', 1.2)
theory('L06-gaussian-vector', 'slope64', .3)
theory('L06-lottery', 'mean', 1)
theory('L06-lottery', 'variance', 1)
theory('L06-disc', 'cov', 0)
theory('L09-charfn', 're', math.exp(-.5))
theory('L09-charfn', 'im', 0)
theory('L05-cdf', 'F', Fraction(21, 36))
theory('L05-cdf', 'jump', Fraction(6, 36))
theory('L04-bertrand', 'radius', .5)
theory('L04-bertrand', 'endpoints', 1/3)
theory('L04-bertrand', 'midpoint', .25)
print(f'{checks} numeric comparisons and exact rational/enumeration checks passed; NumPy {numpy.__version__}, SciPy {scipy.__version__}')
