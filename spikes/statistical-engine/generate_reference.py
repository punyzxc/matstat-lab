"""Discovery-only SciPy oracle for the six distribution contracts (#13).

Writes reference.json. Nothing in the application imports this file.
Run: python -I generate_reference.py        (rewrite)
     python -I generate_reference.py --check (compare without rewriting)
"""
import argparse
import json
import math
import platform
from pathlib import Path

import mpmath as mp
import numpy as np
import scipy
from scipy import stats

# Fixed uniform arrays for sampler fixtures: midpoint grid endpoints, centre,
# quartiles and two values that sit far from any discrete CDF jump used below.
U = [2.0**-33, 0.025, 0.25, 0.5, 0.75, 0.975, 1 - 2.0**-33]


def f(x):
    """JSON-safe float: keep -inf/inf/nan as strings so the file stays strict JSON."""
    x = float(x)
    if math.isnan(x):
        return "nan"
    if math.isinf(x):
        return "inf" if x > 0 else "-inf"
    return x


def model(name, params, frozen, discrete, points, extra=None):
    m, v, s, k = frozen.stats(moments="mvsk")
    case = dict(
        id=name, params=params, measure="pmf" if discrete else "pdf",
        moments=dict(mean=f(m), variance=f(v), skewness=f(s), excessKurtosis=f(k)),
        points=[],
        ppf=[dict(u=u, x=f(frozen.ppf(u))) for u in U],
    )
    for x in points:
        point = dict(x=x, cdf=f(frozen.cdf(x)), sf=f(frozen.sf(x)))
        if discrete:
            point["pmf"] = f(frozen.pmf(x))
            point["logpmf"] = f(frozen.logpmf(x))
        else:
            point["pdf"] = f(frozen.pdf(x))
            point["logpdf"] = f(frozen.logpdf(x))
        case["points"].append(point)
    if extra:
        case.update(extra)
    return case


