import { MathText } from '../math';
import { locale, t } from '../i18n';
import type { Meet, MeetValue } from './kernel-contract';

/**
 * #128: where the three numbers meet. The exact value, an approximation of it and the simulated estimate, side by
 * side with their gaps to the exact one, and on one number line. Hovering or focusing a value lights its curve or
 * marker on the chart (`onFocus` receives the series id). Values a kernel does not report are simply not shown.
 */
const KINDS = [
  ['exact', ['Exact', 'Точно']],
  ['approx', ['Approximation', 'Приближение']],
  ['sim', ['Simulation', 'Моделирование']],
] as const;

const num = (v: number) => {
  const a = Math.abs(v);
  const digits = a !== 0 && a < 1e-3 ? 2 : 6;
  return Number(v.toPrecision(digits)).toLocaleString(locale(), { maximumSignificantDigits: digits, useGrouping: false }).replace('-', '−');
};

export function MeetStrip({ meet, onFocus }: { meet: Meet; onFocus: (series: string | null) => void }) {
  const cells = KINDS.flatMap(([key, [en, ru]]) => {
    const v = meet[key] as MeetValue | undefined;
    return v && Number.isFinite(v.value) ? [{ key, title: t(en, ru), ...v }] : [];
  });
  if (cells.length < 2) return null;
  const exact = meet.exact && Number.isFinite(meet.exact.value) ? meet.exact.value : null;
  const values = cells.map((c) => c.value);
  let lo = Math.min(...values), hi = Math.max(...values);
  const pad = (hi - lo) * 0.35 || Math.max(Math.abs(hi) * 0.02, 1e-3);
  lo -= pad;
  hi += pad;
  const W = 600, X = (v: number) => 18 + ((v - lo) / (hi - lo)) * (W - 36);
  return (
    <section className="meet" aria-label={t('Exact, approximate and simulated values', 'Точное, приближённое и смоделированное значения')}>
      <p className="meet-head"><MathText text={meet.label} /></p>
      <div className="meet-cells">
        {cells.map((c) => {
          const gap = exact != null && c.key !== 'exact' ? Math.abs(c.value - exact) : null;
          return (
            <div key={c.key} className="meet-cell" data-kind={c.key} tabIndex={0} role="group"
              aria-label={`${c.title}: ${num(c.value)}${gap != null ? t(`, ${num(gap)} from the exact value`, `, ${num(gap)} от точного значения`) : ''}`}
              onMouseEnter={() => onFocus(c.series ?? null)} onMouseLeave={() => onFocus(null)}
              onFocus={() => onFocus(c.series ?? null)} onBlur={() => onFocus(null)}>
              <span className="meet-kind"><i aria-hidden />{c.title}</span>
              <strong className="meet-value" data-value={c.value}>{num(c.value)}</strong>
              <span className="meet-note"><MathText text={c.label} /></span>
              {gap != null && <span className="meet-gap" data-gap={gap}>{t('gap', 'разрыв')} {num(gap)}</span>}
            </div>
          );
        })}
      </div>
      <svg className="meet-line" viewBox={`0 0 ${W} 34`} aria-hidden>
        <line className="meet-axis" x1={18} x2={W - 18} y1={20} y2={20} />
        {exact != null && cells.filter((c) => c.key !== 'exact').map((c) => (
          <line key={'g' + c.key} className="meet-span" data-kind={c.key} x1={X(exact)} x2={X(c.value)} y1={c.key === 'sim' ? 26 : 14} y2={c.key === 'sim' ? 26 : 14} />
        ))}
        {cells.map((c) => (
          <g key={c.key} className="meet-mark" data-kind={c.key} style={{ transform: `translateX(${X(c.value)}px)` }}>
            {c.key === 'exact' ? <path d="M0 13 L7 20 L0 27 L-7 20 Z" /> : c.key === 'approx' ? <circle cy={20} r={5.5} /> : <circle cy={20} r={4.5} />}
          </g>
        ))}
      </svg>
    </section>
  );
}
