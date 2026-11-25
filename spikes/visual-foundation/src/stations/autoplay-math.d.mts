import type { KernelParam, Surface } from './kernel-contract';

export function parseNumberInput(text: string): number | null;
export function fitToRange(value: number, min: number, max: number, step: number): number;
export function choicesOf(param: KernelParam): { title: string; options: { value: number; label: string }[] } | null;
export function sizeParamOf(params: readonly KernelParam[]): KernelParam | null;
export const GROWTH: readonly number[];
export function grownSize(param: KernelParam, target: number, k: number): number;
export const SPEEDS: readonly number[];
export function tickDelay(speed: number, runMs: number, growing?: boolean): number;
export function ridgeOf(rows: { draw: number; x: number[]; y: number[] }[], labels: Surface['labels']): Surface | null;
export function traceSummary(values: number[], theory?: number | null): { count: number; mean: number | null; sd: number | null; theory?: number | null };
