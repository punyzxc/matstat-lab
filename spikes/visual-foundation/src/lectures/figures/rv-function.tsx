import { useMemo, useRef, useState } from 'react';
import { PALETTE } from './specs.mjs';
import { dec, int, t, texDec } from '../../i18n-core';
import { areaLeft, continuous, dice, diceF, diceJump, empirical, type CdfLaw, type Dice } from './rv-model.mjs';
import { clamp01, Label, lerp, rgba, useCanvasLoop, useThrottledReport, type FigureProps, type Frame } from './kit';

/**
 * A random variable is a function (L5). Every draw is the Distribution function station's own (same seed and streams).
 * Beat "mapping": the 36 outcomes ω = (ω₁, ω₂) of two dice, each carrying its value X(ω). Experiments pick outcomes;
 * each pick lights its cell and drops into the bar of its value, and the bars n_k/n settle on p_k.
 * Beat "staircase": the probabilities p_k as stems; the stems with x_k ≤ x are lit and add up to F(x), drawn below as
 * a right-continuous staircase with the empirical F_n over it.
 * Beat "area": a continuous law; the draws pile into a histogram under the density, the area left of x is shaded, and
 * below the same number is the height of F(x).
 */
const FLIGHT = 0.55; // seconds a pick takes to fall into its bar
type Sim = { key: string; clock: number; count: number; acc: number; times: number[] };
type Live = { beat: string; hot: string | null; reduced: boolean; x: number; n: number; d: Dice; c: { law: CdfLaw; xs: Float64Array } };

export function RvFunction({ beat, params, seed, hot, playing, reduced, runKey, onResults }: FigureProps) {
  const map = Math.round(params.map), a = Math.round(params.a), b = Math.round(params.b), source = Math.round(params.source);
  const n = Math.round(params.n), x = params.x;
  const d = useMemo(() => dice(map, a, b, seed, n), [map, a, b, seed, n]);
  const c = useMemo(() => continuous(source, seed, n), [source, seed, n]);
  const key = `${beat}|${seed}|${map}|${a}|${b}|${source}|${n}|${runKey}`;
  const sim = useRef<Sim | null>(null);
  if (!sim.current || sim.current.key !== key) sim.current = { key, clock: 0, count: 0, acc: 0, times: [] };
  const live = useRef<Live>({ beat, hot, reduced, x, n, d, c });
  live.current = { beat, hot, reduced, x, n, d, c };
  const [count, setCount] = useState(0);
  const cont = beat === 'area';

  useThrottledReport(() => {
    const k = sim.current!.count;
    setCount(k);
    const e = empirical(cont ? c.xs : d.xs, x, k);
    return {
      n: k, x, map, source,
      Fn: e.F, F: cont ? c.law.cdf(x) : diceF(d, x), area: cont ? areaLeft(c.law, x) : null,
      jumpn: e.jump, jump: cont ? 0 : diceJump(d, x), xbar: e.mean, MX: cont ? c.law.mean : d.mean, values: d.support.length,
    };
  }, onResults, 120, playing);

  const canvas = useCanvasLoop((f) => step(sim.current!, live.current, f), playing);
  const names = ['\\omega_1 + \\omega_2', '\\max(\\omega_1, \\omega_2)', '|\\omega_1 - \\omega_2|', '\\text{the number of sixes}', linear(a, b)];
  const namesRu = ['\\omega_1 + \\omega_2', '\\max(\\omega_1, \\omega_2)', '|\\omega_1 - \\omega_2|', '\\text{число шестёрок}', linear(a, b)];
  const lawName = [t('uniform on $[0, 1]$', 'равномерный на $[0, 1]$'), t('exponential, $\\lambda = 1$', 'показательный, $\\lambda = 1$'), t('normal $N(0, 1)$', 'нормальный $N(0, 1)$')][source - 1];
  return (
    <div className="figure figure--rv" data-beat={beat}>
      <canvas ref={canvas} className="figure-canvas" role="img" aria-label={t('A random variable as a function of the outcome.', 'Случайная величина как функция исхода.')} />
      {beat === 'mapping' && (
        <>
          <Label x={0.05} y={0.04}>{t(`$X(\\omega) = ${names[map]}$ on the 36 outcomes of two dice`, `$X(\\omega) = ${namesRu[map]}$ на 36 исходах двух костей`)}</Label>
          <Label x={0.05} y={0.9}>{t('$\\omega_1$ down, $\\omega_2$ across', '$\\omega_1$ — строки, $\\omega_2$ — столбцы')}</Label>
          <Label x={0.55} y={0.4}>{t(`${int(count)} experiments: $n_k/n$ against $p_k$`, `${int(count)} опытов: $n_k/n$ против $p_k$`)}</Label>
        </>
      )}
      {beat === 'staircase' && (
        <>
          <Label x={0.05} y={0.04}>{t(`$P(X = x_k)$; the lit stems are the terms of $F(${texDec(fmt(x))})$`, `$P(X = x_k)$; светлые столбики — слагаемые $F(${texDec(fmt(x))})$`)}</Label>
          <Label x={0.05} y={0.5}>{t(`$F(x)$ and the empirical $F_n(x)$ of ${int(count)} experiments`, `$F(x)$ и эмпирическая $F_n(x)$ по ${int(count)} опытам`)}</Label>
        </>
      )}
      {beat === 'area' && (
        <>
          <Label x={0.05} y={0.04}>{t(`${int(count)} draws, ${lawName}: area left of $x = ${texDec(fmt(x))}$`, `${int(count)} значений, ${lawName}: площадь левее $x = ${texDec(fmt(x))}$`)}</Label>
          <Label x={0.05} y={0.5}>{t('$F(x) = \\int_{-\\infty}^{x} f(t)\\,dt$ and the empirical $F_n(x)$', '$F(x) = \\int_{-\\infty}^{x} f(t)\\,dt$ и эмпирическая $F_n(x)$')}</Label>
        </>
      )}
    </div>
  );
}

