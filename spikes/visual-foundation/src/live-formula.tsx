import { createContext, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import katex from 'katex';
import { Tex } from './math';
import { t } from './i18n-core';
import { useStationReducedMotion } from './motion-preference';
import { compileFormula, normalizeValue, variableColor } from './live-formula-model.mjs';
import './live-formula.css';

type Registry = { hovered: string | null; focused: string | null; hover: (id: string | null) => void; focus: (id: string | null) => void };
const Context = createContext<Registry | null>(null);

/** Share one scope between any lecture formula and its figure. Independent stations stay isolated. */
export function LiveFormulaScope({ children }: { children: ReactNode }) {
  const [hovered, hover] = useState<string | null>(null);
  const [focused, focus] = useState<string | null>(null);
  const registry = useMemo(() => ({ hovered, focused, hover, focus }), [hovered, focused]);
  return <Context.Provider value={registry}>{children}</Context.Provider>;
}

/** Spread on an HTML or SVG figure element. Its variable shares colour and highlight with formulas. */
export function useLiveVariable(id: string) {
  const registry = useContext(Context);
  return {
    'data-live-variable': id,
    'data-highlighted': registry?.hovered === id || registry?.focused === id ? 'true' : 'false',
    style: { '--live-variable-color': variableColor(id) } as CSSProperties,
    onMouseEnter: () => registry?.hover(id),
    onMouseLeave: () => registry?.hover(null),
    onFocus: () => registry?.focus(id),
    onBlur: () => registry?.focus(null),
  };
}

export type LiveVariableDefinition = {
  label: string;
  symbol?: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};
type Result = { value: number; label: string; format?: (value: number) => string };

/** TeX uses \v{n}{30} for a native editable value and \r{mean} for a computed result.
 * Portals go into KaTeX's own boxes, so nested fractions and radicals remain typeset.
 * Translated labels/hints are supplied by the caller, just like other scene controls.
 */
export function LiveFormula({ source, variables, results = {}, label }: {
  source: string;
  variables: Record<string, LiveVariableDefinition>;
  results?: Record<string, Result>;
  label: string;
}) {
  const compiled = useMemo(() => compileFormula(source), [source]);
  const html = useMemo(() => katex.renderToString(compiled.tex, {
    throwOnError: true, strict: 'ignore', output: 'html',
    trust: (context) => context.command === '\\htmlData',
  }), [compiled]);
  // A separate complete MathML equation gives AT the mathematical structure. The visual
  // KaTeX tree below exposes only its native controls, avoiding duplicated span-by-span speech.
  const speech = compiled.tex.replace(/\\htmlData\{live-slot=(\d+)\}\{\\text\{0\}\}/g, (_, at: string) => {
    const slot = compiled.slots[Number(at)];
    return slot.kind === 'variable'
      ? `${variables[slot.id]?.symbol ?? slot.id}=${variables[slot.id]?.value ?? slot.value}`
      : String(results[slot.id]?.value ?? '');
  });
  const host = useRef<HTMLSpanElement>(null);
  const [slots, setSlots] = useState<Element[]>([]);
  useLayoutEffect(() => {
    const found = [...(host.current?.querySelectorAll('[data-live-slot]') ?? [])];
    for (const slot of found) slot.replaceChildren();
    // KaTeX's HTML is normally hidden from AT in favour of MathML. These are native controls.
    host.current?.querySelector('.katex-html')?.removeAttribute('aria-hidden');
    for (const element of host.current?.querySelectorAll('*') ?? []) {
      if (!element.matches('[data-live-slot]') && !element.querySelector('[data-live-slot]')) element.setAttribute('aria-hidden', 'true');
    }
    setSlots(found);
  }, [html]);
  return (
    <div className="live-formula" role="group" aria-label={label}>
      <span className="sr-only live-formula-speech"><Tex tex={speech} /></span>
      <span className="live-formula-layout tex" ref={host} dangerouslySetInnerHTML={{ __html: html }} />
      {slots.map((element, index) => {
        const slot = compiled.slots[index];
        if (!slot) return null;
        const content = slot.kind === 'variable'
          ? variables[slot.id] && <Variable id={slot.id} definition={variables[slot.id]} />
          : results[slot.id] && <Computed id={slot.id} result={results[slot.id]} />;
        if (!content) throw new Error(`Missing live formula definition: ${slot.id}`);
        return createPortal(content, element, String(index));
      })}
    </div>
  );
}

function Variable({ id, definition: d }: { id: string; definition: LiveVariableDefinition }) {
  const link = useLiveVariable(id);
  const hintId = useId();
  const errorId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const text = draft ?? String(d.value);
  const apply = (raw: string) => {
    const value = normalizeValue(raw, d);
    setInvalid(value == null);
    if (value == null) return;
    setDraft(null);
    d.onChange(value);
  };
  return (
    <span className="live-variable" style={link.style}
      onMouseEnter={() => { setHovered(true); link.onMouseEnter(); }}
      onMouseLeave={() => { setHovered(false); link.onMouseLeave(); }}>
      <span aria-hidden="true"><Tex tex={`${d.symbol ?? id} =`} /></span>
      <input {...link} type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
        aria-label={t(`${d.label}, formula value`, `${d.label}, значение в формуле`)}
        aria-describedby={[d.hint ? hintId : '', invalid ? errorId : ''].filter(Boolean).join(' ') || undefined}
        aria-invalid={invalid} value={text} style={{ ...link.style, width: `${Math.max(2, text.length + 0.5)}ch` }}
        onFocus={() => { setFocused(true); link.onFocus(); }}
        onBlur={() => { setFocused(false); setDraft(null); setInvalid(false); link.onBlur(); }}
        onChange={e => { setDraft(e.target.value); setInvalid(false); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); apply(text); }
          if (e.key === 'Escape') { e.preventDefault(); setDraft(null); setInvalid(false); }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            apply(String((normalizeValue(text, d) ?? d.value) + (e.key === 'ArrowUp' ? d.step : -d.step)));
          }
        }} />
      {d.hint && <span id={hintId} role="tooltip" className="live-formula-hint" hidden={!hovered && !focused}>{d.hint}</span>}
      {invalid && <span id={errorId} role="alert" className="live-formula-error">{t('Enter a finite number.', 'Введите конечное число.')}</span>}
    </span>
  );
}

function Computed({ id, result }: { id: string; result: Result }) {
  const reduced = useStationReducedMotion();
  const [shown, setShown] = useState(result.value);
  const current = useRef(shown);
  useLayoutEffect(() => {
    let frame = 0;
    const from = current.current;
    const commit = (value: number) => { current.current = value; setShown(value); };
    if (reduced || !Number.isFinite(from) || !Number.isFinite(result.value)) { commit(result.value); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 280);
      // Commit the original computed value, never the last approximate interpolation.
      commit(progress === 1 ? result.value : from + (result.value - from) * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [result.value, reduced]);
  const format = result.format ?? String;
  return <>
    <output data-live-result={id} aria-label={result.label} aria-live="off">{format(shown)}</output>
    <span className="sr-only" aria-live="polite">{result.label}: {format(result.value)}</span>
  </>;
}
