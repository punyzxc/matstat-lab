// Live lecture figures (#110): what each figure shows and which numbers it shares with formulas and stations.
// Pure data, no React, so the script validator and `node --test` can check lecture scripts against it.
// Colours: one per variable across the whole scene (#109). Text with $…$ is typeset.

export const PALETTE = Object.freeze({
  signal: '#e8e485', cyan: '#7fd6e8', coral: '#ff8a6b', violet: '#b9a2ff', mint: '#8fe3b0', ink: '#f4f4f2',
});

/**
 * params: keys a step may preset, a reader may type, and a "what if" chip may set.
 * vars:   every key a live formula may use (\lv, \lval, \lres), with its colour and hint.
 * beats:  the scenes a step can ask the figure to show.
 * station(params): the full station this figure expands into, or null.
 */
export const FIGURES = Object.freeze({
  'clt-factory': {
    title: 'The normal distribution factory',
    seed: 808,
    beats: ['source', 'terms', 'sum', 'standardize', 'histogram', 'normal', 'race'],
    beatTitles: { source: 'One term', terms: '$n$ independent terms', sum: 'The sum $S_n$', standardize: 'Centre and scale', histogram: 'Thousands of sums', normal: 'The normal law appears', race: 'Three sources, one limit' },
    params: {
      n: { label: 'Terms in the sum $n$', min: 1, max: 100, step: 1, default: 12 },
      src: { label: 'Law of one term (0 uniform, 1 exponential, 2 Bernoulli)', min: 0, max: 2, step: 1, default: 1 },
      p: { label: 'Bernoulli $p$', min: 0.01, max: 0.99, step: 0.01, default: 0.3 },
    },
    vars: {
      n: { color: PALETTE.signal, hint: 'How many independent terms go into one sum. Type a new value.' },
      p: { color: PALETTE.mint, hint: 'Success probability of one Bernoulli term.' },
      X: { color: PALETTE.cyan, hint: 'One term: a single draw from the source law (the dots falling from the top).' },
      S: { color: PALETTE.violet, hint: 'The sum of the n terms: one bead per replicate.' },
      a: { color: PALETTE.coral, hint: 'Expectation of one term, $a = MX$.' },
      sigma: { color: PALETTE.coral, hint: 'Standard deviation of one term, $\\sigma = \\sqrt{DX}$.' },
      z: { color: PALETTE.ink, hint: 'The standardized sum: centred by $na$, scaled by $\\sigma\\sqrt{n}$. It lands in the histogram.' },
      Phi: { color: PALETTE.signal, hint: 'The standard normal law $N(0,1)$, the limit.' },
      ks: { color: PALETTE.signal, hint: 'Kolmogorov distance $\\sup_z |F_R(z) - \\Phi(z)|$ between the histogram and the normal law.', digits: 3 },
      count: { color: PALETTE.ink, hint: 'Sums made so far.', digits: 0 },
      sum: { color: PALETTE.violet, hint: 'The latest sum.', digits: 2 },
      zlast: { color: PALETTE.ink, hint: 'The latest standardized sum.', digits: 2 },
      mean: { color: PALETTE.coral, hint: 'Expectation of one term.', digits: 3 },
      sd: { color: PALETTE.coral, hint: 'Standard deviation of one term.', digits: 3 },
    },
    station: ({ n, src }) => {
      const law = [0, 1, null][Math.round(src)] ?? null;
      return law == null ? null : { station: 'clt', params: { law, n: Math.min(100, Math.max(1, Math.round(n))), R: 4000, view: 0 } };
    },
  },
  'ci-wall': {
    title: 'The confidence interval wall',
    seed: 1111,
    beats: ['sample', 'interval', 'wall'],
    beatTitles: { sample: 'One sample, one mean', interval: 'One interval', wall: 'A thousand intervals' },
    params: {
      n: { label: 'Sample size $n$', min: 2, max: 100, step: 1, default: 10 },
      gamma: { label: 'Confidence level $\\gamma$', min: 0.8, max: 0.99, step: 0.01, default: 0.95 },
      law: { label: 'Law (0 normal, 1 skewed)', min: 0, max: 1, step: 1, default: 0 },
      method: { label: 'Quantile (0 Student $t$, 1 normal $z$)', min: 0, max: 1, step: 1, default: 0 },
    },
    vars: {
      n: { color: PALETTE.signal, hint: 'Observations in each sample. Type a new value.', digits: 0 },
      gamma: { color: PALETTE.cyan, hint: 'Confidence level: the share of intervals that should cover $a$.', digits: 2 },
      a: { color: PALETTE.coral, hint: 'The true mean, unknown to the statistician: the vertical line.' },
      xbar: { color: PALETTE.violet, hint: 'Sample mean $\\bar{x}$: the centre of one interval.', digits: 3 },
      s: { color: PALETTE.mint, hint: 'Corrected sample standard deviation.', digits: 3 },
      t: { color: PALETTE.cyan, hint: 'Quantile $t_{\\gamma}$ of Student\'s law with $n - 1$ degrees of freedom (or of the normal law).', digits: 3 },
      cover: { color: PALETTE.signal, hint: 'Share of intervals so far that cover $a$.', digits: 3 },
      hits: { color: PALETTE.signal, hint: 'Intervals that cover $a$.', digits: 0 },
      count: { color: PALETTE.ink, hint: 'Intervals built so far.', digits: 0 },
      width: { color: PALETTE.mint, hint: 'Mean width of the intervals.', digits: 3 },
    },
    station: ({ n, gamma, law }) => ({ station: 'confidence', params: { n: Math.round(n), gamma, law: Math.round(law), target: 0, R: 1000, view: 1 } }),
  },
});

/** Parameter defaults of a figure merged with a preset, every value snapped into its range. */
export function figureParams(id, preset = {}) {
  const spec = FIGURES[id];
  const out = {};
  for (const [k, p] of Object.entries(spec.params)) {
    const v = Number.isFinite(preset[k]) ? preset[k] : p.default;
    out[k] = Math.min(p.max, Math.max(p.min, v));
  }
  return out;
}
