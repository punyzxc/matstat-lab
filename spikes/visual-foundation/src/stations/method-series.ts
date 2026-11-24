import type { ModuleId } from '../modules';
import { histogram, sources, type RunSettings } from '../statistics';
import type { Series } from './kernel-contract';

/** At most ~400 plotted points per line, always keeping the last one. */
function thin(n: number, max = 400) {
  const step = Math.max(1, Math.ceil(n / max));
  const out: number[] = [];
  for (let k = step; k < n; k += step) out.push(k);
  if (n) out.push(n);
  return out;
}

function runningMeans(sample: number[]) {
  const out = new Float64Array(sample.length);
  let s = 0;
  sample.forEach((x, i) => (out[i] = (s += x) / (i + 1)));
  return out;
}

function binomialPmf(n: number) {
  // log-space weights of Binomial(n, ½); exact enough for n ≤ 4096
  const out: number[] = [];
  let log = -n * Math.LN2;
  for (let k = 0; k <= n; k++) {
    out.push(Math.exp(log));
    log += Math.log((n - k) / (k + 1));
  }
  return out;
}

/** Real chart data for each prototype method, computed from the same seeded sample prefix. */
export function methodSeries(id: ModuleId, sample: number[], settings: RunSettings): { series: Series[]; x: string; y: string; domain?: { x?: [number, number] } } {
  const model = sources[settings.distribution];
  const [mu, variance] = model.theory(settings.scale);
  const sigma = Math.sqrt(variance);
  const n = sample.length;
  const means = runningMeans(sample);
  const ks = thin(n);
  switch (id) {
    case 'convergence':
      return {
        x: 'number of observations k',
        y: 'running mean x̄ₖ',
        series: [
          { id: 'band', kind: 'band', label: 'μ ± 2σ/√k (theory)', tone: 'signal', x: ks, y: ks.map((k) => mu - (2 * sigma) / Math.sqrt(k)), y2: ks.map((k) => mu + (2 * sigma) / Math.sqrt(k)) },
          { id: 'mu', kind: 'line', label: `μ = ${mu.toFixed(3)}`, tone: 'signal', x: [1, n], y: [mu, mu] },
          { id: 'mean', kind: 'line', label: 'x̄ₖ (this sample)', x: ks, y: ks.map((k) => means[k - 1]) },
        ],
      };
    case 'estimation': {
      let s2 = 0;
      for (const x of sample) s2 += (x - means[n - 1]) ** 2;
      const se = Math.sqrt(s2 / Math.max(1, n - 1) / n);
      const bins = histogram(sample, model.domain(settings.scale), 28);
      const edges = bins.counts.map((_, i) => model.domain(settings.scale)[0] + i * bins.width);
      const top = Math.max(...bins.density, 1e-9);
      return {
        x: 'value x',
        y: 'density',
        series: [
          { id: 'hist', kind: 'hist', label: 'sample histogram', tone: 'muted', x: edges, y: bins.density },
          { id: 'se', kind: 'band', label: 'x̄ ± 1.96·s/√n', tone: 'accent', x: [means[n - 1] - 1.96 * se, means[n - 1] + 1.96 * se], y: [0, 0], y2: [top, top] },
          { id: 'mu', kind: 'rule', label: `true μ = ${mu.toFixed(3)}`, tone: 'signal', x: [mu], y: [0] },
          { id: 'xbar', kind: 'rule', label: `x̄ = ${means[n - 1].toFixed(3)}`, x: [means[n - 1]], y: [0] },
        ],
      };
    }
    case 'confidence':
      return {
        x: 'number of observations k',
        y: 'interval for μ',
        series: [
          { id: 'ci', kind: 'band', label: '95% Chebyshev interval x̄ₖ ± √(σ²/0.05k)', tone: 'accent', x: ks, y: ks.map((k) => means[k - 1] - Math.sqrt(variance / (0.05 * k))), y2: ks.map((k) => means[k - 1] + Math.sqrt(variance / (0.05 * k))) },
          { id: 'mean', kind: 'line', label: 'x̄ₖ', x: ks, y: ks.map((k) => means[k - 1]) },
          { id: 'mu', kind: 'line', label: `true μ = ${mu.toFixed(3)}`, tone: 'signal', x: [1, n], y: [mu, mu] },
        ],
      };
    case 'testing': {
      const median = settings.distribution === 'exponential' ? settings.scale * Math.LN2 : 0;
      const signs = sample.filter((x) => x !== median);
      const m = signs.length;
      const above = signs.filter((x) => x > median).length;
      const low = Math.min(above, m - above);
      const pmf = binomialPmf(m);
      const k = pmf.map((_, i) => i);
      const tail = k.filter((i) => i <= low || i >= m - low);
      const spread = 4.5 * Math.sqrt(m) / 2;
      const lo = Math.max(0, Math.floor(Math.min(m / 2 - spread, above - 2)));
      const hi = Math.min(m, Math.ceil(Math.max(m / 2 + spread, above + 2)));
      return {
        domain: { x: [lo, hi] },
        x: 'K = observations above the model median',
        y: 'P(K = k) under H₀',
        series: [
          { id: 'null', kind: 'pmf', label: 'Binomial(n, ½)', tone: 'muted', x: k, y: pmf },
          { id: 'tail', kind: 'pmf', label: 'as or more extreme (p-value)', tone: 'accent', x: tail, y: tail.map((i) => pmf[i]) },
          { id: 'obs', kind: 'rule', label: `observed K = ${above}`, tone: 'signal', x: [above], y: [0] },
        ],
      };
    }
    case 'randomness': {
      const median = settings.distribution === 'exponential' ? settings.scale * Math.LN2 : 0;
      const signs = sample.filter((x) => x !== median).map((x) => x > median);
      const m = signs.length;
      const n1 = signs.filter(Boolean).length, n2 = m - n1;
      const runs = signs.reduce((t, v, i) => t + Number(i === 0 || v !== signs[i - 1]), 0);
      // Wald–Wolfowitz: E R = 1 + 2n₁n₂/m, Var R = 2n₁n₂(2n₁n₂ − m) / (m²(m − 1))
      const er = 1 + (2 * n1 * n2) / m;
      const vr = (2 * n1 * n2 * (2 * n1 * n2 - m)) / (m * m * (m - 1));
      const sd = Math.sqrt(Math.max(vr, 1e-12));
      const xs = Array.from({ length: 161 }, (_, i) => er - 4 * sd + (8 * sd * i) / 160);
      return {
        x: 'number of runs R',
        y: 'approximate density under H₀',
        series: [
          { id: 'null', kind: 'pdf', label: 'normal approximation to R under randomness', tone: 'muted', x: xs, y: xs.map((x) => Math.exp(-0.5 * ((x - er) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI))) },
          { id: 'er', kind: 'rule', label: `E R = ${er.toFixed(1)}`, tone: 'muted', x: [er], y: [0] },
          { id: 'obs', kind: 'rule', label: `observed R = ${runs}`, tone: 'signal', x: [runs], y: [0] },
        ],
      };
    }
    default:
      return { x: 'value x', y: 'density', series: [] };
  }
}
