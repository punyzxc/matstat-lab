export type Interval = { r: number; sample: number[]; estimate: number; lower: number; upper: number; critical: number; hit: boolean };
export type WallOptions = { n: number; gamma: number; law?: number; method?: number; mu?: number; sigma?: number; seed: number };
export const LAWS: readonly { id: string; label: string }[];
export const METHODS: readonly { id: string; label: string }[];
export function intervalAt(o: WallOptions & { r: number }): Interval;
export function wall(o: WallOptions, count: number): { list: Interval[]; hits: number; coverage: number | null; meanWidth: number | null };
