export type Point3 = [number, number, number];
export type View = { yaw?: number; pitch?: number };
export type Viewport = { cx?: number; cy?: number; scale?: number };
export type Projected = { x: number; y: number; depth: number };
export function project(point: readonly number[], view?: View, viewport?: Viewport): Projected;
export function quadsByDepth<T extends { points: readonly (readonly number[])[]; bias?: number }>(
  items: readonly T[],
  view?: View,
  viewport?: Viewport,
): { item: T; index: number; points: Projected[]; depth: number }[];
export function niceTicks(lo: number, hi: number, target?: number): number[];
export function clamp(v: number, lo: number, hi: number): number;
export function lerp(a: number, b: number, t: number): number;
export function easeOutCubic(t: number): number;
export function lerpArray(a: readonly number[], b: readonly number[], t: number): number[];
export function lerpGrid(a: readonly (readonly number[])[], b: readonly (readonly number[])[], t: number): number[][];
export function unit(v: number, lo: number, hi: number): number;
