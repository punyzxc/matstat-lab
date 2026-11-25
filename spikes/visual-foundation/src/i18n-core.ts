/**
 * The lab's language: Russian by default, English on the EN switch (i18n/README.md).
 * One global value; the app re-renders from its root when it changes, so a switch is instant and
 * keeps every running experiment, its parameters and its draws.
 */
import { useSyncExternalStore } from 'react';
import { decimalComma } from './i18n/translate.mjs';

export type Lang = 'ru' | 'en';
const KEY = 'statum-lab:lang';
const isLang = (v: unknown): v is Lang => v === 'ru' || v === 'en';

function initial(): Lang {
  if (typeof window === 'undefined') return 'ru';
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (isLang(q)) return q;
  } catch { /* no URL */ }
  try {
    const v = localStorage.getItem(KEY);
    if (isLang(v)) return v;
  } catch { /* private mode */ }
  return 'ru';
}

let lang: Lang = initial();
const listeners = new Set<() => void>();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export const getLang = () => lang;
export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* private mode: the choice lasts for this visit */ }
  document.documentElement.lang = next;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** The current language; a component that calls it re-renders on a switch. */
export const useLang = () => useSyncExternalStore(subscribe, getLang, getLang);

/** The text in the current language: `t('Lectures', 'Лекции')`. */
export const t = (en: string, ru: string) => (lang === 'en' ? en : ru);

/** Russian plural form for `n`: plural(5, 'прогон', 'прогона', 'прогонов') → 'прогонов'. */
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(Math.trunc(n)) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

/** BCP 47 locale for number formatting. */
export const locale = () => (lang === 'en' ? 'en-US' : 'ru-RU');
/** A number already formatted with a decimal point, in the current language's style (Russian: decimal comma). */
export const dec = (s: string) => (lang === 'en' ? s : decimalComma(s));
/** A TeX formula (without `$`) with Russian decimal commas: `0.05` → `0{,}05`. */
export const texDec = (tex: string) => (lang === 'en' ? tex : decimalComma(`$${tex}$`).slice(1, -1));
/** Thousands grouped with a thin space in both languages, as the lab always wrote them: 4 294 967 295. */
export const int = (v: number) => Math.round(v).toLocaleString('en-US').replace(/,/g, ' ');

/**
 * Gives `target` getters that return its English value or, in Russian, the value from `ru`.
 * For module-level tables (stations, orbits, distributions): every reader sees the current language.
 */
export function localized<T extends object>(target: T, ru: { [K in keyof T]?: string }): T {
  for (const key of Object.keys(ru) as (keyof T)[]) {
    const en = target[key];
    Object.defineProperty(target, key, { get: () => (lang === 'en' ? en : ru[key]), enumerable: true, configurable: true });
  }
  return target;
}
