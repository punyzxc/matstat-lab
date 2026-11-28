"""Render frozen results; no simulation, seed selection or probability recalibration."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / 'docs/research/assets/convergence-teaching'
OUT.mkdir(parents=True, exist_ok=True)
r = json.loads((HERE / 'results.json').read_text())
plt.rcParams.update({'svg.hashsalt': r['studyVersion'], 'font.size': 11, 'axes.spines.top': False, 'axes.spines.right': False})
styles = [('uniform', 'Uniform(0, 1)', '#2563a6', 'o'), ('exponential', 'Exponential(rate=1)', '#ba4d10', 's')]

fig, ax = plt.subplots(figsize=(8.2, 4.7), layout='constrained')
for model, label, color, marker in styles:
    case = next(c for c in r['lln'] if c['spec']['model'] == model and c['spec']['seed'] == 2048)
    ns = [p['n'] for p in case['prefixes']]
    errors = [abs(p['mean'] - case['idealMean']) / case['idealVariance']**.5 for p in case['prefixes']]
    ax.loglog(ns, errors, marker=marker, color=color, label=label)
ax.loglog(ns, [n**-.5 for n in ns], '--', color='#555555', label='1/sqrt(n): one-SE scale, not a simultaneous band')
ax.set(xlabel='Prefix length n (one fixed trajectory per model)', ylabel='Absolute mean error / ideal SD', title='LLN checkpoints: a seeded error need not fall monotonically')
ax.grid(alpha=.2, which='both'); ax.legend(fontsize=8.5)
fig.savefig(OUT/'lln-prefixes.svg', metadata={'Date': None}); plt.close(fig)

fig, ax = plt.subplots(figsize=(8.2, 4.9), layout='constrained')
for model, label, color, marker in styles:
    cases = [c for c in r['clt'] if c['spec']['model'] == model and c['spec']['seed'] == 2048]
    ns = [c['spec']['n'] for c in cases]
    ax.loglog(ns, [c['gridDistanceToPhi'] for c in cases], marker=marker, color=color, label=f'{label}: measured vs Phi')
    ax.loglog(ns, [c['finiteModelVsPhiBias'] for c in cases], '--', marker=marker, markersize=4, color=color, alpha=.75, label=f'{label}: ideal finite-n vs Phi')
ax.axhline(cases[0]['epsilon'], linestyle=':', color='#555555', label='DKW sampling-error reference (not CLT approximation error)')
ax.set(xlabel='Terms per replicate n; 4,096 replicates; seed 2048', ylabel='Maximum CDF difference on 17 fixed edges', title='CLT: separate model bias from seeded empirical noise')
ax.grid(alpha=.2, which='both'); ax.legend(fontsize=8.2)
fig.savefig(OUT/'clt-reference.svg', metadata={'Date': None}); plt.close(fig)
print(f'Wrote two figures with Matplotlib {matplotlib.__version__}')
