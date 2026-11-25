import { SvgMathText } from '../math';
import { t, useLang } from '../i18n';
import { useStationReducedMotion } from '../motion-preference';
import type { Outcomes } from './kernel-contract';

/**
 * #131: a random variable is a function on the outcome space. The 36 outcomes ω = (ω₁, ω₂) of two dice sit in a
 * grid, each labelled with its value X(ω); the outcomes of the event {X ≤ x} are lit. The first experiments of each
 * draw fly from their cell to the number line, where the columns stack into the law (outline: exact P(X = x_k),
 * fill: the share among the n experiments of this draw).
 */
const W = 640, H = 270, CELL = 27, GX = 44, GY = 44, LX0 = 260, LX1 = 624, BASE = 222, TOP = 52;
const fmt = (v: number, d = 3) => t(String(Number(v.toFixed(d))), String(Number(v.toFixed(d))).replace('.', ','));
const signed = (v: number) => (v < 0 ? `−${-v}` : String(v));

export function OutcomeFlight({ outcomes, drawKey }: { outcomes: Outcomes; drawKey: number }) {
  useLang();
  const reduced = useStationReducedMotion();
  const { values, picks, support, pmf, counts, n, x } = outcomes;
  const k = support.length, colW = (LX1 - LX0) / Math.max(k, 1);
  const colX = (v: number) => LX0 + (support.indexOf(v) + 0.5) * colW;
  const peak = Math.max(...pmf, ...counts.map((c) => c / n), 1e-9);
  const hgt = (p: number) => (p / peak) * (BASE - TOP);
  const cell = (i: number) => ({ cx: GX + (i % 6) * CELL + CELL / 2, cy: GY + Math.floor(i / 6) * CELL + CELL / 2 });
  const lit = values.filter((v) => v <= x).length;
  const at = interp(support, x), bound = at >= -0.5 && at <= k - 0.5 ? LX0 + (at + 0.5) * colW : null;
  // Each flying dot lands on its column, stacked by its order among the flights of the same value.
  const seen = new Map<number, number>();
  const flights = picks.map((p, i) => {
    const v = values[p], j = seen.get(v) ?? 0;
    seen.set(v, j + 1);
    const from = cell(p), to = { x: colX(v), y: BASE - 5 - j * 7 };
    return { i, v, x: to.x, y: Math.max(TOP, to.y), dx: from.cx - to.x, dy: from.cy - Math.max(TOP, to.y) };
  });
  const summary = t(`Outcome space of two dice: ${lit} of 36 outcomes have X ≤ ${fmt(x)}`, `Пространство исходов двух костей: у ${lit} из 36 исходов X ≤ ${fmt(x)}`);

  return (
    <section className="outcome-flight" aria-label={t('Outcomes to values', 'Исходы и значения')}>
      <p className="outcome-flight-head">
        <b>{t('From outcomes to values', 'От исходов к значениям')}</b> · {t(`each cell is an outcome ω with its value X(ω); lit: the event {X ≤ x}, ${lit} of 36`, `каждая клетка — исход ω и его значение X(ω); подсвечено событие {X ≤ x}: ${lit} из 36`)}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} data-reduced={reduced || undefined} data-lit={lit}>
        <SvgMathText className="of-axis-title" x={GX + 3 * CELL} y={20} anchor="middle" width={120} text="$\omega_2$" />
        <SvgMathText className="of-axis-title" x={GX - 26} y={GY + 3 * CELL + 4} anchor="middle" width={40} text="$\omega_1$" />
        {[1, 2, 3, 4, 5, 6].map((d) => (
          <g key={d} className="of-face">
            <text x={GX + (d - 0.5) * CELL} y={GY - 8}>{d}</text>
            <text x={GX - 8} y={GY + (d - 0.5) * CELL + 4}>{d}</text>
          </g>
        ))}
        {values.map((v, i) => {
          const c = cell(i);
          return (
            <g key={i} className="of-cell" data-in={v <= x || undefined}>
              <rect x={c.cx - CELL / 2 + 1} y={c.cy - CELL / 2 + 1} width={CELL - 2} height={CELL - 2} rx={3} />
              <text x={c.cx} y={c.cy + 4}>{signed(v)}</text>
            </g>
          );
        })}
        <line className="of-line" x1={LX0} x2={LX1} y1={BASE} y2={BASE} />
        {support.map((v, i) => {
          const cx = colX(v), share = counts[i] / n;
          return (
            <g key={v} className="of-col" data-in={v <= x || undefined}>
              <rect className="of-col-sample" x={cx - colW * 0.32} y={BASE - hgt(share)} width={colW * 0.64} height={hgt(share)} />
              <rect className="of-col-theory" x={cx - colW * 0.4} y={BASE - hgt(pmf[i])} width={colW * 0.8} height={hgt(pmf[i])} />
              {(k <= 16 || i % 2 === 0) && <text x={cx} y={BASE + 16}>{signed(v)}</text>}
            </g>
          );
        })}
        {bound != null && <line className="of-bound" x1={bound} x2={bound} y1={TOP - 8} y2={BASE + 4} />}
        <g className="of-dots" key={drawKey}>
          {flights.map((f) => (
            <circle key={f.i} className="of-dot" data-in={f.v <= x || undefined} cx={f.x} cy={f.y} r={3}
              style={{ ['--dx' as string]: `${f.dx}px`, ['--dy' as string]: `${f.dy}px`, animationDelay: `${f.i * 28}ms` }} />
          ))}
        </g>
      </svg>
    </section>
  );
}

/** Position of x among the sorted support values, in column units (index space, linear between values). */
function interp(support: number[], x: number) {
  if (x <= support[0]) return (x - support[0]) / Math.max(1, (support[1] ?? support[0] + 1) - support[0]);
  for (let i = 1; i < support.length; i++) if (x < support[i]) return i - 1 + (x - support[i - 1]) / (support[i] - support[i - 1]);
  return support.length - 1 + (x - support[support.length - 1]);
}
