"""Discovery-only oracle for #54: SciPy values, with mpmath (40 digits) as a second method.

Writes reference.json. Run: python -I generate_reference.py [--check]
"""
import argparse
import json
import platform
from pathlib import Path

import mpmath as mp
import numpy as np
import scipy
from scipy import special, stats

P = [1e-6, 1e-3, 0.025, 0.5, 0.975, 0.999, 1 - 1e-6]
DF = [1, 2, 3, 5, 10, 21, 30, 100, 1000]
F_DF = [(1, 1), (1, 2), (2, 1), (3, 10), (5, 20), (10, 100), (30, 30)]
X = [-30, -8, -3, -1.96, -1, -0.5, 0, 0.5, 1, 1.96, 3, 8]
LAMBDA = [0.2, 0.3, 0.5, 0.8, 1.0, 1.36, 1.63, 2.0, 3.0]
mp.mp.dps = 40


def mp_t_cdf(t, v):
    t, v = mp.mpf(t), mp.mpf(v)
    tail = mp.betainc(v / 2, mp.mpf(1) / 2, 0, v / (v + t * t), regularized=True) / 2
    return 1 - tail if t >= 0 else tail


def mp_chi2_cdf(x, v):
    return mp.gammainc(mp.mpf(v) / 2, 0, mp.mpf(x) / 2, regularized=True)


def mp_f_cdf(x, a, b):
    x, a, b = mp.mpf(x), mp.mpf(a), mp.mpf(b)
    return mp.betainc(a / 2, b / 2, 0, a * x / (a * x + b), regularized=True)


def mp_kolmogorov(lam):
    lam = mp.mpf(lam)
    return 1 - 2 * mp.nsum(lambda k: (-1) ** (k - 1) * mp.exp(-2 * k * k * lam * lam), [1, mp.inf])


def references():
    normal = [dict(x=x, cdf=float(stats.norm.cdf(x)), sf=float(stats.norm.sf(x)),
                   phi0=float(stats.norm.cdf(x) - 0.5) if abs(x) < 8 else float(np.sign(x) * (0.5 - stats.norm.sf(abs(x)))),
                   erf=float(special.erf(x)), mpCdf=float(mp.ncdf(x))) for x in X]
    nq = [dict(p=p, q=float(stats.norm.ppf(p))) for p in P]
    t = [dict(df=v, p=p, q=float(stats.t.ppf(p, v)), cdfAtQ=float(mp_t_cdf(stats.t.ppf(p, v), v))) for v in DF for p in P]
    tc = [dict(df=v, x=x, cdf=float(stats.t.cdf(x, v)), mp=float(mp_t_cdf(x, v))) for v in DF for x in (-3, -1, 0.5, 2, 10)]
    c = [dict(df=v, p=p, q=float(stats.chi2.ppf(p, v)), cdfAtQ=float(mp_chi2_cdf(stats.chi2.ppf(p, v), v))) for v in DF for p in P]
    cc = [dict(df=v, x=x, cdf=float(stats.chi2.cdf(x, v)), mp=float(mp_chi2_cdf(x, v))) for v in DF for x in (0.01, 1, 5, 20, 200)]
    f = [dict(d1=a, d2=b, p=p, q=float(stats.f.ppf(p, a, b)), cdfAtQ=float(mp_f_cdf(stats.f.ppf(p, a, b), a, b)))
         for a, b in F_DF for p in P]
    fc = [dict(d1=a, d2=b, x=x, cdf=float(stats.f.cdf(x, a, b)), mp=float(mp_f_cdf(x, a, b)))
          for a, b in F_DF for x in (0.1, 1, 3, 20)]
    k = [dict(lam=l, cdf=float(stats.kstwobign.cdf(l)), mp=float(mp_kolmogorov(l))) for l in LAMBDA]
    kq = [dict(p=p, q=float(stats.kstwobign.ppf(p))) for p in P]
    lg = [dict(x=x, logGamma=float(special.gammaln(x)), mp=float(mp.loggamma(x)))
          for x in (1e-8, 0.5, 1, 1.5, 2, 3.7, 10, 21 / 2, 100, 1e6)]
    lecture = dict(chi2_975_21=35.479, chi2_025_21=10.283, t_975_21=2.0796, z_99=2.3263, K_136=0.95)
    return dict(schema="statum-special-functions-v1",
                generator=dict(python=platform.python_version(), numpy=np.__version__, scipy=scipy.__version__,
                               mpmath=mp.__version__,
                               oracle="scipy.stats/special; mpmath 40 digits as an independent second method"),
                probabilities=P, normal=normal, normalQuantile=nq, tQuantile=t, tCdf=tc, chi2Quantile=c, chi2Cdf=cc,
                fQuantile=f, fCdf=fc, kolmogorov=k, kolmogorovQuantile=kq, logGamma=lg, lecture=lecture)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    out = Path(__file__).with_name("reference.json")
    text = json.dumps(references(), indent=1, allow_nan=False) + "\n"
    if ap.parse_args().check:
        if json.loads(out.read_text(encoding="utf-8")) != json.loads(text):
            raise SystemExit("Reference drift: review every changed value")
        print("reference.json matches the generator")
    else:
        out.write_text(text, encoding="utf-8", newline="\n")
        print("Wrote reference.json")
