import { moments, sources, type RunSettings } from './statistics.ts';
import type { ModuleId } from './modules.ts';

function signProbability(n: number, k: number) {
  // Relative binomial weights avoid factorial overflow even for the largest supported n.
  const mode = Math.floor(n / 2);
  let weight = 1,
    total = 1,
    tail = mode <= k || mode >= n - k ? 1 : 0;
  for (let i = mode - 1; i >= 0; i--) {
    weight *= (i + 1) / (n - i);
    total += weight;
    if (i <= k || i >= n - k) tail += weight;
  }
  weight = 1;
  for (let i = mode + 1; i <= n; i++) {
    weight *= (n - i + 1) / i;
    total += weight;
    if (i <= k || i >= n - k) tail += weight;
  }
  return Math.min(1, tail / total);
}

export function moduleReadout(id: ModuleId, sample: number[], settings: RunSettings) {
  const stats = moments(sample)!;
  const n = sample.length;
  const [mean, variance] = sources[settings.distribution].theory(settings.scale);
  const median = settings.distribution === 'exponential' ? settings.scale * Math.LN2 : 0;
  // All supported models are continuous. Exact ties carry no sign.
  const signs = sample.filter((x) => x !== median).map((x) => x > median);
  const above = signs.filter(Boolean).length;
  const runs = signs.reduce((total, value, i) => total + Number(i === 0 || value !== signs[i - 1]), 0);
  const v = (x: number) => x.toFixed(4);
  switch (id) {
    case 'convergence':
      return {
        label: 'Running sample mean',
        value: v(stats.mean),
        formula: 'x̄ₙ = Σxᵢ / n',
        detail: `The model mean is ${v(mean)}. Absolute error at n = ${n} is ${v(Math.abs(stats.mean - mean))}.`,
      };
    case 'estimation':
      return {
        label: 'Estimated standard error',
        value: v(stats.deviation! / Math.sqrt(n)),
        formula: 'SE = s / √n',
        detail: `The point estimate is ${v(stats.mean)}. The estimated standard error uses sample standard deviation s = ${v(stats.deviation!)}.`,
      };
    case 'confidence': {
      const radius = Math.sqrt(variance / (0.05 * n));
      return {
        label: '95% Chebyshev interval',
        value: `[${v(stats.mean - radius)}, ${v(stats.mean + radius)}]`,
        formula: 'x̄ ± √(σ² / 0.05n)',
        detail:
          'With independent draws and known finite population variance, this interval has at least 95% repeated-sample coverage.',
      };
    }
    case 'testing':
      return {
        label: 'Two-sided p-value',
        value: v(signProbability(signs.length, Math.min(above, signs.length - above))),
        formula: 'K ∼ Binomial(n, ½) under H₀',
        detail: `${above} of ${signs.length} non-tied observations exceed the model median ${v(median)}. The test sums both equally extreme binomial tails.`,
      };
    case 'randomness':
      return {
        label: 'Observed runs',
        value: String(runs),
        formula: 'R = 1 + number of sign changes',
        detail: `Each run is a consecutive group on one side of the model median. For ${signs.length} independent fair signs, the expected run count is ${v(signs.length ? (signs.length + 1) / 2 : 0)}.`,
      };
    default:
      return {
        label: 'Sample mean',
        value: v(stats.mean),
        formula: 'x̄ = Σxᵢ / n',
        detail: sources[settings.distribution].description,
      };
  }
}
