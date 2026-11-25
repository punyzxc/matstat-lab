import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { MathText, mathToPlain } from '../math';
import { expandLiveTex, LIVE_KATEX, snapValue } from './live-tex.mjs';
import type { ParamSpec, VarSpec } from './figures/specs.mjs';
import { STORY_TEXT as T } from './story-text';
import { texDec } from '../i18n-core';

export type LiveFormulaProps = {
  tex: string;
  values: Record<string, number>;
  results: Record<string, number | null>;
  params: Record<string, ParamSpec>;
  vars: Record<string, VarSpec>;
  /** The variable lit up right now (shared with the figure). */
  hot: string | null;
  onHot: (key: string | null) => void;
  onChange: (key: string, value: number) => void;
  display?: boolean;
};

type Hint = { key: string; x: number; y: number };
type Editing = { key: string; x: number; y: number; w: number; text: string };

/**
 * A formula that is also a control (#109). Symbols bound to a variable carry its colour; hovering or focusing
 * one lights the same variable up in the figure and shows a hint. Parameter values sit inside the formula:
 * click, Enter or a digit opens an inline field, ↑/↓ nudge by one step. Results update as the experiment runs.
 */
export function LiveFormula({ tex, values, results, params, vars, hot, onHot, onChange, display = true }: LiveFormulaProps) {
  const box = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const digits = useMemo(() => {
    const d: Record<string, number> = {};
    for (const [k, v] of Object.entries(vars)) if (v.digits != null) d[k] = v.digits;
    for (const [k, p] of Object.entries(params)) if (d[k] == null) d[k] = p.step >= 1 ? 0 : Math.max(0, -Math.floor(Math.log10(p.step) + 1e-9));
    return d;
  }, [vars, params]);
  const html = useMemo(
    () => katex.renderToString(texDec(expandLiveTex(tex, { values, results, digits })), { ...LIVE_KATEX, displayMode: display }),
    [tex, values, results, digits, display],
  );

  // KaTeX gives us plain spans with data-v; dress them as controls after every render.
  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>('[data-v]').forEach((el) => {
      const key = el.dataset.v!;
      const color = vars[key]?.color ?? 'currentColor';
      el.style.setProperty('--live-color', color);
      el.classList.add('live-var');
      el.classList.toggle('is-hot', hot === key);
      if (el.dataset.role === 'edit' && params[key]) {
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `${mathToPlain(params[key].label)}: ${values[key]}. ${T.editHint}`);
      } else if (el.dataset.role === 'res') {
        el.setAttribute('aria-label', `${key} = ${el.textContent}`);
      } else if (!el.closest('[data-v][data-role]')) {
        el.tabIndex = el.parentElement?.closest('[data-v]') ? -1 : 0;
      }
    });
  }, [html, hot, vars, params, values]);

  const target = (e: { target: EventTarget | null }) => (e.target instanceof Element ? (e.target.closest('[data-v]') as HTMLElement | null) : null);
  const place = (el: HTMLElement) => {
    const r = el.getBoundingClientRect(), base = box.current!.getBoundingClientRect();
    return { x: r.left - base.left + r.width / 2, y: r.top - base.top, w: r.width, left: r.left - base.left, bottom: r.bottom - base.top };
  };
  const show = (el: HTMLElement | null) => {
    if (!el) {
      setHint(null);
      onHot(null);
      return;
    }
    const key = el.dataset.v!;
    const p = place(el);
    setHint({ key, x: p.x, y: p.y });
    onHot(key);
  };
  const openEditor = (el: HTMLElement, text?: string) => {
    const key = el.dataset.v!;
    if (el.dataset.role !== 'edit' || !params[key]) return;
    const p = place(el);
    setHint(null);
    setEditing({ key, x: p.left, y: p.bottom, w: Math.max(p.w, 48), text: text ?? String(values[key]) });
  };
  const nudge = (el: HTMLElement, dir: 1 | -1) => {
    const key = el.dataset.v!;
    const p = params[key];
    if (el.dataset.role !== 'edit' || !p) return;
    const v = snapValue(String(values[key] + dir * p.step), p);
    if (v != null) onChange(key, v);
  };

  const hintVar = hint ? vars[hint.key] : null;
  const hintParam = hint ? params[hint.key] : null;
  return (
    <div
      className={`live-formula${display ? ' live-formula--display' : ''}`}
      data-testid="live-formula"
      ref={box}
      onMouseOver={(e) => {
        const el = target(e);
        if (el?.dataset.v !== hint?.key) show(el);
      }}
      onMouseLeave={() => show(null)}
      onFocus={(e) => show(target(e))}
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node)) show(null);
      }}
      onClick={(e) => {
        const el = target(e);
        if (el) openEditor(el);
      }}
      onKeyDown={(e) => {
        const el = target(e);
        if (!el || e.target !== el) return;
        if (e.key === 'Enter' || e.key === ' ') openEditor(el);
        else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') nudge(el, 1);
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') nudge(el, -1);
        else if (/^[0-9.,-]$/.test(e.key)) openEditor(el, e.key);
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="live-formula-tex" dangerouslySetInnerHTML={{ __html: html }} />
      {hint && (hintVar || hintParam) && !editing && (
        <div className="live-hint" role="tooltip" style={{ left: hint.x, top: hint.y, ['--live-color' as string]: hintVar?.color } as CSSProperties}>
          {hintParam && <b><MathText text={hintParam.label} /></b>}
          {hintVar && <span><MathText text={hintVar.hint} /></span>}
          {hintParam && <small>{T.editShort}</small>}
        </div>
      )}
      {editing && (
        <InlineEditor
          editing={editing}
          spec={params[editing.key]}
          color={vars[editing.key]?.color}
          onDone={(v) => {
            const key = editing.key;
            setEditing(null);
            if (v != null) onChange(key, v);
            requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(`[data-v="${key}"][data-role="edit"]`)?.focus());
          }}
        />
      )}
    </div>
  );
}

function InlineEditor({ editing, spec, color, onDone }: { editing: Editing; spec: ParamSpec; color?: string; onDone: (v: number | null) => void }) {
  const [text, setText] = useState(editing.text);
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const el = ref.current!;
    el.focus();
    if (editing.text.length > 1) el.select();
    else el.setSelectionRange(el.value.length, el.value.length);
  }, [editing.text]);
  const parsed = snapValue(text, spec);
  const done = useRef(false);
  const finish = (v: number | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  return (
    <span className="live-editor" style={{ left: editing.x, top: editing.y, minWidth: editing.w, ['--live-color' as string]: color } as CSSProperties}>
      <input
        ref={ref}
        inputMode="decimal"
        aria-label={mathToPlain(spec.label)}
        aria-invalid={parsed == null}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') finish(parsed);
          else if (e.key === 'Escape') finish(null);
        }}
        onBlur={() => finish(parsed)}
      />
      <small>
        {spec.min} … {spec.max}
      </small>
    </span>
  );
}
