import { useId, useMemo } from 'react';
import { MathText, SvgMathText, mathToPlain } from '../math';
import type { Series } from './kernel-contract';
import { lerp, lerpArray } from './surface-math.mjs';
import { useTween } from './use-tween';
import { locale, t } from '../i18n-core';

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
  return v.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: locale() === 'en-US' }).replace('-', '−');
};

/**
 * One honest chart for contract series: nice ticks, labelled axes, light grid, no smoothing.
 * Kinds: hist (bars on bin starts), pmf (stems), pdf/cdf/line (polylines), ecdf (steps),
 * points, band (area between y and y2), rule (vertical marker at x[0]). `tone` picks the colour.
 */
type Frame = { series: Series[]; ext: [number, number, number, number] | null };

/** Axis extents [x0, x1, y0, y1] for a series list, honouring fixed domains; null when there is nothing to plot. */
function extents(series: Series[], dx?: [number, number], dy?: [number, number]): Frame['ext'] {
  const finite = (v: number) => Number.isFinite(v);
  const xs = series.flatMap((s) => s.x).filter(finite);
  const ys = series.filter((s) => s.kind !== 'rule').flatMap((s) => [...s.y, ...(s.y2 ?? [])]).filter(finite);
  if (!xs.length) return null;
  const min = (a: number[], d: number) => a.reduce((m, v) => (v < m ? v : m), a.length ? a[0] : d);
  const max = (a: number[], d: number) => a.reduce((m, v) => (v > m ? v : m), a.length ? a[0] : d);
  let [x0, x1] = dx ?? [min(xs, 0), max(xs, 1)];
  let [y0, y1] = dy ?? [Math.min(0, min(ys, 0)), max(ys, 1)];
  if (x0 === x1) [x0, x1] = [x0 - 1, x1 + 1];
  if (y0 === y1) y1 = y0 + 1;
  if (!dy) y1 += (y1 - y0) * 0.06;
  return [x0, x1, y0, y1];
}

const sameShape = (a: Series, b: Series) =>
  a.id === b.id && a.kind === b.kind && (a.x?.length ?? 0) === (b.x?.length ?? 0) && (a.y?.length ?? 0) === (b.y?.length ?? 0) && (a.y2?.length ?? -1) === (b.y2?.length ?? -1);

/** Series whose id and array lengths match the previous frame glide; the rest snap. Null when nothing can glide. */
function mixFrame(from: Frame, to: Frame, t: number): Frame | null {
  if (!from.ext || !to.ext) return null;
  let any = false;
  const series = to.series.map((s, i) => {
    const prev = from.series[i];
    if (!prev || !sameShape(prev, s)) return s;
    any = true;
    return { ...s, x: lerpArray(prev.x, s.x, t), y: lerpArray(prev.y, s.y, t), ...(s.y2 && prev.y2 ? { y2: lerpArray(prev.y2, s.y2, t) } : {}) };
  });
  if (!any) return null;
  const f = from.ext, g = to.ext;
  return { series, ext: [lerp(f[0], g[0], t), lerp(f[1], g[1], t), lerp(f[2], g[2], t), lerp(f[3], g[3], t)] };
}

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
  const dx0 = domain?.x?.[0], dx1 = domain?.x?.[1], dy0 = domain?.y?.[0], dy1 = domain?.y?.[1];
  const target = useMemo<Frame>(
    () => ({ series, ext: extents(series, dx0 == null || dx1 == null ? undefined : [dx0, dx1], dy0 == null || dy1 == null ? undefined : [dy0, dy1]) }),
    [series, dx0, dx1, dy0, dy1],
  );
  const shown = useTween(target, mixFrame);
  const W = 680, H = height, L = 52, R = 14, T = yLabel ? 24 : 12, B = xLabel ? 42 : 28;
  const finite = (v: number) => Number.isFinite(v);
  if (!shown.ext) return <p className="chart-empty">{t('No data to plot yet.', 'Данных для графика пока нет.')}</p>;
  const [x0, x1, y0, y1] = shown.ext;
  series = shown.series;
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
  const label = series.map((s) => mathToPlain(s.label ?? s.id)).join(', ');
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}${xLabel ? t(` against ${mathToPlain(xLabel)}`, ` по оси ${mathToPlain(xLabel)}`) : ''}`}>
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
            if (s.kind === 'points') return <g key={s.id + si} className={`${cls}${s.marker ? ` chart-marker--${s.marker}` : ''}`}>{pts(s).map(([x, y], i) => <circle key={i} cx={sx(x)} cy={sy(y)} r={s.marker ? 3.6 : 1.8} />)}</g>;
            if (s.kind === 'rule') return <g key={s.id + si} className={cls}>{s.x.filter(finite).map((x, i) => <line key={i} x1={sx(x)} x2={sx(x)} y1={T} y2={H - B} />)}</g>;
            return <path key={s.id + si} className={cls} d={s.kind === 'ecdf' ? steps(s) : poly(s)} />;
          })}
        </g>
        <g className="chart-axis" aria-hidden="true">
          <path d={`M${L},${T}V${H - B}H${W - R}`} />
          {yt.map((v) => <text key={'ty' + v} x={L - 7} y={sy(v) + 3.5} textAnchor="end">{tickText(v, ys_)}</text>)}
          {xt.map((v) => <text key={'tx' + v} x={sx(v)} y={H - B + 15} textAnchor="middle">{tickText(v, xs_)}</text>)}
          {xLabel && <SvgMathText className="chart-title" x={(L + W - R) / 2} y={H - 6} anchor="middle" text={xLabel} />}
          {yLabel && <SvgMathText className="chart-title" x={L - 44} y={12} anchor="start" text={yLabel} />}
        </g>
      </svg>
      <figcaption>
        {series.filter((s, i) => s.label && series.findIndex((t) => t.label === s.label && t.kind === s.kind && t.tone === s.tone) === i).map((s, si) => (
          <span key={s.id + si} className={`chart-key chart-key--${s.kind} tone-${s.tone ?? 'default'}`}><i /><MathText text={s.label} /></span>
        ))}
      </figcaption>
    </figure>
  );
}
