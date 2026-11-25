export type Dictionary = { exact: Map<string, string>; templates: { en: string; re: RegExp; order: number[]; tr: string; literal: number }[]; cache: Map<string, string> };
export function compileDictionary(...dictionaries: (Record<string, string> | undefined | null)[]): Dictionary;
export function lookup(text: string, dict: Dictionary, depth?: number): string | null;
export function matchedKeys(text: string, dict: Dictionary, depth?: number, used?: Set<string>): Set<string>;
export function decimalComma(text: string): string;
export function translateText(text: string, dict: Dictionary): string;
export function englishLeft(text: string, allowed?: string[]): string[];
export function bareCyrillicInMath(text: string): string[];
