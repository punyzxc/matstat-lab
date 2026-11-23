import { Activity, ChartNoAxesColumnIncreasing, Crosshair, Fingerprint, ScanLine, Waves } from 'lucide-react';

export const modules = [
  {
    id: 'distribution',
    name: 'Distribution Explorer',
    icon: ChartNoAxesColumnIncreasing,
    description: 'Sample a distribution and compare its shape with the theoretical model.',
  },
  {
    id: 'convergence',
    name: 'Convergence',
    icon: Waves,
    description: 'Track the running sample mean as the number of observations grows.',
  },
  {
    id: 'estimation',
    name: 'Estimation',
    icon: Crosshair,
    description: 'Estimate the population mean and measure the uncertainty of your estimate.',
  },
  {
    id: 'confidence',
    name: 'Confidence Intervals',
    icon: ScanLine,
    description: 'Build a confidence interval for the mean with a known population variance.',
  },
  {
    id: 'testing',
    name: 'Hypothesis Testing',
    icon: Activity,
    description: 'Use an exact two-sided sign test to compare a sample with the model median.',
  },
  {
    id: 'randomness',
    name: 'Randomness',
    icon: Fingerprint,
    description: 'Count runs on either side of the model median in the original draw order.',
  },
] as const;
export type ModuleId = (typeof modules)[number]['id'];