const fmt = (v: number) => String(Number(v.toFixed(2)));
function linear(a: number, b: number) {
  const term = (c: number, v: string, first: boolean) => {
    if (c === 0) return '';
    const mag = Math.abs(c) === 1 ? '' : `${Math.abs(c)}\\,`;
    return first ? `${c < 0 ? '-' : ''}${mag}${v}` : ` ${c < 0 ? '-' : '+'} ${mag}${v}`;
  };
  return term(a, '\\omega_1', true) + term(b, '\\omega_2', a === 0) || '0';
}

function step(s: Sim, o: Live, f: Frame) {
  s.clock += f.dt;
  if (o.reduced) s.count = o.n;
  else if (s.count < o.n) {
    const rate = o.beat === 'mapping' ? Math.min(o.n / 1.5, 2.5 * 1.9 ** (s.clock * 1.6)) : Math.min(o.n / 1.2, 4 * 2.2 ** (s.clock * 2.2));
    s.acc += f.dt * rate;
    const add = Math.floor(s.acc);
    s.acc -= add;
    for (let k = 0; k < add && s.count < o.n; k++) { s.times[s.count] = s.clock; s.count++; }
  }
  if (o.beat === 'mapping') drawMapping(s, o, f);
  else if (o.beat === 'staircase') drawStaircase(s, o, f);
  else drawArea(s, o, f);
}

