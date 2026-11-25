import { useEffect, useRef, useState } from 'react';
import { MathText, mathToPlain } from '../math';
import { t } from '../i18n';
import type { TextCheck } from './kernel-contract';

/**
 * A typed text parameter (#90), such as a region `y < x^2`. Each edit is checked by the kernel: a valid text
 * runs after a short pause, an invalid one is explained inline while the last valid text keeps playing.
 * Presets fill the field in one click.
 */
export function TextField({ id, label, value, presets, check, translate, onChange }: {
  id: string; label: string; value: string; presets?: string[];
  check: (text: string) => TextCheck; translate: (english: string) => string; onChange: (text: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<TextCheck>(null);
  const timer = useRef(0);
  // A new value from outside (a link, a preset) replaces the draft.
  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const apply = (text: string, now: boolean) => {
    clearTimeout(timer.current);
    const run = () => {
      const problem = check(text);
      setError(problem);
      if (!problem && text.trim() !== value.trim()) onChange(text.trim());
    };
    if (now) run();
    else timer.current = window.setTimeout(run, 450);
  };
  const message = error ? error.values.reduce((s, v, i) => s.replace(`[[${i + 1}]]`, v), translate(error.template)) : null;
  const errorId = `${id}-error`;
  return (
    <div className="text-param">
      <label htmlFor={id}><MathText text={label} /></label>
      <input id={id} className="text-param-input" type="text" autoComplete="off" spellCheck={false} value={draft}
        aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
        title={t('Type inequalities in x and y; join them with and, or. Enter applies.', 'Введите неравенства с x и y; соединяйте их словами и, или. Enter — применить.')}
        onChange={(e) => {
          setDraft(e.currentTarget.value);
          apply(e.currentTarget.value, false);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') apply(draft, true); }}
        onBlur={() => apply(draft, true)} />
      {message ? (
        <small id={errorId} className="text-param-error" role="alert">
          {message} {t(`Still playing: ${value}.`, `Пока работает прежняя: ${value}.`)}
        </small>
      ) : presets?.length ? null : (
        <small className="text-param-hint">{t('For example: y < x^2 · x^2 + y^2 < 1 · y > x and y < 2x · |x − 0.5| < 0.2', 'Например: y < x^2 · x^2 + y^2 < 1 · y > x и y < 2x · |x − 0,5| < 0,2')}</small>
      )}
      {presets && presets.length > 0 && (
        <div className="text-param-presets" role="group" aria-label={t(`${mathToPlain(label)}: examples`, `${mathToPlain(label)}: примеры`)}>
          {presets.map((p) => (
            <button key={p} type="button" className="text-param-preset" aria-pressed={p === value}
              onClick={() => {
                setDraft(p);
                apply(p, true);
              }}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
