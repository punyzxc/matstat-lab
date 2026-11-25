"""Independent standard-library calculations; no imports from lecture kernels/tables."""
from decimal import Decimal, localcontext
from fractions import Fraction
from itertools import product, permutations, combinations
from math import comb, erf, exp, factorial, fsum, lgamma, log, pi, sqrt
from statistics import NormalDist


def binomial(n, p, lo, hi):
    with localcontext() as ctx:
        ctx.prec = 80
        p = Decimal(p)
        if p == 0:
            return Decimal(int(lo <= 0 <= hi))
        if p == 1:
            return Decimal(int(lo <= n <= hi))
        q = 1 - p
        term = q ** n
        total = Decimal(0)
        for k in range(0, min(hi, n) + 1):
            if k >= lo:
                total += term
            term *= Decimal(n - k) * p / (Decimal(k + 1) * q)
        return +total


def empty_boxes(n):
    if n < 1:
        raise ValueError('At least one ball and box required')
    counts = [0] * n
    for assignment in product(range(n), repeat=n):
        counts[n - len(set(assignment))] += 1
    return counts


def normal_cdf(x):
    return .5 * (1 + erf(x / sqrt(2)))


def phi_zero(x):
    return .5 * erf(x / sqrt(2))


def normal_quantile(p):
    return NormalDist().inv_cdf(p)


def poisson_tail(lam, k):
    return 1 - exp(-lam) * fsum(lam ** j / factorial(j) for j in range(k))


def integrate(f, lo, hi, eps=2e-13):
    def simpson(a, b, fa, fm, fb):
        return (b - a) * (fa + 4 * fm + fb) / 6

    def split(a, b, fa, fm, fb, whole, tol, depth):
        mid = (a + b) / 2
        lm, rm = (a + mid) / 2, (mid + b) / 2
        fl, fr = f(lm), f(rm)
        left, right = simpson(a, mid, fa, fl, fm), simpson(mid, b, fm, fr, fb)
        delta = left + right - whole
        if depth == 0 or abs(delta) <= 15 * tol:
            return left + right + delta / 15
        return split(a, mid, fa, fl, fm, left, tol/2, depth-1) + split(mid, b, fm, fr, fb, right, tol/2, depth-1)
    fa, fm, fb = f(lo), f((lo + hi)/2), f(hi)
    return split(lo, hi, fa, fm, fb, simpson(lo, hi, fa, fm, fb), eps, 24)


def student_cdf(x, df):
    c = exp(lgamma((df+1)/2) - lgamma(df/2)) / sqrt(df*pi)
    v = integrate(lambda t: c * (1 + t*t/df) ** (-(df+1)/2), 0, abs(x))
    return .5 + (v if x >= 0 else -v)


def inverse(cdf, p, lo, hi):
    for _ in range(90):
        mid = (lo + hi)/2
        if cdf(mid) < p:
            lo = mid
        else:
            hi = mid
    return (lo + hi)/2


def student_quantile(p, df):
    if p == .5:
        return 0.0
    if p < .5:
        return -student_quantile(1-p, df)
    hi = 1
    while student_cdf(hi, df) < p:
        hi *= 2
    return inverse(lambda x: student_cdf(x, df), p, 0, hi)


def chi_cdf(x, df):
    # Integer/half-integer gamma recurrence, evaluated independently of kernels.
    z, a = x / 2, df / 2
    if df % 2 == 0:
        value, shape = 1-exp(-z), 1.0
    else:
        value, shape = erf(sqrt(z)), .5
    while shape < a:
        value -= exp(shape*log(z) - z - lgamma(shape+1)) if z else 0
        shape += 1
    return max(0.0, min(1.0, value))


def chi_quantile(p, df):
    hi = max(1, df)
    while chi_cdf(hi, df) < p:
        hi *= 2
    return inverse(lambda x: chi_cdf(x, df), p, 0, hi)


def sample_stats(values):
    values = list(map(Fraction, values))
    n = len(values)
    mean = sum(values)/n
    ss = sum((x-mean)**2 for x in values)
    return {k: float(v) for k, v in {'n': n, 'sum': sum(values), 'sum_squares': sum(x*x for x in values),
      'mean': mean, 'variance_n': ss/n, 'variance_n_minus_1': ss/(n-1)}.items()}


def uniform_sum_cdf(n, x):
    x = Fraction(x)
    if x <= 0:
        return Fraction(0)
    if x >= n:
        return Fraction(1)
    return sum((-1)**k * comb(n, k) * max(Fraction(0), x-k)**n for k in range(n+1)) / factorial(n)


def uniform_sum_density(n, x):
    x = Fraction(x)
    if x < 0 or x > n:
        return Fraction(0)
    return sum((-1)**k * comb(n, k) * max(Fraction(0), x-k)**(n-1) for k in range(n+1)) / factorial(n-1)


def lottery(n):
    matches = [sum(i == j for i, j in enumerate(p)) for p in permutations(range(n))]
    mean = Fraction(sum(matches), len(matches))
    var = sum((m-mean)**2 for m in matches) / len(matches)
    return {'n': n, 'mean': float(mean), 'variance': float(var)}


def lp_vertices():
    # a*x+b*y<=c; enumerate all boundary-line intersections over exact rationals.
    constraints = [(1, 1, 2), (1, -2, 0), (-1, 4, 1), (-1, 0, 0), (0, -1, 0)]
    vertices = []
    for (a, b, c), (d, e, f) in combinations(constraints, 2):
        det = a*e-b*d
        if not det:
            continue
        x, y = Fraction(c*e-b*f, det), Fraction(a*f-c*d, det)
        if all(A*x+B*y <= C for A, B, C in constraints):
            vertices.append((x, y))
    x, y = max(set(vertices), key=lambda v: 5*v[0]+8*v[1])
    return {'y1': float(x), 'y2': float(y), 'objective': float(5*x+8*y)}
