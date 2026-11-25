/**
 * Translated content: kernel output, lecture scripts, scientists (i18n/README.md).
 * The language itself and the UI helpers live in i18n-core.ts (no bundler-only imports, so node tests can load them).
 */
import { compileDictionary, decimalComma, translateText } from './i18n/translate.mjs';
import commonKernels from '../i18n/ru/kernels/_common.json';
import ruScientists from '../i18n/ru/scientists.json';
import { getLang, texDec } from './i18n-core';

export * from './i18n-core';

// ---------------------------------------------------------------- kernel text
type Dict = ReturnType<typeof compileDictionary>;
const kernelFiles = import.meta.glob<Record<string, string>>('../i18n/ru/kernels/*.json', { eager: true, import: 'default' });
const kernelDicts = new Map<string, Dict>();
/** Text a station kernel computed, in the current language. */
export function kernelText(kernel: string, text: string): string;
export function kernelText(kernel: string, text: string | undefined): string | undefined;
export function kernelText(kernel: string, text: string | undefined) {
  if (getLang() === 'en' || !text) return text;
  let dict = kernelDicts.get(kernel);
  if (!dict) {
    dict = compileDictionary(commonKernels as Record<string, string>, kernelFiles[`../i18n/ru/kernels/${kernel}.json`]);
    kernelDicts.set(kernel, dict);
  }
  return translateText(text, dict);
}

// ---------------------------------------------------------------- lectures and scientists
const lectureFiles = import.meta.glob<Record<string, string>>('../i18n/ru/lectures/L[0-9][0-9].json', { eager: true, import: 'default' });
const lectureDicts = new Map<number, Dict>();
/** A lecture script's text (title, step, example, notes, a formula line) in the current language. */
export function lectureText(n: number, text: string): string;
export function lectureText(n: number, text: string | undefined): string | undefined;
export function lectureText(n: number, text: string | undefined) {
  if (getLang() === 'en' || !text) return text;
  let dict = lectureDicts.get(n);
  if (!dict) {
    dict = compileDictionary(lectureFiles[`../i18n/ru/lectures/L${String(n).padStart(2, '0')}.json`]);
    lectureDicts.set(n, dict);
  }
  return translateText(text, dict);
}
/** A display formula line (TeX without `$`): its words and decimals in the current language. */
export function lectureFormula(n: number, tex: string) {
  if (getLang() === 'en') return tex;
  return texDec(lectureText(n, tex));
}

const scientists = ruScientists as Record<string, { name?: string; contribution?: string; years?: string; more?: string }>;
/** A scientist's name or contribution in the current language. */
export function scientistText(slug: string, field: 'name' | 'contribution' | 'years' | 'more', en: string) {
  if (getLang() === 'en') return en;
  return decimalComma(scientists[slug]?.[field] || en);
}

