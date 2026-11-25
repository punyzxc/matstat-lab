"""Discovery-only independent probability-budget calculator for issue #32.

No product imports or third-party packages. Binomial probabilities use an
80-digit mode-centred recurrence; concentration bands are analytic bounds.
"""
import argparse
from decimal import Decimal, localcontext
from functools import lru_cache
import json
import math
from pathlib import Path
import platform
from statistics import NormalDist


@lru_cache(maxsize=8)
def binomial_probabilities(n):
    if not isinstance(n, int) or isinstance(n, bool) or n < 1:
        raise ValueError('positive integer repetitions required')
    with localcontext() as context:
        context.prec = 80
        p = Decimal(19)/20
        q = 1-p
        mode = int((n+1)*p)
        weights = [Decimal(0)]*(n+1)
        weights[mode] = Decimal(1)
        for k in range(mode, 0, -1):
            weights[k-1] = weights[k]*k*q/((n-k+1)*p)
        for k in range(mode, n):
            weights[k+1] = weights[k]*(n-k)*p/((k+1)*q)
        total = sum(weights)
        return tuple(value/total for value in weights)


def acceptance_band(n, alpha):
    if not (Decimal(0) < alpha < Decimal(1)):
        raise ValueError('alpha must be between zero and one')
    probabilities = binomial_probabilities(n)
    with localcontext() as context:
        context.prec = 80
        half = alpha/2
        lo, low = 0, Decimal(0)
        while low+probabilities[lo] <= half:
            low += probabilities[lo]
            lo += 1
        hi, high = n, Decimal(0)
        while high+probabilities[hi] <= half:
            high += probabilities[hi]
            hi -= 1
        return dict(R=n, nominal='0.95', alpha=str(alpha), lo=lo, hi=hi,
                    lowerFraction=lo/n, upperFraction=hi/n,
                    lowerTail=str(low), upperTail=str(high), actualSize=str(low+high),
                    lowerBoundaryMass=str(probabilities[lo]), upperBoundaryMass=str(probabilities[hi]))


def concentration_band(model, total, alpha):
    if not isinstance(total, int) or total < 1 or not (0 < alpha < 1):
        raise ValueError('invalid budget or draw count')
    target = math.log(2/alpha)/total
    if model == 'uniform':
        delta = math.sqrt(target/2)
        return dict(N=total, lower=math.nextafter(.5-delta, -math.inf),
                    upper=math.nextafter(.5+delta, math.inf), method='Hoeffding')
    if model != 'exponential':
        raise ValueError('unsupported model')
    # Find two distinct Chernoff exponents; return the outside bracket endpoint.
    def root(lower):
        lo, hi = 0., (math.nextafter(1., 0.) if lower else 1.)
        exponent = (lambda x: -x-math.log1p(-x)) if lower else (lambda x: x-math.log1p(x))
        if not lower:
            while exponent(hi) < target:
                hi *= 2
        if exponent(hi) < target:
            raise ValueError('lower-tail solution outside binary64 resolution')
        for _ in range(100):
            mid = (lo+hi)/2
            if exponent(mid) < target:
                lo = mid
            else:
                hi = mid
        return hi
    return dict(N=total, lower=math.nextafter(1-root(True), -math.inf),
                upper=math.nextafter(1+root(False), math.inf), method='Exponential MGF Chernoff')


def mandatory_cases():
    cases = []
    for method, n in [('z', 1), ('z', 5), ('t', 2), ('t', 5), ('t', 30)]:
        cases.append(dict(id=f'coverage-{method}-n{n}', family='coverage', method=method,
                          model='normal', mu=10, sigma=3, n=n,
                          seed=(1000 if method == 'z' else 2000)+n,
                          referenceRng='inference-methods mulberry32 + cached Box-Muller at 1f4187f',
                          prR=2000, nightlyR=20000))
    for model in ['uniform', 'exponential']:
        for experiment in ['lln', 'clt']:
            cases.append(dict(id=f'mean-{model}-{experiment}', family='mean', model=model,
                              experiment=experiment, seed=2048,
                              referenceRng='fixture-mix32-v1', engine='simulation-fixture-v1',
                              pr=dict(n=64000 if experiment == 'lln' else 32,
                                      repetitions=1 if experiment == 'lln' else 2000),
                              nightly=dict(n=640000 if experiment == 'lln' else 32,
                                           repetitions=1 if experiment == 'lln' else 20000)))
    return cases


