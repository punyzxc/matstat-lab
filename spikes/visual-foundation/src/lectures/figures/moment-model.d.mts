export const BEAM: { lo: number; hi: number; weights: number };
export type BeamLaw = { x: number[]; p: number[]; total: number; mean: number; variance: number };
export function irwinHallPdf(x: number, m: number): number;
export function beamThrows(params: Record<string, number>, seed: number, n: number): { law: BeamLaw; hits: Int8Array };
export function throwStats(law: BeamLaw, hits: Int8Array, count: number): { mean: number | null; s2: number | null };
export type MomentLaw = {
  name: string; discrete: boolean; mean: number; variance: number; skew: number; exkurt: number;
  support?: number[]; pmf?: number[]; range?: [number, number]; bins?: number; pdf?: (x: number) => number; cdf?: (x: number) => number;
};
export function lawOf(law: number, p: { lambda: number; sigma: number }): MomentLaw;
export function lawDraws(law: number, p: { lambda: number; sigma: number }, seed: number, n: number): { L: MomentLaw; xs: Float64Array };
export function within(L: MomentLaw, xs: Float64Array, k: number, count?: number): { observed: number | null; exact: number };
export function sumsOf(m: number, R: number, seed: number): Float64Array;
export function overlap(m: number, z: number, steps?: number): number;
