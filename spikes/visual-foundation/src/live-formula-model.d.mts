export type FormulaSlot = { kind: 'variable' | 'result'; id: string; value?: number };
export const STANDARD_DEVIATION_FORMULA: string;
export function compileFormula(source: string): { tex: string; slots: FormulaSlot[] };
export function normalizeValue(text: string, range: { min: number; max: number; step: number }): number | null;
export function variableColor(id: string): string;
