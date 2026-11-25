export type MathPart = { math: boolean; value: string };
export function splitMath(text: string): MathPart[];
export function texToPlain(tex: string): string;
export function mathToPlain<T>(text: T): T;
