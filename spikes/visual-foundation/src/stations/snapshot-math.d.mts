import type { KernelResult, Series } from './kernel-contract';

export type Snap = { slot: string; seed: number; params: Record<string, number>; texts: Record<string, string>; hidden: boolean };
export const SNAP_SLOTS: string[];
export function encodeSnap(s: Snap): string;
export function decodeSnap(code: string): Snap | null;
export function decodeSnaps(codes: readonly string[] | undefined): Snap[];
export function freeSlot(snaps: readonly Snap[]): string | null;
export function sameSnap(a: Snap, b: Snap): boolean;
export function ghostSeries(result: Pick<KernelResult, 'series'>, slot: string, label: string): Series[];
export function sameAxes(a: KernelResult['axes'], b: KernelResult['axes']): boolean;
