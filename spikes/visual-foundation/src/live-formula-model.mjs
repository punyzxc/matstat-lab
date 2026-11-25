const palette = ['#88c8ff', '#edb978', '#b7d58a', '#d4b0ed', '#79d4c5', '#f0a6b7'];
export const STANDARD_DEVIATION_FORMULA = String.raw`\v{sigma}{1}\quad\Longrightarrow\quad\operatorname{Var}(X)=\r{variance}`;

/** A scene-independent colour: remounting or rendering a second formula never changes it. */
export function variableColor(id) {
  let hash = 0;
  for (const char of id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

/** Keep the entire TeX tree intact, including fractions, roots and superscripts.
 * Only these internally generated data attributes are trusted by the renderer.
 * Markers: \v{id}{initial-number}, \r{result-id}. Values are React nodes, never HTML.
 */
export function compileFormula(source) {
  const slots = [];
  const tex = source.replace(/\\v\{([^{}]*)\}\{([^{}]*)\}|\\r\{([^{}]*)\}/g, (_, variable, initial, result) => {
    const id = variable ?? result;
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id)) throw new Error('Invalid live variable identifier');
    const value = initial == null ? undefined : Number(initial);
    if (initial != null && (!initial.trim() || !Number.isFinite(value))) throw new Error('A variable needs a finite default');
    const index = slots.push({ kind: variable == null ? 'result' : 'variable', id, value }) - 1;
    return `\\htmlData{live-slot=${index}}{\\text{0}}`;
  });
  if (/\\[vr]\{/.test(tex)) throw new Error('Malformed live formula marker');
  return { tex, slots };
}

/** Strict numeric input (including comma decimals), clamped and snapped like a parameter slider. */
export function normalizeValue(text, { min, max, step }) {
  if (![min, max, step].every(Number.isFinite) || step <= 0 || min > max) return null;
  const raw = String(text).trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(min, Math.min(max, n));
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Number(Math.max(min, Math.min(max, snapped)).toPrecision(14));
}
