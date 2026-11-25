import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { MathText, mathToPlain } from './math';
import { fitToRange, parseNumberInput } from './stations/autoplay-math.mjs';
import { locale, t } from './i18n';

export function Button({ children, variant = 'secondary', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <button type={type} className={`button button--${variant} ${className}`} {...props}>{children}</button>;
}

export function Panel({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return <section className={`panel ${className}`} aria-label={label}>{children}</section>;
}

export function PanelHeading({ icon, title, trailing }: { icon: ReactNode; title: string; trailing?: ReactNode }) {
  return <div className="panel-heading"><h2>{icon}{title}</h2>{trailing}</div>;
}

/**
 * A range slider with a typed field beside it. Type a number (0,5 · 20 000 · 1/3 · π/4 · 5%) and press
 * Enter, or use ↑/↓ (Shift: ×10) in the field. Out-of-range values are clamped to the slider's range
 * and snapped to its step; the field says so.
 */
export function Slider({ id, label, value, display, min, max, step, onChange }: {
  id: string; label: string; value: number; display: string; min: number; max: number; step: number; onChange: (value: number) => void;
}) {
  const percent = (value - min) / (max - min) * 100;
  /** Labels may carry `$…$` formulas: typeset on screen, plain Unicode for assistive technology. */
  const plain = mathToPlain(label);
  const [text, setText] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef(0);
  useEffect(() => () => clearTimeout(noteTimer.current), []);
  const flash = (message: string | null) => {
    clearTimeout(noteTimer.current);
    setNote(message);
    if (message) noteTimer.current = window.setTimeout(() => setNote(null), 2600);
  };
  const parsed = text == null ? value : parseNumberInput(text);
  const commit = () => {
    if (text == null) return;
    if (parsed == null) {
      flash(t(`“${text}” is not a number`, `«${text}» — не число`));
      setText(null);
      return;
    }
    const fitted = fitToRange(parsed, min, max, step);
    flash(fitted !== parsed ? t(`Kept within ${fmtBound(min)} … ${fmtBound(max)}, step ${fmtBound(step)}`, `Ограничено диапазоном ${fmtBound(min)} … ${fmtBound(max)}, шаг ${fmtBound(step)}`) : null);
    setText(null);
    if (fitted !== value) onChange(fitted);
  };
  const nudge = (k: number) => {
    const base = parsed ?? value;
    const next = fitToRange(base + k * step, min, max, step);
    setText(String(next));
    if (next !== value) onChange(next);
  };
  const noteId = `${id}-note`;
  return <div className="range-field">
    <div className="field-line">
      <label htmlFor={id}><MathText text={label} /></label>
      <input className="range-typed" type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
        aria-label={t(`${plain}, typed value`, `${plain}, введённое значение`)} aria-invalid={text != null && parsed == null} aria-describedby={note ? noteId : undefined}
        title={t('Type a value and press Enter · ↑/↓ to step, Shift for ×10', 'Введите значение и нажмите Enter · ↑/↓ — шаг, с Shift — ×10')}
        value={text ?? display} size={Math.max(4, Math.min(10, (text ?? display).length + 1))}
        onFocus={(e) => { setText(String(value)); const el = e.currentTarget; requestAnimationFrame(() => el.select()); }}
        onChange={(e) => setText(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); (e.currentTarget as HTMLInputElement).select(); }
          else if (e.key === 'Escape' && text != null) { e.preventDefault(); e.stopPropagation(); setText(null); (e.currentTarget as HTMLInputElement).blur(); }
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            nudge((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1));
          }
        }} />
    </div>
    <input id={id} name={id} type="range" aria-label={plain} min={min} max={max} step={step} value={value} onChange={event => onChange(event.currentTarget.valueAsNumber)}
      aria-valuetext={display} style={{ background: `linear-gradient(90deg, var(--accent) ${percent}%, var(--track) ${percent}%)` }} />
    {note && <small id={noteId} className="range-note" aria-live="polite">{note}</small>}
  </div>;
}
const fmtBound = (v: number) => {
  const s = Number(v.toPrecision(6)).toLocaleString(locale(), { maximumFractionDigits: 6 });
  return (locale() === 'en-US' ? s.replace(/,/g, '\u2009') : s.replace(/[\u00a0\u202f]/g, '\u2009')).replace('-', '\u2212');
};

export function Stat({ label, actual, theoretical, id, referenceLabel = t('Theory', 'Теория') }: { label: string; actual: string; theoretical: string; id?: string; referenceLabel?: string }) {
  return <div className="stat"><dt>{label}</dt><dd className="stat-value" data-testid={id}>{actual}</dd><dd className="stat-reference">{referenceLabel} <b>{theoretical}</b></dd></div>;
}