def report():
    with localcontext() as context:
        context.prec = 80
        alpha = Decimal(1)/18000  # .001 / (9 cases * 2 scheduled runs)
        rows = []
        for R in [2000, 20000]:
            for label, level in [('current', Decimal('.001')),
                                 ('all-27-normal-reference-only', Decimal(1)/27000),
                                 ('recommended-9-per-run-2-runs', alpha)]:
                rows.append(dict(policy=label, **acceptance_band(R, level)))
        alpha4 = math.erfc(4/math.sqrt(2))
        alpha6 = math.erfc(6/math.sqrt(2))
        coverage_size = float(next(row['actualSize'] for row in rows if row['R'] == 2000 and row['policy'] == 'current'))
        return dict(
            provenance=dict(python=platform.python_version(), decimalPrecision=80,
                            baseline='1f4187f2db7e66c8397cc8f5d9a192a59dc84cda',
                            scipy=None, numpy=None),
            inventory=dict(oracleMetrics=18, nominalCoverage=5, meanDiagnostics=4,
                           nominalComparisons=27, illustrativeUndercoverage=1,
                           deterministicQAChecks=5, deterministicQAAlpha=0),
            currentNormalReference=dict(alpha4SE=alpha4, alpha6SE=alpha6,
                unionBound=18*alpha4+5*.001+4*alpha6,
                independenceIllustration=-math.expm1(18*math.log1p(-alpha4)+5*math.log1p(-.001)+4*math.log1p(-alpha6)),
                actualCoverageSize=coverage_size,
                discretenessAdjustedUnionReference=18*alpha4+5*coverage_size+4*alpha6,
                caveat='Normal-reference approximation, not an established finite-sample FWER'),
            allocation=dict(targetCombinedFamilyAlpha='0.001', runsPerFamily=2,
                            comparisonsPerRun=9, perComparisonAlpha=str(alpha),
                            perComparisonAlphaRational='1/18000',
                            normalZFor27Comparisons=NormalDist().inv_cdf(1-float(Decimal(1)/27000)/2),
                            caveat='Model-conditional, one PR evaluation plus one nightly; not lifetime FWER'),
            coverageBands=rows,
            meanBands=[dict(R=R, model=model, alpha=str(alpha),
                            **concentration_band(model, 32*R, float(alpha)))
                       for R in [2000,20000] for model in ['uniform','exponential']],
            mandatoryCases=mandatory_cases(),
            nightlyNonblockingDiagnostics=dict(oracleSeeds=dict(normal=20261123, exponential=20261124),
                                               R=20000, n=5, comparisons=18,
                                               expectedUndercoverage=dict(model='exponential',method='t',n=5,seed=77,R=2000)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    target = Path(__file__).with_name('evidence.json')
    data = report()
    if args.check:
        if json.loads(target.read_text(encoding='utf-8')) != data:
            raise SystemExit('Budget evidence changed; review provenance and numerical differences')
        print('Budget evidence reproduces unchanged')
    else:
        target.write_text(json.dumps(data, indent=2, allow_nan=False)+'\n', encoding='utf-8', newline='\n')
        print(json.dumps(dict(coverageBands=[{key: row[key] for key in ['policy','R','lo','hi','actualSize']} for row in data['coverageBands']],
                              meanBands=data['meanBands'], current=data['currentNormalReference']), indent=2))
