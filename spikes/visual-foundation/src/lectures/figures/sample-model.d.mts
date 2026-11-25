export type Law = { id: string; label: string; mean: number; variance: number; cdf: (x: number) => number; pdf: (x: number) => number; range: [number, number] };
export const LAWS: Law[];
export const POPULATION: number;
export function defaultBinCount(n: number): number;
export function population(o: { law: number; seed: number; N?: number }): { x: number[]; lift: number[] };
export type Table = { edges: number[]; h: number; counts: number[]; freq: number[]; height: number[]; area: number };
export type Described = {
  x: number[]; n: number; k: number; rank: number[]; order: number[]; bin: number[]; slot: number[]; fnAt: number[];
  table: Table; ecdf: { x: number[]; y: number[] }; sorted: number[];
  mean: number; s2: number; min: number; max: number; median: number; sum: number;
  dn: number; dAt: number; lambda: number; critical: number; a: number; variance: number;
};
export function describe(o: { law: number; n: number; bins?: number; seed: number; alpha?: number }): Described;
export function gapAt(d: Described, F: (x: number) => number): { x: number; from: number; to: number };
export function axisOf(law: number, d: Described): [number, number];
