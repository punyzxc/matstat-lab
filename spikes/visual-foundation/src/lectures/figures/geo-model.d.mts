export const BERTRAND: readonly { id: string; label: string; exact: number; long: (u: number, v: number) => boolean }[];
export const BOARD: { strips: number; width: number };
export function buffonP(l: number, d: number): number;
export type Darts = { xs: Float64Array; ys: Float64Array };
export function darts(seed: number, N: number, from?: number): Darts;
export function inA(x: number, a: number): boolean;
export function inB(x: number, b: number): boolean;
export function unionText(a: number, b: number): string;
export function additive(d: Darts, a: number, b: number, count?: number): {
  mA: number; mB: number; mU: number; mAB: number; count: number; exact: { A: number; B: number; U: number; AB: number };
};
export function quarter(d: Darts, count?: number): { m: number; share: number | null; pi: number | null };
export type Needles = { l: number; d: number; hit: Uint8Array; x: Float64Array; y: Float64Array; theta: Float64Array };
export function needles(seed: number, N: number, l: number, d: number): Needles;
export function crossings(nd: Needles, count?: number): { m: number; share: number | null; pi: number | null };
export type Chords = { id: string; exact: number; long: Uint8Array; ends: Float64Array };
export function chords(seed: number, N: number): Chords[];
export function longShare(c: Chords, count?: number): number | null;
export function piPath(source: Darts | Needles, N: number): [number, number][];
