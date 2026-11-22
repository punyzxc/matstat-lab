export type Distribution = 'normal' | 'uniform' | 'exponential';
export type RunSettings = { distribution: Distribution; scale: number; count: number; seed: number };
type Bounds = [number, number];
type Model = {
  label: string;
  notation: string;
  parameter: string;
  description: string;
  sample: (random: () => number, scale: number) => number;
  density: (x: number, scale: number) => number;
  cdf: (x: number, scale: number) => number;
  domain: (scale: number) => Bounds;
  theory: (scale: number) => [number, number];
};

function normalCdf(x: number) {
  if (x === 0) return 0.5;
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const p = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) *
    t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - p : p;
}

export const sources: Record<Distribution, Model> = {
  normal: {
    label: 'Normal (Gaussian)',
    notation: 'N(0, σ²)',
    parameter: 'Standard deviation σ',
    description: 'A symmetric bell centered at zero. The standard deviation controls how far observations spread around the mean.',
    sample: (random, scale) => scale * Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random()),
    density: (x, scale) => Math.exp(-0.5 * (x / scale) ** 2) / (scale * Math.sqrt(2 * Math.PI)),
    cdf: (x, scale) => normalCdf(x / scale),
    domain: (scale) => [-4 * scale, 4 * scale],
    theory: (scale) => [0, scale ** 2],
  },
  uniform: {
    label: 'Uniform',
    notation: 'U(−a, a)',
    parameter: 'Half-width a',
    description: 'Equal-length intervals within the support carry the same probability. Observations cluster differently by chance.',
    sample: (random, scale) => (2 * random() - 1) * scale,
    density: (x, scale) => Math.abs(x) <= scale ? 1 / (2 * scale) : 0,
    cdf: (x, scale) => Math.max(0, Math.min(1, (x + scale) / (2 * scale))),
    domain: (scale) => [-1.5 * scale, 1.5 * scale],
    theory: (scale) => [0, scale ** 2 / 3],
  },
  exponential: {
    label: 'Exponential',
    notation: 'Exp(scale β)',
    parameter: 'Scale β',
    description: 'A right-skewed waiting-time model. Larger values are rarer, but the theoretical support extends beyond the visible chart.',
    sample: (random, scale) => -scale * Math.log(random()),
    density: (x, scale) => x >= 0 ? Math.exp(-x / scale) / scale : 0,
    cdf: (x, scale) => x >= 0 ? -Math.expm1(-x / scale) : 0,
    domain: (scale) => [0, 8 * scale],
    theory: (scale) => [scale, scale ** 2],
  },
};

export const initialSettings: RunSettings = { distribution: 'normal', scale: 1, count: 512, seed: 2048 };

export function collect({ distribution, scale, count, seed }: RunSettings) {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed = mixed ^ (mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61));
    return (((mixed ^ (mixed >>> 14)) >>> 0) + 0.5) / 4294967296;
  };
  return Array.from({ length: count }, () => sources[distribution].sample(random, scale));
}

export function histogram(sample: number[], [min, max]: Bounds, binCount = 28, normalization = sample.length) {
  const width = (max - min) / binCount;
  const counts = Array<number>(binCount).fill(0);
  let outside = 0;
  for (const value of sample) {
    if (value < min || value > max) {
      outside++;
      continue;
    }
    const bin = Math.min(binCount - 1, Math.floor((value - min) / width));
    counts[bin]++;
  }
  return { counts, width, outside, density: counts.map(count => normalization ? count / (normalization * width) : 0) };
}

export function moments(sample: number[]) {
  if (sample.length === 0) return null;
  let mean = 0;
  let m2 = 0;
  sample.forEach((value, index) => {
    const delta = value - mean;
    mean += delta / (index + 1);
    m2 += delta * (value - mean);
  });
  const variance = sample.length > 1 ? m2 / (sample.length - 1) : null;
  return { mean, variance, deviation: variance === null ? null : Math.sqrt(variance) };
}

export function asciiHistogram(counts: number[], rows = 12, peak = Math.max(1, ...counts)) {
  return Array.from({ length: rows }, (_, index) => {
    const level = rows - index;
    return counts.map(count => {
      const height = count / peak * rows;
      return height >= level ? '@' : height > level - 0.65 ? ':' : ' ';
    }).join(' ');
  }).join('\n') + '\n' + '─'.repeat(counts.length * 2 - 1);
}