// ---------------------------------------------------------------- the dice grid and the bars
function drawMapping(s: Sim, o: Live, { ctx, w, h }: Frame) {
  const { d } = o;
  const cell = Math.min(w * 0.4 / 6, h * 0.68 / 6), gx = w * 0.05, gy = h * 0.12;
  const lo = d.support[0], hi = d.support.at(-1)!, span = Math.max(1, hi - lo);
  // bars of n_k/n with ticks at p_k
  const bx0 = w * 0.56, bx1 = w * 0.95, base = h * 0.88, top = h * 0.5;
  const pmax = Math.max(...d.pmf) * 1.25;
  const BX = (v: number) => lerp(bx0, bx1, d.support.length === 1 ? 0.5 : (v - lo) / span);
  const bw = Math.max(3, Math.min(22, ((bx1 - bx0) / (span + 1)) * 0.7));
  const counts = new Map<number, number>();
  let settled = 0;
  for (let i = 0; i < s.count; i++) {
    if (!o.reduced && s.clock - (s.times[i] ?? 0) < FLIGHT) continue;
    settled++;
    counts.set(d.xs[i], (counts.get(d.xs[i]) ?? 0) + 1);
  }
  d.support.forEach((v, k) => {
    const fr = settled ? (counts.get(v) ?? 0) / settled : 0, x = BX(v);
    ctx.fillStyle = rgba(PALETTE.violet, 0.6);
    ctx.fillRect(x - bw / 2, base, bw, -Math.min(1.15, fr / pmax) * (base - top)); // early frequencies can overshoot: cap just above the frame
    ctx.strokeStyle = PALETTE.signal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - bw / 2 - 3, base - (d.pmf[k] / pmax) * (base - top));
    ctx.lineTo(x + bw / 2 + 3, base - (d.pmf[k] / pmax) * (base - top));
    ctx.stroke();
    if (d.support.length <= 16 || k % 2 === 0) small(ctx, String(v).replace('-', '−'), x, base + 14, 'center');
  });
  axisLine(ctx, bx0 - 10, bx1 + 10, base + 0.5);
  // the grid: each outcome shows its value; recent picks glow
  const glow = new Float64Array(36);
  for (let i = Math.max(0, s.count - 40); i < s.count; i++) {
    const age = o.reduced ? 1 : s.clock - (s.times[i] ?? 0);
    glow[d.picks[i]] = Math.max(glow[d.picks[i]], clamp01(1 - age / 0.9));
  }
  for (let r = 0; r < 6; r++)
    for (let q = 0; q < 6; q++) {
      const k = 6 * r + q, v = d.values[k], cx = gx + q * cell, cy = gy + r * cell;
      const tone = (v - lo) / span;
      ctx.fillStyle = rgba(PALETTE.cyan, 0.06 + 0.16 * tone);
      ctx.fillRect(cx + 2, cy + 2, cell - 4, cell - 4);
      if (glow[k] > 0) {
        ctx.fillStyle = rgba(PALETTE.signal, 0.75 * glow[k]);
        ctx.fillRect(cx + 2, cy + 2, cell - 4, cell - 4);
      }
      small(ctx, String(v).replace('-', '−'), cx + cell / 2, cy + cell / 2 + 5, 'center', glow[k] > 0.3 ? '#111' : '#e8e8e4', 14);
    }
  for (let q = 0; q < 6; q++) small(ctx, String(q + 1), gx + q * cell + cell / 2, gy - 6, 'center');
  for (let r = 0; r < 6; r++) small(ctx, String(r + 1), gx - 8, gy + r * cell + cell / 2 + 4, 'right');
  // picks in flight: from their cell to their bar
  if (!o.reduced)
    for (let i = Math.max(0, s.count - 40); i < s.count; i++) {
      const age = s.clock - (s.times[i] ?? 0);
      if (age >= FLIGHT) continue;
      const k = d.picks[i], u = age / FLIGHT, e = u * u;
      const x0 = gx + (k % 6) * cell + cell / 2, y0 = gy + Math.floor(k / 6) * cell + cell / 2;
      const x1 = BX(d.xs[i]), y1 = base - 4;
      ctx.fillStyle = PALETTE.signal;
      ctx.beginPath();
      ctx.arc(lerp(x0, x1, u), lerp(y0, y1, e) - Math.sin(Math.PI * u) * 40, 4, 0, Math.PI * 2);
      ctx.fill();
    }
}

