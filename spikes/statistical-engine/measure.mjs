// Prints the largest observed deviation from the SciPy oracle per model and quantity.
import { readFileSync } from 'node:fs';
import { create } from './distributions.mjs';
const ref = JSON.parse(readFileSync(new URL('./reference.json', import.meta.url), 'utf8'));
const num = (v) => (v === 'inf' ? Infinity : v === '-inf' ? -Infinity : v === 'nan' ? NaN : v);
const family = (id) => id.split('-')[0];
const params = (m) => m.params;
export function deviations() {
  const rows = [];
  for (const m of ref.models) {
    const d = create(family(m.id), params(m));
    const worst = {};
    const note = (q, a, e) => {
      e = num(e);
      if (e === a || (Number.isNaN(e) && a === null)) { worst[q] ??= 0; return; }
      const rel = Math.abs(a - e) / Math.max(Math.abs(e), Number.MIN_VALUE);
      const abs = Math.abs(a - e);
      const prev = worst[q];
      if (!prev || rel > prev.rel) worst[q] = { rel, abs, a, e };
    };
    for (const p of m.points) {
      for (const q of ['cdf', 'sf', 'pdf', 'pmf', 'logpdf', 'logpmf']) if (q in p) note(q, d[q](p.x), p[q]);
    }
    for (const p of m.ppf) note('ppf', d.ppf(p.u), p.x);
    for (const [q, e] of Object.entries(m.moments)) note(`moment.${q}`, d.moments[q], e);
    rows.push({ id: m.id, worst });
  }
  return rows;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const r of deviations()) {
    const parts = Object.entries(r.worst).filter(([, w]) => w && w.rel > 0).map(([q, w]) => `${q}: rel ${w.rel.toExponential(2)} (got ${w.a}, scipy ${w.e})`);
    console.log(r.id.padEnd(24), parts.length ? '\n   ' + parts.join('\n   ') : 'exact');
  }
}

export function highPrecisionDeviations() {
  const out = [];
  for (const m of ref.models.filter((c) => c.highPrecision)) {
    const d = create(family(m.id), params(m));
    for (const hp of m.highPrecision) {
      const scipyPoint = m.points.find((p) => p.x === hp.x);
      for (const q of ['pmf', 'logpmf', 'cdf']) {
        if (!(q in hp)) continue;
        const e = num(hp[q]);
        const rel = (v) => Math.abs(v - e) / Math.abs(e);
        out.push({ id: m.id, x: hp.x, q, js: rel(d[q](hp.x)), scipy: rel(num(scipyPoint[q])) });
      }
    }
  }
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\nRelative error against 50-digit mpmath (JS spike vs SciPy):');
  for (const r of highPrecisionDeviations()) console.log(`${r.id} x=${r.x} ${r.q}: js ${r.js.toExponential(1)}  scipy ${r.scipy.toExponential(1)}`);
}
