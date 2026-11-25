// Every `$…$` formula a kernel shows (labels, readouts, notes, axes, parameter labels) must typeset in KaTeX,
// and no formula-looking text is left outside `$…$` in the labels the stations show.
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import katex from 'katex';
import { splitMath } from '../src/math-text.mjs';

const spikes = fileURLToPath(new URL('../..', import.meta.url));
const kernels = readdirSync(spikes).filter((d) => existsSync(`${spikes}${d}/kernel.mjs`)).sort();

function* strings(value) {
  if (typeof value === 'string') yield value;
  else if (Array.isArray(value)) for (const v of value) yield* strings(v);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) yield* strings(v);
}
const shown = (result) => ({
  readouts: result.readouts?.map((r) => [r.label, r.convention, typeof r.observed === 'string' ? r.observed : null, typeof r.theory === 'string' ? r.theory : null]),
  series: result.series?.map((s) => s.label),
  notes: result.notes,
  axes: result.axes,
  surface: result.surface && [result.surface.labels, result.surface.title],
});

/** Every view of a kernel: each integer value of a `view`/`law`/`mode`-like selector, plus the defaults. */
function runs(mod) {
  const kernel = mod.default ?? mod;
  const stations = Object.keys(kernel.stations ?? { [kernel.meta.id]: {} });
  const out = [];
  for (const station of stations) {
    const params = kernel.stations?.[station]?.params ?? kernel.meta.params;
    const base = Object.fromEntries(params.map((p) => [p.key, p.default]));
    out.push({ station, params: base, declared: params });
    for (const p of params)
      if (p.step === 1 && p.max - p.min <= 6)
        for (let v = p.min; v <= p.max; v++) out.push({ station, params: { ...base, [p.key]: v }, declared: params });
  }
  return { kernel, out };
}

// Unicode look-alikes of math (subscripts, Greek letters, √, Σ, ≤) belong inside `$…$`, never in the plain text around it.
const LOOSE_MATH = /[ₙᵢₖᵣ₀₁₂₃²³⁴⁺⁻ᵏⁿ√Σ∑∫≤≥≈σμξ̄λχφΦθ∼αβγεηρ≠∞π½δκ]/u;

test('every kernel formula typesets in KaTeX, and no formula is left as plain text', async () => {
  let formulas = 0;
  const loose = [];
  for (const dir of kernels) {
    const { kernel, out } = runs(await import(pathToFileURL(`${spikes}${dir}/kernel.mjs`).href));
    const texts = new Set([kernel.meta.title, ...out.flatMap((o) => o.declared.map((p) => p.label))]);
    for (const o of out) {
      let result;
      try { result = kernel.run(o.params, { seed: 7, station: o.station }); } catch { continue; }
      for (const s of strings(shown(result))) if (s) texts.add(s);
    }
    for (const text of texts)
      for (const part of splitMath(text)) {
        if (!part.math) {
          if (LOOSE_MATH.test(part.value)) loose.push(`${dir}: ${text}`);
          continue;
        }
        formulas++;
        assert.doesNotThrow(() => katex.renderToString(part.value, { throwOnError: true }), `${dir}: ${part.value}  (in "${text}")`);
      }
  }
  assert.ok(formulas > 100, `kernels mark their formulas (${formulas})`);
  assert.deepEqual(loose, [], 'formulas written as plain Unicode text');
});
