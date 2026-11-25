import type { ModuleId } from '../modules';

/** Lecture blocks. Each one is an orbit of stations around the globe (docs/research/lecture-module-map.md). */
export const orbits = [
  { id: 'probability', numeral: 'I', name: 'Probability', lectures: 'L1–L3' },
  { id: 'variables', numeral: 'II', name: 'Random variables', lectures: 'L4–L6' },
  { id: 'limits', numeral: 'III', name: 'Limit theorems', lectures: 'L6–L9' },
  { id: 'statistics', numeral: 'IV', name: 'Statistics', lectures: 'L10–L12' },
] as const;
export type OrbitId = (typeof orbits)[number]['id'];

type Base = { id: string; name: string; orbit: OrbitId; lectures: string; summary: string; hidden?: boolean };
/** A station backed by one of the six existing prototype instruments. */
export type LegacyStation = Base & { kind: 'legacy'; module: ModuleId };
/** A station whose kernel follows the shared contract (`spikes/<kernel>/kernel.mjs`). */
export type KernelStation = Base & { kind: 'kernel'; kernel: string; issue: number };
export type Station = LegacyStation | KernelStation;

export const stations: readonly Station[] = [
  { kind: 'kernel', id: 'urn', name: 'Urn', orbit: 'probability', lectures: 'L1', kernel: 'lecture-combinatorics', issue: 38,
    summary: 'Count ordered and unordered samples with and without replacement, then draw them.' },
  { kind: 'kernel', id: 'frequency', name: 'Frequency', orbit: 'probability', lectures: 'L1', kernel: 'lecture-geometric-probability', issue: 40,
    summary: 'Watch the relative frequency of an event settle near its probability.' },
  { kind: 'kernel', id: 'darts', name: 'Darts', orbit: 'probability', lectures: 'L1 · L4', kernel: 'lecture-geometric-probability', issue: 40,
    summary: 'Throw points into a region; compare the hit rate with the area ratio and the three Bertrand chords.' },
  { kind: 'kernel', id: 'bayes', name: 'Bayes', orbit: 'probability', lectures: 'L1 · L2', kernel: 'lecture-conditional-bayes', issue: 43,
    summary: 'Read conditional, total and posterior probabilities as counts of simulated outcomes.' },
  { kind: 'kernel', id: 'bernoulli', name: 'Bernoulli', orbit: 'probability', lectures: 'L3 · L9', kernel: 'lecture-bernoulli-approximations', issue: 39,
    summary: 'Compare the exact binomial law with the de Moivre–Laplace and Poisson approximations.' },

  { kind: 'legacy', id: 'distribution', name: 'Distribution Explorer', orbit: 'variables', lectures: 'L5', module: 'distribution',
    summary: 'Sample a distribution and compare its shape with the theoretical model.' },
  { kind: 'kernel', id: 'moments', name: 'Moments', orbit: 'variables', lectures: 'L6', kernel: 'lecture-random-vectors', issue: 44,
    summary: 'Compare mean, median, mode, skewness and kurtosis with theory; check the 3σ rule.' },
  { kind: 'kernel', id: 'transform', name: 'Transform', orbit: 'variables', lectures: 'L6', kernel: 'lecture-random-vectors', issue: 44,
    summary: 'Push a sample through y = φ(x) and compare it with the transformed density.' },
  { kind: 'kernel', id: 'scatter', name: 'Scatter', orbit: 'variables', lectures: 'L6', kernel: 'lecture-random-vectors', issue: 44,
    summary: 'Sample a random vector; read covariance, correlation and both regression lines.' },

  { kind: 'kernel', id: 'convolution', name: 'Convolution', orbit: 'limits', lectures: 'L6', kernel: 'lecture-limit-theorems', issue: 41,
    summary: 'Add uniforms and compare the exact piecewise density with the simulated sum.' },
  { kind: 'legacy', id: 'convergence', name: 'Convergence', orbit: 'limits', lectures: 'L7', module: 'convergence',
    summary: 'Track the running sample mean as the number of observations grows.' },
  { kind: 'kernel', id: 'lln', name: 'Chebyshev & LLN', orbit: 'limits', lectures: 'L7', kernel: 'lecture-limit-theorems', issue: 41,
    summary: 'Set the Chebyshev bound 1/k² against real tails, and watch running means settle, except for Cauchy.' },
  { kind: 'kernel', id: 'clt', name: 'CLT', orbit: 'limits', lectures: 'L8 · L9', kernel: 'lecture-limit-theorems', issue: 41,
    summary: 'Standardise sums of independent draws and compare them with the normal law.' },

  { kind: 'kernel', id: 'sample', name: 'Sample', orbit: 'statistics', lectures: 'L10', kernel: 'lecture-sampling-goodness-of-fit', issue: 45,
    summary: 'Build the variation series, frequency table, histogram and empirical CDF.' },
  { kind: 'kernel', id: 'fit', name: 'Fit', orbit: 'statistics', lectures: 'L10 · L12', kernel: 'lecture-sampling-goodness-of-fit', issue: 45,
    summary: 'Test a hypothesised law with the Kolmogorov and Pearson χ² criteria.' },
  { kind: 'legacy', id: 'estimation', name: 'Estimation', orbit: 'statistics', lectures: 'L11', module: 'estimation',
    summary: 'Estimate the population mean and measure the uncertainty of your estimate.' },
  { kind: 'legacy', id: 'confidence', name: 'Confidence Intervals', orbit: 'statistics', lectures: 'L11', module: 'confidence',
    summary: 'Build a confidence interval for the mean with a known population variance.' },
  { kind: 'legacy', id: 'testing', name: 'Hypothesis Testing', orbit: 'statistics', lectures: 'L12', module: 'testing',
    summary: 'Use an exact two-sided sign test to compare a sample with the model median.' },
  { kind: 'legacy', id: 'randomness', name: 'Randomness', orbit: 'statistics', lectures: 'extra', module: 'randomness',
    summary: 'Count runs on either side of the model median in the original draw order.' },
  { kind: 'kernel', id: 'contract-fixture', name: 'Contract fixture', orbit: 'probability', lectures: 'L1', kernel: 'scene-module-host', issue: 37, hidden: true,
    summary: 'Test fixture for the kernel contract; reachable only by URL.' },
];

/** Each orbit holds at most six stations: the six slots around the globe. */
export const stationsOf = (orbit: OrbitId) => stations.filter((s) => s.orbit === orbit && !s.hidden);
export const findStation = (id: string) => stations.find((s) => s.id === id);
export const orbitOfModule = (module: ModuleId): OrbitId =>
  stations.find((s): s is LegacyStation => s.kind === 'legacy' && s.module === module)?.orbit ?? 'variables';
