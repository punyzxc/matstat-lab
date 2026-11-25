export type Region = { lower: number | null; upper: number | null };
export const TAILS: readonly string[];
export function regionOf(alpha: number, tail: number): Region;
export function rejects(u: number, r: Region): boolean;
export function errorsOf(o: { n: number; d: number; alpha: number; tail: number }): { region: Region; delta: number; alpha: number; power: number | null; beta: number | null };
export function courtCases(o: { n: number; d: number; alpha: number; tail: number; seed: number; R: number }): { h0: number[]; h1: number[]; hits0: number; hits1: number };
export function powerCurve(o: { n: number; alpha: number; tail: number; seed: number; R: number; grid: number[] }): { grid: number[]; exact: number[]; simulated: number[]; R: number };
export function phi(x: number): number;
