"""Discovery-only oracle for #19: an independent Python re-implementation of the lesson fixture.

It shares no code with comparison.mjs. It writes reference.json; the Node test compares against it.
Run: python -I generate_reference.py [--check]
"""
import argparse
import json
import math
import platform
from pathlib import Path

import numpy as np
from scipy import stats

NAMESPACE = 0x7EAC
SIZES = {"small": 10, "large": 100}
EDGES = [i / 2 for i in range(15)]
M32 = 0xFFFFFFFF


def mix32(x):
    x &= M32
    x = ((x ^ (x >> 16)) * 0x7FEB352D) & M32
    x = ((x ^ (x >> 15)) * 0x846CA68B) & M32
    return (x ^ (x >> 16)) & M32


def uint32(seed, stream, index):
    return mix32(seed ^ mix32(stream + 0x9E3779B9) ^ mix32(index + 0x85EBCA6B) ^ NAMESPACE)


def draw(seed, stream, index):
    u = (uint32(seed, stream, index) + 0.5) / 2**32
    return -math.log1p(-u) if u <= 0.5 else -math.log(1 - u)


def stream_of(design, size, replicate=0):
    if design == "nested":
        return 2**20 + replicate
    return (1 if size == "small" else 2) + 2 * replicate


def sample(seed, design, size, replicate=0):
    return np.array([draw(seed, stream_of(design, size, replicate), i) for i in range(SIZES[size])])


def metrics(x):
    counts, _ = np.histogram(np.minimum(x, np.inf), bins=EDGES)
    over = int(np.sum(x > EDGES[-1]))
    ks = stats.kstest(x, stats.expon.cdf).statistic
    return dict(n=int(x.size), mean=float(np.mean(x)), absError=float(abs(np.mean(x) - 1)),
                sd=float(np.std(x, ddof=1)), ks=float(ks), counts=counts.tolist(), overflow=over,
                max=float(np.max(x)))


def compare(seed, design, replicate=0):
    s = metrics(sample(seed, design, "small", replicate))
    l = metrics(sample(seed, design, "large", replicate))
    return dict(seed=seed, design=design, small=s, large=l, largerIsCloser=l["absError"] < s["absError"])


def references():
    # Seed 1 is the first typical run in a scan from 1; 4 and 9 are the first counterexamples.
    runs = [compare(1, "independent"), compare(4, "independent"), compare(1, "nested"), compare(9, "nested")]
    tally = {d: [s for s in range(1, 31) if not compare(s, d)["largerIsCloser"]] for d in ("independent", "nested")}
    repeated = {}
    for design in ("independent", "nested"):
        R = 1000
        out = {}
        for size in ("small", "large"):
            means = np.array([np.mean(sample(1, design, size, r)) for r in range(R)])
            out[size] = dict(n=SIZES[size], R=R, rmse=float(np.sqrt(np.mean((means - 1) ** 2))),
                             meanAbsError=float(np.mean(np.abs(means - 1))))
        worse = sum(1 for r in range(R) if not compare(1, design, r)["largerIsCloser"])
        out["counterexampleShare"] = worse / R
        repeated[design] = out
    n = np.array([10, 100])
    expected = dict(
        rmse=dict(zip(("small", "large"), (1 / np.sqrt(n)).tolist())),
        # xbar ~ Gamma(shape n, scale 1/n): E|xbar - 1| from SciPy, independent of the closed form.
        meanAbsError={k: float(stats.gamma(a=v, scale=1 / v).expect(lambda t: abs(t - 1)))
                      for k, v in SIZES.items()},
        normalApproxCounterexample=float(2 / math.pi * math.atan(math.sqrt(10 / 100))),
    )
    return dict(schema="statum-teaching-comparison-v1",
                generator=dict(python=platform.python_version(), numpy=np.__version__,
                               scipy=__import__("scipy").__version__),
                model=dict(family="exponential", rate=1), sizes=SIZES, edges=EDGES,
                streams=dict(namespace=NAMESPACE,
                             independent="small: 1 + 2r, large: 2 + 2r",
                             nested="2^20 + r; small = first 10 draws of large"),
                runs=runs, classTallySeeds1to30=tally, repeatedSeed1=repeated,
                expected=expected)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    out = Path(__file__).with_name("reference.json")
    text = json.dumps(references(), indent=1, allow_nan=False) + "\n"
    if args.check:
        if json.loads(out.read_text(encoding="utf-8")) != json.loads(text):
            raise SystemExit("Reference drift: review every changed value")
        print("reference.json matches the generator")
    else:
        out.write_text(text, encoding="utf-8", newline="\n")
        print("Wrote reference.json")
