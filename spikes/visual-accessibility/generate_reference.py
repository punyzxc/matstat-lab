"""Independent, disposable discovery oracle. No application imports or third-party dependencies."""
import argparse
import json
import math
from pathlib import Path
import platform
import statistics


def references():
    cases = []

    def add(case_id, parameters, expected, reference, absolute=1e-12, relative=1e-10):
        cases.append(dict(id=case_id, parameters=parameters, expected=expected,
                          reference=reference,
                          tolerance=dict(absolute=absolute, relative=relative)))

    add("uniform-shifted", dict(a=2, b=6, x=3), dict(pdf=1/4, cdf=1/4),
        "Analytical: 1/(b-a), (x-a)/(b-a)")
    norm = statistics.NormalDist(mu=10, sigma=4)
    add("normal-shifted", dict(mu=10, sigma=4, x=10),
        dict(pdf=norm.pdf(10), cdf=norm.cdf(10)), "CPython statistics.NormalDist")
    standard = statistics.NormalDist()
    add("normal-central-95", dict(mu=0, sigma=1, alpha=0.05),
        dict(lower=standard.inv_cdf(.025), upper=standard.inv_cdf(.975)),
        "CPython statistics.NormalDist.inv_cdf")
    add("normal-right-tail-eight", dict(mu=0, sigma=1, x=8),
        dict(sf=math.erfc(8/math.sqrt(2))/2), "Analytical: erfc(x/sqrt(2))/2",
        absolute=1e-28)
    add("exponential-rate-two", dict(rate=2, x=1),
        dict(pdf=2*math.exp(-2), cdf=-math.expm1(-2), mean=.5, variance=.25),
        "Analytical exponential density/CDF, rate lambda (not scale)")
    n, p, k = 10, .25, 3
    pmf = lambda j: math.comb(n, j)*p**j*(1-p)**(n-j)
    add("binomial-ten-quarter", dict(n=n, p=p, k=k),
        dict(pmf=pmf(k), cdf=math.fsum(pmf(j) for j in range(k+1))),
        "Analytical binomial PMF and finite sum")
    rate, k = 2, 3
    poisson = lambda j: math.exp(-rate)*rate**j/math.factorial(j)
    add("poisson-two", dict(rate=rate, k=k),
        dict(pmf=poisson(k), cdf=math.fsum(poisson(j) for j in range(k+1))),
        "Analytical Poisson PMF and finite sum")
    sample = [1, 2, 3, 4, 5]
    add("summary-five", dict(sample=sample, ddofSample=1),
        dict(n=len(sample), mean=statistics.mean(sample),
             variancePopulation=statistics.pvariance(sample),
             varianceSample=statistics.variance(sample)),
        "CPython statistics; exact rational mean and variances")
    critical1 = math.tan(math.pi*(.975-.5))
    add("t-df-one", dict(sample=[0, 2], nullMean=0, alpha=.05, alternative="two-sided"),
        dict(df=1, statistic=1, pTwoSided=.5, ci95=[1-critical1, 1+critical1]),
        "Analytical t(df=1)=Cauchy; q(.975)=tan(pi*(.975-.5))")

    def cdf4(t):
        s = t/math.sqrt(t*t+4)
        return .5+(3*s-s**3)/4

    low, high = 0., 10.
    for _ in range(100):
        mid = (low+high)/2
        if cdf4(mid) < .975:
            low = mid
        else:
            high = mid
    se = math.sqrt(statistics.variance(sample)/len(sample))
    t = statistics.mean(sample)/se
    half_width = ((low+high)/2)*se
    add("t-df-four", dict(sample=sample, nullMean=0, alpha=.05, alternative="two-sided"),
        dict(df=4, statistic=t, pTwoSided=2*(1-cdf4(t)),
             ci95=[3-half_width, 3+half_width]),
        "Analytical t(df=4) CDF=.5+(3*s-s^3)/4, s=t/sqrt(t^2+4); bisection q(.975)")

    def vector(seed):
        words = []
        state = seed
        for _ in range(8):
            state ^= (state << 13) & 0xffffffff
            state ^= state >> 17
            state ^= (state << 5) & 0xffffffff
            state &= 0xffffffff
            words.append(state)
        return dict(seed=seed, words=words,
                    uniformOpen=[(word+.5)/2**32 for word in words])

    return dict(schema="statum-discovery-reference-v1",
                generator=dict(python=platform.python_version(),
                               oracle="CPython standard library + analytical identities",
                               scipy=None, numpy=None),
                cases=cases,
                rng=dict(algorithm="xorshift32-13-17-5/open-midpoint-v1",
                         zeroSeedPolicy="reject", vectors=[vector(1), vector(0xffffffff)]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Compare without rewriting the oracle")
    args = parser.parse_args()
    output = Path(__file__).with_name("reference.json")
    result = json.dumps(references(), indent=2, allow_nan=False)+"\n"
    if args.check:
        if json.loads(output.read_text(encoding="utf-8")) != json.loads(result):
            raise SystemExit("Reference drift: review Python version and all numerical changes")
        print("Independent reference fixtures match the recorded generator output")
    else:
        output.write_text(result, encoding="utf-8", newline="\n")
        print(f"Wrote {len(references()['cases'])} analytical cases and two RNG vectors")