// ---------------------------------------------------------------- stems over the staircase
function drawStaircase(s: Sim, o: Live, { ctx, w, h }: Frame) {
  const { d, x, hot } = o;
  const lo = d.support[0] - 1, hi = d.support.at(-1)! + 1;
  const X = (v: number) => lerp(w * 0.08, w * 0.94, (v - lo) / (hi - lo));
  // stems
  const sb = h * 0.42, st = h * 0.16, pmax = Math.max(...d.pmf) * 1.15;
  d.support.forEach((v, k) => {
    const on = v <= x;
    ctx.strokeStyle = on ? PALETTE.signal : 'rgba(244,244,242,0.35)';
    ctx.lineWidth = on ? 3 : 2;
    const y = sb - (d.pmf[k] / pmax) * (sb - st);
    ctx.beginPath();
    ctx.moveTo(X(v), sb);
    ctx.lineTo(X(v), y);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(X(v), y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  axisLine(ctx, X(lo), X(hi), sb + 0.5);
  // F and F_n
  const fb = h * 0.9, ft = h * 0.58, Y = (p: number) => lerp(fb, ft, p);
  ctx.strokeStyle = 'rgba(244,244,242,0.12)';
  ctx.lineWidth = 1;
  for (const p of [0, 0.5, 1]) { ctx.beginPath(); ctx.moveTo(X(lo), Y(p)); ctx.lineTo(X(hi), Y(p)); ctx.stroke(); small(ctx, p === 0.5 ? dec('0.5') : String(p), X(lo) - 8, Y(p) + 4, 'right'); }
  // empirical staircase
  const sorted = Array.from(d.xs.subarray(0, s.count)).sort((p, q) => p - q);
  ctx.strokeStyle = rgba(PALETTE.violet, 0.85);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(X(lo), Y(0));
  let prev = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i < sorted.length - 1 && sorted[i + 1] === sorted[i]) continue;
    const p = (i + 1) / sorted.length;
    ctx.lineTo(X(sorted[i]), Y(prev));
    ctx.lineTo(X(sorted[i]), Y(p));
    prev = p;
  }
  ctx.lineTo(X(hi), Y(prev));
  ctx.stroke();
  // the law: right-continuous steps, filled dot at F(x_k), open dot just left of it
  let F = 0;
  ctx.lineWidth = 2;
  d.support.forEach((v, k) => {
    const next = k + 1 < d.support.length ? d.support[k + 1] : hi;
    ctx.strokeStyle = PALETTE.signal;
    ctx.beginPath();
    ctx.moveTo(X(k === 0 ? lo : v), Y(k === 0 ? 0 : F));
    if (k === 0) ctx.lineTo(X(v), Y(0));
    ctx.stroke();
    const below = F;
    F += d.pmf[k];
    ctx.beginPath();
    ctx.moveTo(X(v), Y(F));
    ctx.lineTo(X(next), Y(F));
    ctx.stroke();
    ctx.fillStyle = PALETTE.signal;
    ctx.beginPath();
    ctx.arc(X(v), Y(F), 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.signal;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(X(v), Y(below), 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
  });
  bound(ctx, X(x), st, fb, Y(diceF(d, x)), X(lo), hot === 'F' || hot === 'x');
  axisLine(ctx, X(lo), X(hi), fb + 0.5);
  d.support.forEach((v, k) => { if (d.support.length <= 16 || k % 2 === 0) small(ctx, String(v).replace('-', '−'), X(v), fb + 14, 'center'); });
}

// ---------------------------------------------------------------- the density, its area and F
function drawArea(s: Sim, o: Live, { ctx, w, h }: Frame) {
  const { law, xs } = o.c, x = o.x, hot = o.hot;
  const [lo, hi] = law.domain;
  const X = (v: number) => lerp(w * 0.08, w * 0.94, (v - lo) / (hi - lo));
  const hb = h * 0.44, ht = h * 0.14;
  let peak = 0;
  for (let i = 0; i <= 240; i++) peak = Math.max(peak, law.pdf(lo + ((hi - lo) * i) / 240));
  const Yd = (v: number) => hb - (v / (peak * 1.15)) * (hb - ht);
  // histogram
  const bins = 40, bw = (hi - lo) / bins, counts = new Int32Array(bins);
  for (let i = 0; i < s.count; i++) { const k = Math.floor((xs[i] - lo) / bw); if (k >= 0 && k < bins) counts[k]++; }
  for (let k = 0; k < bins; k++) {
    if (!counts[k]) continue;
    const dens = counts[k] / Math.max(1, s.count) / bw;
    ctx.fillStyle = lo + (k + 1) * bw <= x ? 'rgba(244,244,242,0.4)' : 'rgba(244,244,242,0.2)';
    ctx.fillRect(X(lo + k * bw) + 0.5, Yd(dens), X(lo + (k + 1) * bw) - X(lo + k * bw) - 1, hb - Yd(dens));
  }
  // shaded area left of x
  const right = Math.min(hi, Math.max(lo, x));
  ctx.fillStyle = rgba(PALETTE.signal, hot === 'area' || hot === 'F' ? 0.4 : 0.24);
  ctx.beginPath();
  ctx.moveTo(X(lo), hb);
  for (let i = 0; i <= 200; i++) { const v = lo + ((right - lo) * i) / 200; ctx.lineTo(X(v), Yd(law.pdf(v))); }
  ctx.lineTo(X(right), hb);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = PALETTE.cyan;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 300; i++) { const v = lo + ((hi - lo) * i) / 300; i ? ctx.lineTo(X(v), Yd(law.pdf(v))) : ctx.moveTo(X(v), Yd(law.pdf(v))); }
  ctx.stroke();
  axisLine(ctx, X(lo), X(hi), hb + 0.5);
  // F and F_n
  const fb = h * 0.9, ft = h * 0.58, Y = (p: number) => lerp(fb, ft, p);
  ctx.strokeStyle = 'rgba(244,244,242,0.12)';
  ctx.lineWidth = 1;
  for (const p of [0, 0.5, 1]) { ctx.beginPath(); ctx.moveTo(X(lo), Y(p)); ctx.lineTo(X(hi), Y(p)); ctx.stroke(); small(ctx, p === 0.5 ? dec('0.5') : String(p), X(lo) - 8, Y(p) + 4, 'right'); }
  const sorted = Array.from(xs.subarray(0, s.count)).sort((p, q) => p - q);
  ctx.strokeStyle = rgba(PALETTE.violet, 0.85);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(X(lo), Y(0));
  const stepN = Math.max(1, Math.floor(sorted.length / 400));
  for (let i = 0; i < sorted.length; i += stepN) { const v = Math.max(lo, Math.min(hi, sorted[i])); ctx.lineTo(X(v), Y(i / sorted.length)); ctx.lineTo(X(v), Y((i + stepN) / sorted.length > 1 ? 1 : (i + stepN) / sorted.length)); }
  ctx.lineTo(X(hi), Y(sorted.length ? 1 : 0));
  ctx.stroke();
  ctx.strokeStyle = PALETTE.signal;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 300; i++) { const v = lo + ((hi - lo) * i) / 300; i ? ctx.lineTo(X(v), Y(law.cdf(v))) : ctx.moveTo(X(v), Y(law.cdf(v))); }
  ctx.stroke();
  bound(ctx, X(right), ht, fb, Y(law.cdf(x)), X(lo), hot === 'F' || hot === 'x');
  axisLine(ctx, X(lo), X(hi), fb + 0.5);
  for (let v = Math.ceil(lo); v <= hi; v++) small(ctx, String(v).replace('-', '−'), X(v), fb + 14, 'center');
}

function bound(ctx: CanvasRenderingContext2D, x: number, top: number, base: number, yF: number, x0: number, lit: boolean) {
  ctx.strokeStyle = rgba(PALETTE.signal, lit ? 0.9 : 0.55);
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, top);
  ctx.lineTo(x + 0.5, base);
  ctx.moveTo(x0, yF);
  ctx.lineTo(x, yF);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = PALETTE.signal;
  ctx.shadowBlur = lit ? 16 : 8;
  ctx.beginPath();
  ctx.arc(x, yF, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}
function axisLine(ctx: CanvasRenderingContext2D, a: number, b: number, y: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(a, y);
  ctx.lineTo(b, y);
  ctx.stroke();
}
function small(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign, colour = 'rgba(200,200,196,0.75)', size = 10) {
  ctx.font = `${size}px "IBM Plex Mono", monospace`;
  ctx.textAlign = align;
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
}
