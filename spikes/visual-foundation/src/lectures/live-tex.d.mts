export function liveTexKeys(src: string): { symbols: Set<string>; values: Set<string>; results: Set<string> };
export function formatLive(value: number | null | undefined, digits?: number, trim?: boolean): string;
export function expandLiveTex(src: string, o?: { values?: Record<string, number>; results?: Record<string, number | null>; digits?: Record<string, number> }): string;
export const LIVE_KATEX: { throwOnError: boolean; strict: 'ignore'; output: 'html'; trust: (ctx: { command: string }) => boolean };
export function snapValue(text: string, range?: { min?: number; max?: number; step?: number }): number | null;
