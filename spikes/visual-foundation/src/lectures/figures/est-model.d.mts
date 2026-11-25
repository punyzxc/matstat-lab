export type Estimates = { r: number; sample: number[]; mean: number; vn: number; vn1: number };
export type EstOptions = { n: number; law?: number; sigma?: number; seed: number };
export const MU: number;
export const LADDER: readonly number[];
export function estimatesAt(o: EstOptions & { r: number }): Estimates;
export function race(o: EstOptions, count: number): { count: number; meanX: number; sdX: number; meanN: number; meanN1: number; seN1: number };
export function theory(n: number, sigma: number): { sdX: number; meanN: number; meanN1: number; bias: number };
