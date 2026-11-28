#!/usr/bin/env python3
"""Independent ideal-model reference; no JavaScript engine or samples are used."""
import hashlib, json, math, platform, sys
from pathlib import Path
import numpy as np
import scipy
from scipy.stats import gamma, irwinhall, norm

HERE = Path(__file__).resolve().parent
raw = (HERE / 'plan.json').read_bytes()
p = json.loads(raw)
delta = p['familyDelta'] / p['familyEvents']
epsilon = math.sqrt(math.log(2 / delta) / (2 * p['repetitions']))
models = {}
for name in p['models']:
    mu, var = (0.5, 1 / 12) if name == 'uniform' else (1.0, 1.0)
    bands = {}
    for n in p['prefixNs']:
        if name == 'uniform':
            width = math.sqrt(math.log(2 / delta) / (2 * n))
            lower, upper = max(0, mu - width), min(1, mu + width)
        else:
            lower, upper = gamma.ppf(delta / 2, n, scale=1/n), gamma.isf(delta / 2, n, scale=1/n)
        bands[str(n)] = [float(lower), float(upper)]
    clt = {}
    for n in p['cltNs']:
        xs = [n/2 + z*math.sqrt(n/12) if name == 'uniform' else n + z*math.sqrt(n) for z in p['zEdges']]
        cdf = [float(irwinhall.cdf(x, n)) if name == 'uniform' else float(gamma.cdf(x, n)) if x > 0 else 0.0 for x in xs]
        clt[str(n)] = {'finiteCDF': cdf}
    models[name] = {'mean': mu, 'variance': var, 'llnBands': bands, 'clt': clt}
result = {'studyVersion':p['studyVersion'], 'planSha256':hashlib.sha256(raw).hexdigest(), 'versions':{'python':platform.python_version(),'scipy':scipy.__version__,'numpy':np.__version__}, 'deltaPerEvent':delta, 'epsilon':epsilon, 'phi':[float(norm.cdf(z)) for z in p['zEdges']], 'models':models}
output = json.dumps(result, indent=2, allow_nan=False) + '\n'
path = HERE / 'references.json'
if sys.argv[1:] == ['--check']:
    if not path.exists() or path.read_text() != output:
        sys.exit('Reference regeneration differs or reference is missing')
    print('Reference regeneration matches')
elif sys.argv[1:] in ([], ['--write']):
    path.write_text(output)
    print('Wrote references.json')
else:
    sys.exit('Usage: python3 reference.py [--write|--check]')
