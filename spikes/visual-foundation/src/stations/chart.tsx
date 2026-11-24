import { useId } from 'react';
import type { Series } from './kernel-contract';

/** "Nice" tick values (1, 2, 2.5, 5 × 10ᵏ) covering [lo, hi]. */
export function ticks(lo: number, hi: number, target = 5) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  const first = Math.ceil(lo / step - 1e-9), last = Math.floor(hi / step + 1e-9);
  for (let i = first; i <= last; i++) out.push(Number((i * step).toPrecision(12)) || 0);
  return out;
}
const tickText = (v: number, step: number) => {
  const digits = Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)));
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace('-', '−');
};

/**
 * One honest chart for contract series: nice ticks, labelled axes, light grid, no smoothing.
 * Kinds: hist (bars on bin starts), pmf (stems), pdf/cdf/line (polylines), ecdf (steps),
 * points, band (area between y and y2), rule (vertical marker at x[0]). `tone` picks the colour.
 */
export function Chart({
  series,
  xLabel,
  yLabel,
  height = 260,
  domain,
}: {
  series: Series[];
  xLabel?: string;
  yLabel?: string;
  height?: number;
  domain?: { x?: [number, number]; y?: [number, number] };
}) {
  const clip = useId();
  const W = 680, H = height, L = 52, R = 14, T = yLabel ? 24 : 12, B = xLabel ? 42 : 28;
  const finite = (v: number) => Number.isFinite(v);
  const xs = series.flatMap((s) => s.x).filter(finite);
  const ys = series.filter((s) => s.kind !== 'rule').flatMap((s) => [...s.y, ...(s.y2 ?? [])]).filter(finite);
  if (!xs.length) return <p className="chart-empty">No data to plot yet.</p>;
  const min = (a: number[], d: number) => a.reduce((m, v) => (v < m ? v : m), a.length ? a[0] : d);
  const max = (a: number[], d: number) => a.reduce((m, v) => (v > m ? v : m), a.length ? a[0] : d);
  let [x0, x1] = domain?.x ?? [min(xs, 0), max(xs, 1)];
  let [y0, y1] = domain?.y ?? [Math.min(0, min(ys, 0)), max(ys, 1)];
  if (x0 === x1) [x0, x1] = [x0 - 1, x1 + 1];
  if (y0 === y1) y1 = y0 + 1;
  const pad = (y1 - y0) * 0.06;
  if (!domain?.y) y1 += pad;
  const xt = ticks(x0, x1, 6), yt = ticks(y0, y1, 4);
  const xs_ = xt.length > 1 ? xt[1] - xt[0] : 1, ys_ = yt.length > 1 ? yt[1] - yt[0] : 1;
  const sx = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const sy = (y: number) => H - B - ((y - y0) / (y1 - y0)) * (H - T - B);
  const pts = (s: Series, ys2: number[] = s.y) =>
    s.x.map((x, i) => [x, ys2[i]] as const).filter(([x, y]) => finite(x) && finite(y));
  const poly = (s: Series) => pts(s).map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('');
  const steps = (s: Series) => {
    const p = pts(s);
    if (!p.length) return '';
    let d = `M${sx(x0).toFixed(1)},${sy(0).toFixed(1)}`;
    for (const [x, y] of p) d += `H${sx(x).toFixed(1)}V${sy(y).toFixed(1)}`;
    return d + `H${sx(x1).toFixed(1)}`;
  };
  const base = sy(Math.max(y0, Math.min(0, y1)));
  const label = series.map((s) => s.label ?? s.id).join(', ');
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}${xLabel ? ` against ${xLabel}` : ''}`}>
        <defs>
          <clipPath id={clip}>
            <rect x={L} y={T} width={W - L - R} height={H - T - B} />
          </clipPath>
        </defs>
        <g className="chart-grid" aria-hidden="true">
          {yt.map((v) => <line key={'y' + v} x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} />)}
          {xt.map((v) => <line key={'x' + v} x1={sx(v)} x2={sx(v)} y1={T} y2={H - B} />)}
        </g>
        <g clipPath={`url(#${clip})`}>
          {series.map((s, si) => {
            const cls = `chart-series chart-series--${s.kind} tone-${s.tone ?? 'default'}`;
            if (s.kind === 'band' && s.y2) {
              const up = pts(s, s.y2), lo = pts(s);
              if (!up.length) return null;
              const d = up.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x)},${sy(y)}`).join('') +
                [...lo].reverse().map(([x, y]) => `L${sx(x)},${sy(y)}`).join('') + 'Z';
              return <path key={s.id + si} className={cls} d={d} />;
            }
            if (s.kind === 'hist') {
              const p = pts(s);
              const w = p.length > 1 ? sx(p[1][0]) - sx(p[0][0]) : 6;
              return <g key={s.id + si} className={cls}>{p.map(([x, y], i) => (
                <rect key={i} x={sx(x) + 0.5} y={Math.min(base, sy(y))} width={Math.max(0.5, w - 1)} height={Math.abs(base - sy(y))} />
              ))}</g>;
            }
            if (s.kind === 'pmf') {
              const p = pts(s).filter(([x]) => x >= x0 && x <= x1);
              const r = p.length > 80 ? 0 : 2.2;
              return <g key={s.id + si} className={cls}>{p.map(([x, y], i) => (
                <g key={i}><line x1={sx(x)} x2={sx(x)} y1={base} y2={sy(y)} />{r > 0 && <circle cx={sx(x)} cy={sy(y)} r={r} />}</g>
              ))}</g>;
            }
            if (s.kind === 'points') return <g key={s.id + si} className={cls}>{pts(s).map(([x, y], i) => <circle key={i} cx={sx(x)} cy={sy(y)} r={1.8} />)}</g>;
            if (s.kind === 'rule') return <g key={s.id + si} className={cls}>{s.x.filter(finite).map((x, i) => <line key={i} x1={sx(x)} x2={sx(x)} y1={T} y2={H - B} />)}</g>;
            return <path key={s.id + si} className={cls} d={s.kind === 'ecdf' ? steps(s) : poly(s)} />;
          })}
        </g>
        <g className="chart-axis" aria-hidden="true">
          <path d={`M${L},${T}V${H - B}H${W - R}`} />
          {yt.map((v) => <text key={'ty' + v} x={L - 7} y={sy(v) + 3.5} textAnchor="end">{tickText(v, ys_)}</text>)}
          {xt.map((v) => <text key={'tx' + v} x={sx(v)} y={H - B + 15} textAnchor="middle">{tickText(v, xs_)}</text>)}
          {xLabel && <text className="chart-title" x={(L + W - R) / 2} y={H - 6} textAnchor="middle">{xLabel}</text>}
          {yLabel && <text className="chart-title" x={L - 44} y={12} textAnchor="start">{yLabel}</text>}
        </g>
      </svg>
      <figcaption>
        {series.filter((s) => s.label).map((s, si) => (
          <span key={s.id + si} className={`chart-key chart-key--${s.kind} tone-${s.tone ?? 'default'}`}><i />{s.label}</span>
        ))}
      </figcaption>
    </figure>
  );
}