def references():
    cases = []
    add = cases.append
    # Normal(mu, sigma): SciPy loc=mu, scale=sigma.
    add(model("normal-standard", dict(mu=0, sigma=1), stats.norm(0, 1), False,
              [0, -1, 1, 1.959963984540054, -8, 8, -38, 38]))
    add(model("normal-shifted", dict(mu=10, sigma=4), stats.norm(10, 4), False, [10, 0, 18]))
    add(model("normal-large", dict(mu=1e6, sigma=1e-3), stats.norm(1e6, 1e-3), False,
              [1e6, 1e6 + 5e-3, 1e6 - 5e-3]))
    # Uniform(a, b): SciPy loc=a, scale=b-a.
    add(model("uniform-unit", dict(a=0, b=1), stats.uniform(0, 1), False,
              [0, 1, 0.5, -1e-12, 1 + 1e-12]))
    add(model("uniform-shifted", dict(a=2, b=6), stats.uniform(2, 4), False, [2, 3, 6, 7]))
    add(model("uniform-wide", dict(a=-1e150, b=1e150), stats.uniform(-1e150, 2e150), False,
              [0, -1e150, 1e150]))
    # Exponential(rate): SciPy scale = 1/rate.
    add(model("exponential-rate-one", dict(rate=1), stats.expon(scale=1), False,
              [0, -1e-300, 1, 22.873856958478196, 745]))
    add(model("exponential-rate-two", dict(rate=2), stats.expon(scale=0.5), False, [0, 1]))
    add(model("exponential-rate-large", dict(rate=1e6), stats.expon(scale=1e-6), False,
              [0, 1e-6, 1e-3]))
    # Bernoulli(p)
    for p in (0, 1, 0.3):
        add(model(f"bernoulli-{p}", dict(p=p), stats.bernoulli(p), True, [-1, 0, 1, 2, 0.5]))
    # Binomial(n, p)
    add(model("binomial-ten-quarter", dict(n=10, p=0.25), stats.binom(10, 0.25), True,
              [-1, 0, 3, 10, 11]))
    add(model("binomial-n0", dict(n=0, p=0.4), stats.binom(0, 0.4), True, [-1, 0, 1]))
    add(model("binomial-p0", dict(n=7, p=0), stats.binom(7, 0), True, [0, 1, 7]))
    add(model("binomial-p1", dict(n=7, p=1), stats.binom(7, 1), True, [0, 6, 7]))
    add(model("binomial-large", dict(n=1_000_000, p=0.5), stats.binom(1_000_000, 0.5), True,
              [0, 499_000, 500_000, 501_000, 1_000_000]))
    add(model("binomial-rare", dict(n=1_000_000, p=1e-6), stats.binom(1_000_000, 1e-6), True,
              [0, 1, 5, 20]))
    # Poisson(lambda)
    add(model("poisson-two", dict(rate=2), stats.poisson(2), True, [-1, 0, 3, 10]))
    add(model("poisson-zero", dict(rate=0), stats.poisson(0), True, [-1, 0, 1]))
    add(model("poisson-large", dict(rate=1e6), stats.poisson(1e6), True,
              [0, 999_000, 1_000_000, 1_001_000]))

    # Second, independent oracle: 50-digit mpmath for the cases where Float64 libraries drift.
    mp.mp.dps = 50

    def binom_cdf(k, n, p):
        if k < 0:
            return mp.mpf(0)
        if k >= n:
            return mp.mpf(1)
        p = mp.mpf(p)
        term = mp.binomial(n, k) * p**k * (1 - p)**(n - k)
        total, j = mp.mpf(0), k
        while j >= 0 and (term > total * mp.mpf(10)**-40 or j == k):
            total += term
            term *= mp.mpf(j) / (n - j + 1) * (1 - p) / p
            j -= 1
        return total

    def binom_pmf(k, n, p):
        p = mp.mpf(p)
        return mp.binomial(n, k) * p**k * (1 - p)**(n - k) if 0 <= k <= n else mp.mpf(0)

    def pois_pmf(k, lam):
        lam = mp.mpf(lam)
        return mp.exp(-lam + k * mp.log(lam) - mp.loggamma(k + 1)) if k >= 0 else mp.mpf(0)

    high = []
    for case in cases:
        prm = case["params"]
        if case["id"] in ("binomial-large", "binomial-rare"):
            pts = [dict(x=pt["x"], pmf=f(binom_pmf(pt["x"], prm["n"], prm["p"])),
                        cdf=f(binom_cdf(pt["x"], prm["n"], prm["p"])))
                   for pt in case["points"] if pt["x"] in (1, 5, 499_000, 500_000, 501_000)]
        elif case["id"] == "poisson-large":
            pts = [dict(x=pt["x"], pmf=f(pois_pmf(pt["x"], prm["rate"])),
                        cdf=f(mp.gammainc(pt["x"] + 1, prm["rate"], mp.inf, regularized=True)))
                   for pt in case["points"] if pt["x"] > 0]
        elif case["id"] == "normal-standard":
            pts = [dict(x=x, cdf=f(mp.ncdf(x))) for x in (-38, -8, 1.959963984540054)]
        else:
            continue
        for pt in pts:
            if "pmf" in pt:
                pt["logpmf"] = f(mp.log(pt["pmf"]) if pt["pmf"] > 0 else -mp.inf)
        case["highPrecision"] = pts
        high.append(case["id"])

    singleton = np.array([3.5])
    five = np.array([1.0, 2.0, 2.0, 3.0, 7.0])
    samples = []
    for name, x in (("singleton", singleton), ("five-with-tie", five)):
        with np.errstate(all="ignore"):
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                var1 = np.var(x, ddof=1)
        edges = [0.0, 2.0, 4.0, 6.0]
        counts, _ = np.histogram(x, bins=edges)
        ecdf = stats.ecdf(x).cdf
        samples.append(dict(
            id=name, sample=x.tolist(), n=int(x.size), mean=f(np.mean(x)),
            varianceDivisorN=f(np.var(x, ddof=0)), varianceDivisorNMinus1=f(var1),
            histogram=dict(edges=edges, counts=counts.tolist(),
                           overflow=int(np.sum(x > edges[-1])),
                           underflow=int(np.sum(x < edges[0])),
                           densityHeights=[f(c / (x.size * (edges[i + 1] - edges[i])))
                                           for i, c in enumerate(counts)]),
            ecdf=dict(x=ecdf.quantiles.tolist(), p=ecdf.probabilities.tolist()),
        ))
    return dict(
        schema="statum-distribution-reference-v1",
        generator=dict(python=platform.python_version(), numpy=np.__version__,
                       scipy=scipy.__version__,
                       mpmath=mp.__version__,
                       oracle="scipy.stats frozen distributions; numpy.histogram; scipy.stats.ecdf; "
                              "mpmath at 50 digits for highPrecision entries"),
        uniforms=U, models=cases, samples=samples,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    out = Path(__file__).with_name("reference.json")
    text = json.dumps(references(), indent=1, allow_nan=False) + "\n"
    if args.check:
        if json.loads(out.read_text(encoding="utf-8")) != json.loads(text):
            raise SystemExit("Reference drift: review SciPy/NumPy versions and every changed value")
        print("reference.json matches the generator")
    else:
        out.write_text(text, encoding="utf-8", newline="\n")
        print(f"Wrote {len(references()['models'])} model cases")
