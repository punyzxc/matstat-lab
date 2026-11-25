export type Dice = { values: number[]; support: number[]; pmf: number[]; picks: Int8Array; xs: Float64Array; mean: number };
export function dice(map: number, a: number, b: number, seed: number, n: number): Dice;
export function diceF(d: { support: number[]; pmf: number[] }, x: number): number;
export function diceJump(d: { support: number[]; pmf: number[] }, x: number): number;
export type CdfLaw = { name: string; domain: [number, number]; pdf: (x: number) => number; cdf: (x: number) => number; mean: number; from: number; to: number; tex: string };
export function continuous(source: number, seed: number, n: number): { law: CdfLaw; xs: Float64Array };
export function areaLeft(law: CdfLaw, x: number): number;
export function empirical(xs: Float64Array, x: number, count?: number): { F: number | null; jump: number | null; mean: number | null };
