export type ParamSpec = { label: string; min: number; max: number; step: number; default: number };
export type VarSpec = { color: string; hint: string; digits?: number };
export type FigureSpec = {
  title: string; seed: number; beats: string[]; beatTitles: Record<string, string>; params: Record<string, ParamSpec>; vars: Record<string, VarSpec>;
  station(params: Record<string, number>): { station: string; params: Record<string, number> } | null;
};
export const PALETTE: Record<string, string>;
export const FIGURES: Readonly<Record<string, FigureSpec>>;
export function figureParams(id: string, preset?: Record<string, number>): Record<string, number>;
