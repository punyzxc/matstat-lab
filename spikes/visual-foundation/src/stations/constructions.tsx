import { useState } from 'react';
import { MathText } from '../math';
import { t, useLang } from '../i18n';
import { useStationReducedMotion } from '../motion-preference';
import type { Constructions as Data } from './kernel-contract';

/**
 * #130: the combinatorics generator. A pool of n objects and the constructions built from them: every one while there
 * are at most 120, otherwise a sample of a few (the count stays exact). Ordered constructions are in round brackets,
 * unordered ones in braces. Hovering or focusing n lights the pool, k the places of every construction, and an object
 * every construction that uses it.
 */
const LETTERS = 'abcdefghijklmnopqrstuvwxy';
type Focus = { kind: 'n' } | { kind: 'k' } | { kind: 'object'; i: number } | null;

export function Constructions({ data, drawKey }: { data: Data; drawKey: number }) {
  useLang();
  const reduced = useStationReducedMotion();
  const [focus, setFocus] = useState<Focus>(null);
  const { n, size, ordered, items, all, count } = data;
  const hover = (f: Focus) => ({ onMouseEnter: () => setFocus(f), onMouseLeave: () => setFocus(null), onFocus: () => setFocus(f), onBlur: () => setFocus(null) });
  const grouped = count.replace(/\B(?=(\d{3})+(?!\d))/g, t(',', ' '));
  const [open, close] = ordered ? ['(', ')'] : ['{', '}'];
  return (
    <section className="constructions" aria-label={t('Constructions', 'Конструкции')} data-focus={focus?.kind} data-reduced={reduced || undefined}>
      <div className="cx-head">
        <button type="button" className="cx-var" data-on={focus?.kind === 'n' || undefined} {...hover({ kind: 'n' })}><MathText text={`$n = ${n}$`} /> {t('objects', 'объектов')}</button>
        <button type="button" className="cx-var" data-on={focus?.kind === 'k' || undefined} {...hover({ kind: 'k' })}><MathText text={`$k = ${size}$`} /> {t('places', 'мест')}</button>
        <span className="cx-count" data-count={count}>
          {all ? t(`all ${grouped} constructions`, `все ${grouped} конструкций`) : t(`${grouped} constructions; ${items.length} sampled this draw`, `${grouped} конструкций; ${items.length} выбраны в этом прогоне`)}
        </span>
      </div>
      <div className="cx-pool" data-on={focus?.kind === 'n' || undefined}>
        {Array.from({ length: n }, (_, i) => (
          <button key={i} type="button" className="cx-obj" data-o={i % 8} data-on={(focus?.kind === 'object' && focus.i === i) || undefined}
            aria-label={t(`object ${LETTERS[i]}`, `объект ${LETTERS[i]}`)} {...hover({ kind: 'object', i })}>{LETTERS[i]}</button>
        ))}
      </div>
      <ol className="cx-list" key={`${drawKey}|${count}|${ordered}|${size}`} data-all={all || undefined}>
        {items.map((c, j) => {
          const uses = focus?.kind === 'object' && c.includes(focus.i);
          return (
            <li key={j} className="cx-item" data-on={uses || undefined} data-dim={(focus?.kind === 'object' && !uses) || undefined} style={{ animationDelay: `${Math.min(j, 60) * 12}ms` }}>
              {c.length === 0 ? <span className="cx-empty">∅</span> : <>
                <span className="cx-br">{open}</span>
                {c.map((o, p) => <span key={p} className="cx-slot" data-o={o % 8}>{LETTERS[o]}</span>)}
                <span className="cx-br">{close}</span>
              </>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
