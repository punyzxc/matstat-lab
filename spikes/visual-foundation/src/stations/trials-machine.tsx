import { useEffect, useMemo, useRef, useState } from 'react';
import { t, useLang } from '../i18n';
import { useStationReducedMotion } from '../motion-preference';
import type { TrialsMachine as Data } from './kernel-contract';

/**
 * #115: the independent-trials machine. Rows of n trials (success lit, failure dark) arrive one after another; each
 * row collapses into its count k, and a ball drops onto the pile at k. The pile keeps growing over the draws while n
 * and p stay, and the exact law, scaled to the number of rows, is drawn over it as an outline.
 */
const W = 720, ROW_H = 13, VISIBLE = 10, TOP = 22, CELLS_W = 400, PILE_X = 472, PILE_W = 236, PILE_H = 150;
const H = TOP + Math.max(VISIBLE * ROW_H, PILE_H) + 26;
const ROW_MS = 170, LANDING_ROWS = 4;
type Row = { id: number; k: number; cells: number[] };

export function TrialsMachine({ machine, drawKey }: { machine: Data; drawKey: number }) {
  useLang();
  const reduced = useStationReducedMotion();
  const key = `${machine.n}|${machine.p}`;
  const queue = useRef<Row[]>([]);
  const landing = useRef<Row[]>([]);
  const nextId = useRef(0);
  const [shown, setShown] = useState<Row[]>([]);
  const [pile, setPile] = useState<{ key: string; counts: Map<number, number>; total: number }>({ key, counts: new Map(), total: 0 });

  // Each new draw feeds its rows to the machine; a new n or p empties the pile.
  useEffect(() => {
    const rows = machine.rows.map((r) => ({ id: nextId.current++, k: r.k, cells: r.cells }));
    if (reduced) {
      const counts = new Map<number, number>();
      for (const r of rows) counts.set(r.k, (counts.get(r.k) ?? 0) + 1);
      setShown(rows.slice(0, VISIBLE));
      setPile({ key, counts, total: rows.length });
      queue.current = [];
      return;
    }
    if (pile.key !== key) {
      queue.current = [];
      landing.current = [];
      setShown([]);
      setPile({ key, counts: new Map(), total: 0 });
    }
    queue.current = [...queue.current, ...rows].slice(-3 * rows.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawKey, key, reduced]);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => {
      const row = queue.current.shift();
      if (row) {
        setShown((s) => [row, ...s].slice(0, VISIBLE + 1));
        landing.current.push(row);
      }
      // A count joins the pile when its ball lands, about four rows later.
      if (landing.current.length > (row ? LANDING_ROWS : 0)) {
        const landed = landing.current.shift()!;
        setPile((p) => {
          const counts = new Map(p.counts);
          counts.set(landed.k, (counts.get(landed.k) ?? 0) + 1);
          return { ...p, counts, total: p.total + 1 };
        });
      }
    }, ROW_MS);
    return () => clearInterval(timer);
  }, [reduced]);

  const [a, b] = machine.window;
  const span = b - a + 1;
  const binW = PILE_W / span;
  const bx = (k: number) => PILE_X + (k - a) * binW;
  const bottom = TOP + PILE_H;
  let top = 1;
  for (const v of pile.counts.values()) top = Math.max(top, v);
  const expectTop = Math.max(...machine.exact.map((v) => (v ?? 0) * pile.total), 1);
  const unit = Math.min(9, (PILE_H - 6) / Math.max(top, expectTop));
  const outline = useMemo(
    () => machine.exact.map((v, i) => `${i ? 'L' : 'M'}${(bx(a + i) + binW / 2).toFixed(1)},${(bottom - (v ?? 0) * pile.total * unit).toFixed(1)}`).join(''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [machine.exact, pile.total, unit, a, binW],
  );
  const cells = machine.rows[0]?.cells.length ?? Math.min(machine.n, 120);
  const cw = CELLS_W / cells;
  const tickEvery = Math.max(1, Math.ceil(span / 6));

  return (
    <section className="trials-machine" aria-label={t('Trials machine', 'Машина испытаний')} data-reduced={reduced || undefined}>
      <div className="tm-head">
        <span>{t(`each row: ${machine.n} trials with p = ${machine.p} → one count k`, `каждая строка: ${machine.n} испытаний с p = ${String(machine.p).replace('.', ',')} → одно число k`)}</span>
        {machine.n > cells && <span className="tm-fold">{t(`1 cell = ${Number((machine.n / cells).toFixed(1))} trials`, `1 клетка = ${String(Number((machine.n / cells).toFixed(1))).replace('.', ',')} испытаний`)}</span>}
        <span className="tm-total" data-total={pile.total}>{t(`${pile.total} rows on the pile`, `строк в куче: ${pile.total}`)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={t(`Rows of ${machine.n} trials collapse into counts; ${pile.total} counts are piled up against the exact law`, `Строки по ${machine.n} испытаний сворачиваются в числа успехов; ${pile.total} чисел сложены в кучу рядом с точным законом`)}>
        {shown.map((row, i) => {
          const y = TOP + i * ROW_H;
          const fresh = i === 0 && !reduced;
          return (
            <g key={row.id} className="tm-row" data-k={row.k} style={{ transform: `translateY(${y}px)`, opacity: i >= VISIBLE ? 0 : 1 - i * 0.06 }}>
              <g className={fresh ? 'tm-enter' : undefined}>
              {row.cells.map((c, j) => (
                <rect key={j} className={c > 0 ? 'tm-cell tm-hit' : 'tm-cell'} x={j * cw} y={0} width={Math.max(0.6, cw - (cw > 3 ? 1 : 0))} height={ROW_H - 3}
                  style={{ opacity: c > 0 ? 0.25 + 0.75 * c : undefined, animationDelay: fresh ? `${(j / cells) * 90}ms` : undefined }} />
              ))}
              <text className="tm-k" x={CELLS_W + 10} y={ROW_H - 4}>{row.k}</text>
              </g>
            </g>
          );
        })}
        {!reduced && shown.slice(0, LANDING_ROWS + 1).map((row) => (
          <circle key={`b${row.id}`} className="tm-ball" data-k={row.k} cx={CELLS_W + 34} cy={TOP + (ROW_H - 3) / 2} r={3.2}
            style={{ ['--dx' as string]: `${bx(row.k) + binW / 2 - CELLS_W - 34}px`, ['--dy' as string]: `${bottom - TOP - (ROW_H - 3) / 2 - 4}px` }} />
        ))}
        <line className="tm-axis" x1={PILE_X} y1={bottom + 0.5} x2={PILE_X + PILE_W} y2={bottom + 0.5} />
        {[...pile.counts.entries()].filter(([k]) => k >= a && k <= b).map(([k, c]) => (
          <rect key={k} className="tm-pile" data-k={k} data-count={c} x={bx(k) + (binW > 3 ? 0.5 : 0)} y={bottom - c * unit} width={Math.max(1, binW - (binW > 3 ? 1 : 0))} height={c * unit} />
        ))}
        {pile.total > 0 && <path className="tm-exact" d={outline} />}
        {Array.from({ length: Math.floor((b - a) / tickEvery) + 1 }, (_, i) => a + i * tickEvery).map((k) => (
          <text key={k} className="tm-tick" x={bx(k) + binW / 2} y={bottom + 14} textAnchor="middle">{k}</text>
        ))}
        <text className="tm-tick" x={PILE_X + PILE_W} y={TOP - 8} textAnchor="end">{t('exact law × rows', 'точный закон × число строк')}</text>
      </svg>
    </section>
  );
}
