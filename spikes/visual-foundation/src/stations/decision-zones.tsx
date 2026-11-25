import { useEffect, useMemo, useRef, useState } from 'react';
import { SvgMathText, Tex } from '../math';
import { t, useLang } from '../i18n';
import { useStationReducedMotion } from '../motion-preference';
import type { Decisions } from './kernel-contract';

/**
 * #137: the stream of test decisions. Each experiment of a draw is a dot that flies into one of four zones,
 * keep or reject H₀ × H₀ or H₁ true. The counts add up over draws of the same experiment, and each row's
 * share is set beside α, β and the power. Only real decisions from the kernel; nothing is decorative.
 */
type Cell = 'h0-keep' | 'h0-reject' | 'h1-keep' | 'h1-reject';
type Dot = { id: number; cell: Cell; x: number; y: number; dx: number; dy: number; delay: number };

const W = 640, H = 300, PAD = 12, HEAD = 34, SIDE = 92, SOURCE = { x: SIDE + (W - SIDE) / 2, y: 6 };
const KEEP_DOTS = 320;
const col = (cell: Cell) => (cell.endsWith('keep') ? 0 : 1);
const row = (cell: Cell) => (cell.startsWith('h0') ? 0 : 1);
const cw = (W - SIDE - PAD) / 2, ch = (H - HEAD - PAD) / 2;
const cellBox = (cell: Cell) => ({ x: SIDE + col(cell) * cw, y: HEAD + row(cell) * ch });
/** A deterministic scatter inside a cell: the n-th dot of the session lands at the same place every time. */
const jitter = (k: number) => {
  let h = (k + 1) * 2654435761;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return ((h >>> 0) % 10000) / 10000;
};

const META: Record<Cell, { tex: string; note: () => string; error: boolean }> = {
  'h0-keep': { tex: '1 - \\alpha', note: () => t('correct', 'верно'), error: false },
  'h0-reject': { tex: '\\alpha', note: () => t('type I error', 'ошибка I рода'), error: true },
  'h1-keep': { tex: '\\beta', note: () => t('type II error', 'ошибка II рода'), error: true },
  'h1-reject': { tex: '1 - \\beta', note: () => t('correct: the power', 'верно: мощность'), error: false },
};
const fmt = (v: number | null | undefined, d = 3) => (v == null || !Number.isFinite(v) ? '—' : t(v.toFixed(d), v.toFixed(d).replace('.', ',')));
const texNum = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : t(v.toFixed(3), v.toFixed(3).replace('.', '{,}')));

