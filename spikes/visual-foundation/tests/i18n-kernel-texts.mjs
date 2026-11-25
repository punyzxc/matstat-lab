// Every text a lecture kernel can show, for the translation tests (tests/i18n.test.mjs) and for translators:
//   node tests/i18n-kernel-texts.mjs <kernel-dir>   lists the texts the Russian dictionary does not translate yet.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileDictionary, englishLeft, translateText } from '../src/i18n/translate.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const spikes = fileURLToPath(new URL('../..', import.meta.url));

function* strings(value) {
  if (typeof value === 'string') yield value;
  else if (Array.isArray(value)) for (const v of value) yield* strings(v);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) yield* strings(v);
}
const shown = (r) => ({
  readouts: r.readouts?.map((x) => [x.label, x.convention, x.unit, typeof x.observed === 'string' ? x.observed : null, typeof x.theory === 'string' ? x.theory : null]),
  series: r.series?.map((s) => s.label),
  notes: r.notes,
  axes: r.axes,
  surface: r.surface && [r.surface.labels, r.surface.title, r.surface.sampleLabel],
  linked: r.linked && [r.linked.series?.map((s) => s.label), r.linked.axes],
});

/** A small deterministic generator for parameter sweeps. */
const lcg = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

/** Every text a kernel can show: its title, parameter labels, and the output of the defaults, of every choice and of random settings. */
export async function kernelTexts(dir) {
  const mod = await import(pathToFileURL(`${spikes}${dir}/kernel.mjs`).href);
  const kernel = mod.default ?? mod;
  const texts = new Set([kernel.meta.title]);
  const params = new Set();
  const stations = Object.keys(kernel.stations ?? { [kernel.meta.id]: {} });
  const random = lcg(11);
  for (const station of stations) {
    const declared = kernel.stations?.[station]?.params ?? kernel.meta.params;
    for (const p of declared) { texts.add(p.label); params.add(p); }
    const base = Object.fromEntries(declared.map((p) => [p.key, p.default]));
    const sets = [base];
    for (const p of declared) {
      if (p.step === 1 && p.max - p.min <= 7) for (let v = p.min; v <= p.max; v++) sets.push({ ...base, [p.key]: v });
      sets.push({ ...base, [p.key]: p.min }, { ...base, [p.key]: p.max });
    }
    const big = new Set(['n', 'N', 'R', 'reps', 'n1', 'n2', 'm']);
    for (let t = 0; t < 24; t++) {
      const s = {};
      for (const p of declared) {
        const lo = Math.min(p.min, p.max), hi = Math.max(p.min, p.max);
        let v = lo + random() * (big.has(p.key) ? Math.min(hi - lo, (hi - lo) * 0.2) : hi - lo);
        if (p.step > 0) v = lo + Math.round((v - lo) / p.step) * p.step;
        s[p.key] = Number(Math.min(hi, Math.max(lo, v)).toPrecision(12));
      }
      sets.push(s);
    }
    sets.forEach((s, i) => {
      for (const seed of [7, 1000 + i]) {
        let result;
        try { result = kernel.run(s, { seed, station }); } catch { return; }
        for (const text of strings(shown(result))) if (text) texts.add(text);
      }
    });
  }
  return { texts, params: [...params] };
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv[2]) {
  const dir = process.argv[2];
  const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {});
  const dict = compileDictionary(read(`${root}i18n/ru/kernels/_common.json`), read(`${root}i18n/ru/kernels/${dir}.json`));
  const { texts } = await kernelTexts(dir);
  const missing = [...texts].filter((t) => englishLeft(translateText(t, dict), ['ASCII', 'CSV']).length);
  // Group texts that differ only in their numbers.
  const groups = new Map();
  for (const t of missing) {
    const k = t.replace(/-?\d[\d.]*/g, '#');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  for (const [, list] of groups) console.log(list[0] + (list.length > 1 ? `   (+${list.length - 1} like it)` : ''));
  console.error(`${missing.length} texts in ${groups.size} patterns left of ${texts.size}`);
}