export function DecisionZones({ decisions, drawKey, experimentKey }: { decisions: Decisions; drawKey: number; experimentKey: string }) {
  const reduced = useStationReducedMotion();
  useLang();
  const [state, setState] = useState(() => ({ key: experimentKey, dots: [] as Dot[], counts: { 'h0-keep': 0, 'h0-reject': 0, 'h1-keep': 0, 'h1-reject': 0 } as Record<Cell, number>, next: 0, seen: new Set<string>() }));
  const last = useRef<string>('');
  useEffect(() => {
    const tag = `${experimentKey}|${decisions.truth}|${drawKey}`;
    if (last.current === tag) return;
    last.current = tag;
    setState((s) => {
      const base = s.key === experimentKey ? s : { key: experimentKey, dots: [], counts: { 'h0-keep': 0, 'h0-reject': 0, 'h1-keep': 0, 'h1-reject': 0 } as Record<Cell, number>, next: 0, seen: new Set<string>() };
      if (base.seen.has(tag)) return base;
      const seen = new Set(base.seen).add(tag);
      const counts = { ...base.counts };
      const truth = decisions.truth === 0 ? 'h0' : 'h1';
      const fresh: Dot[] = decisions.reject.map((rej, i) => {
        const cell = `${truth}-${rej ? 'reject' : 'keep'}` as Cell;
        counts[cell]++;
        const k = base.next + i, box = cellBox(cell);
        const x = box.x + 14 + jitter(2 * k) * (cw - 28), y = box.y + 30 + jitter(2 * k + 1) * (ch - 40);
        return { id: k, cell, x, y, dx: SOURCE.x - x, dy: SOURCE.y - y, delay: i * 14 };
      });
      return { key: experimentKey, counts, next: base.next + fresh.length, seen, dots: [...base.dots, ...fresh].slice(-KEEP_DOTS) };
    });
  }, [decisions, drawKey, experimentKey]);

  const { counts } = state;
  const h0 = counts['h0-keep'] + counts['h0-reject'], h1 = counts['h1-keep'] + counts['h1-reject'];
  const share = (cell: Cell) => {
    const total = row(cell) === 0 ? h0 : h1;
    return total ? counts[cell] / total : null;
  };
  const theory: Record<Cell, number | null> = useMemo(() => ({
    'h0-keep': 1 - decisions.theory.alpha,
    'h0-reject': decisions.theory.alpha,
    'h1-keep': decisions.theory.beta,
    'h1-reject': decisions.theory.power,
  }), [decisions.theory]);
  const cells: Cell[] = ['h0-keep', 'h0-reject', 'h1-keep', 'h1-reject'];
  const summary = cells.map((c) => `${META[c].note()} ${counts[c]}`).join(', ');

  return (
    <section className="decision-zones" aria-label={t('Decision zones', 'Зоны решений')} data-truth={decisions.truth}>
      <p className="decision-zones-head">
        <b>{t('Stream of decisions', 'Поток решений')}</b> · {t('each dot is one experiment of this draw, tested by the rule above · now flowing: ', 'каждая точка — один опыт этой серии, проверенный правилом выше · сейчас идут опыты, где ')}
        <Tex tex={decisions.truth === 0 ? t('H_0 \\text{ true}', '\\text{верна } H_0') : t('H_1 \\text{ true}', '\\text{верна } H_1')} />
      </p>
      <div className="decision-zones-stage">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${t('Decision zones', 'Зоны решений')}: ${summary}`} data-reduced={reduced || undefined}>
          <SvgMathText className="dz-col" x={SIDE + cw / 2} y={22} anchor="middle" width={160} text={t('keep $H_0$', 'принять $H_0$')} />
          <SvgMathText className="dz-col" x={SIDE + cw * 1.5} y={22} anchor="middle" width={160} text={t('reject $H_0$', 'отвергнуть $H_0$')} />
          <SvgMathText className="dz-row" x={SIDE - 10} y={HEAD + ch / 2 + 4} anchor="end" width={84} text={t('$H_0$ true', 'верна $H_0$')} />
          <SvgMathText className="dz-row" x={SIDE - 10} y={HEAD + ch * 1.5 + 4} anchor="end" width={84} text={t('$H_1$ true', 'верна $H_1$')} />
          {cells.map((c) => {
            const b = cellBox(c);
            return (
              <g key={c} className={`dz-cell${META[c].error ? ' dz-cell--error' : ''}`} data-cell={c}
                data-active={(row(c) === 0) === (decisions.truth === 0) || undefined}>
                <rect x={b.x + 3} y={b.y + 3} width={cw - 6} height={ch - 6} rx={4} />
                <text className="dz-count" x={b.x + cw - 14} y={b.y + 22}>{counts[c]}</text>
                <text className="dz-note" x={b.x + 14} y={b.y + 22}>{META[c].note()}</text>
              </g>
            );
          })}
          <g className="dz-dots">
            {state.dots.map((d) => (
              <circle key={d.id} cx={d.x} cy={d.y} r={3.2} className={META[d.cell].error ? 'dz-dot dz-dot--error' : 'dz-dot'}
                style={{ ['--dx' as string]: `${d.dx}px`, ['--dy' as string]: `${d.dy}px`, animationDelay: `${d.delay}ms` }} />
            ))}
          </g>
        </svg>
      </div>
      <table className="decision-shares" aria-label={t('Zone shares', 'Доли зон')}>
        <thead>
          <tr><th scope="col">{t('Zone', 'Зона')}</th><th scope="col">{t('Count', 'Число')}</th><th scope="col">{t('Share of its row', 'Доля в строке')}</th><th scope="col">{t('Theory', 'Теория')}</th></tr>
        </thead>
        <tbody>
          {cells.map((c) => (
            <tr key={c} data-cell={c}>
              <th scope="row">{t('true ', 'верна ')}{row(c) === 0 ? <Tex tex="H_0" /> : <Tex tex="H_1" />}, {col(c) === 0 ? t('keep', 'принять') : t('reject', 'отвергнуть')} · {META[c].note()}</th>
              <td>{counts[c]}</td>
              <td>{fmt(share(c))}</td>
              <td><Tex tex={`${META[c].tex} = ${texNum(theory[c])}`} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
