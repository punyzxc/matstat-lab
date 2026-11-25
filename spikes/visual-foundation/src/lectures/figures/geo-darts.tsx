import { useMemo, useRef, useState } from 'react';
import { PALETTE } from './specs.mjs';
import { dec, int, t, texDec } from '../../i18n-core';
import { additive, BOARD, chords, crossings, darts, inA, inB, longShare, needles, piPath, quarter } from './geo-model.mjs';
import { Label, lerp, rgba, useCanvasLoop, useThrottledReport, type FigureProps, type Frame } from './kit';

/**
 * Darts on a board (L4). Every draw is the Darts station's own (same seed, streams and indices).
 * Beat "additive": darts in the unit square Ω; A = {x < a} (coral) and B = {x > 1 − b} (violet). Two bars compare
 * P(A) + P(B) with P(A ∪ B): equal while the events are disjoint, too big by P(AB) once they overlap.
 * Beat "square": darts in the unit square; the share inside the quarter disc is its area π/4, so 4·share estimates π.
 * A trace below follows π̂ as n grows.
 * Beat "needle": Buffon's needles fall on lines d apart; the crossing ones turn coral and π̂ = 2ln/(dm) is traced.
 * Beat "chords": the three Bertrand schemes draw chords in three circles; long chords (longer than √3) are lit and
 * their shares settle at 1/2, 1/3 and 1/4.
 */
const SHOW_DARTS = 2500;
const SHOW_NEEDLES = 240;
const SHOW_CHORDS = 70;

type Sim = { key: string; clock: number; count: number; acc: number };
type Opts = { N: number; a: number; b: number; l: number; d: number };
type Data = { d0: ReturnType<typeof darts>; d1: ReturnType<typeof darts>; nd: ReturnType<typeof needles>; ch: ReturnType<typeof chords>; dartPi: [number, number][]; needlePi: [number, number][] };
type Live = { beat: string; hot: string | null; reduced: boolean; opts: Opts; data: Data };

export function GeoDarts({ beat, params, seed, hot, playing, reduced, runKey, onResults }: FigureProps) {
  const N = Math.round(params.N), a = params.a, b = params.b, l = params.l, d = params.d;
  const opts: Opts = { N, a, b, l, d };
  const d0 = useMemo(() => darts(seed, N, 0), [seed, N]);
  const d1 = useMemo(() => darts(seed, N, 1), [seed, N]);
  const nd = useMemo(() => needles(seed, N, l, d), [seed, N, l, d]);
  const ch = useMemo(() => chords(seed, N), [seed, N]);
  const dartPi = useMemo(() => piPath(d0, N), [d0, N]);
  const needlePi = useMemo(() => piPath(nd, N), [nd, N]);
  const data: Data = { d0, d1, nd, ch, dartPi, needlePi };
  const key = `${beat}|${seed}|${N}|${a}|${b}|${l}|${d}|${runKey}`;
  const sim = useRef<Sim | null>(null);
  if (!sim.current || sim.current.key !== key) sim.current = { key, clock: 0, count: 0, acc: 0 };
  const live = useRef<Live>({ beat, hot, reduced, opts, data });
  live.current = { beat, hot, reduced, opts, data };
  const [count, setCount] = useState(0);

  useThrottledReport(() => {
    const c = sim.current!.count;
    setCount(c);
    const ad = additive(d1, a, b, c), q = quarter(d0, c), cr = crossings(nd, c);
    const sh = (m: number) => (c ? m / c : null);
    return {
      n: c, N,
      a, b, pA: sh(ad.mA), pB: sh(ad.mB), pU: sh(ad.mU), pAB: sh(ad.mAB), sumAB: c ? (ad.mA + ad.mB) / c : null,
      exU: ad.exact.U, exAB: ad.exact.AB,
      share: q.share, pihat: beat === 'needle' ? cr.pi : q.pi, quarter: Math.PI / 4,
      l: nd.l, d, cross: cr.share, P: (2 * nd.l) / (Math.PI * d), m: cr.m,
      radius: longShare(ch[0], c), endpoints: longShare(ch[1], c), midpoint: longShare(ch[2], c),
    };
  }, onResults, 120);

  const canvas = useCanvasLoop((f) => step(sim.current!, live.current, f), playing);
  const ad = additive(d1, a, b, count);
  const disjoint = a + b <= 1;
  return (
    <div className="figure figure--geo" data-beat={beat}>
      <canvas ref={canvas} className="figure-canvas" role="img" aria-label={t('Darts thrown at random onto a board.', 'Дротики, брошенные наудачу на доску.')} />
      {beat === 'additive' && (
        <>
          <Label x={0.05} y={0.04}>{t(`${int(count)} darts in the square $\\Omega$`, `${int(count)} дротиков в квадрате $\\Omega$`)}</Label>
          <Label x={0.66} y={0.4} hot={hot === 'pAB'} className={disjoint ? '' : 'est-signal'} >
            {disjoint ? t('$A$ and $B$ are disjoint: the bars agree', '$A$ и $B$ несовместны: столбцы равны')
              : t(`overlap $AB$: ${dec(ad.count ? (ad.mAB / ad.count).toFixed(3) : '0')}`, `перекрытие $AB$: ${dec(ad.count ? (ad.mAB / ad.count).toFixed(3) : '0')}`)}
          </Label>
          <Label x={BARS.x0 + BARS.w / 2} y={0.94} align="middle">{'$P(A) + P(B)$'}</Label>
          <Label x={BARS.x0 + BARS.gap + BARS.w * 1.5} y={0.94} align="middle" hot={hot === 'pU'}>{'$P(A \\cup B)$'}</Label>
        </>
      )}
      {beat === 'square' && (
        <>
          <Label x={0.05} y={0.04}>{t(`${int(count)} darts in the unit square`, `${int(count)} дротиков в единичном квадрате`)}</Label>
          <Label x={0.66} y={0.4} className="est-signal">{t('quarter disc: area $\\pi/4$', 'четверть круга: площадь $\\pi/4$')}</Label>
          <Label x={0.66} y={0.52}>{t('$\\hat\\pi = 4m/n$ as $n$ grows', '$\\hat\\pi = 4m/n$ с ростом $n$')}</Label>
        </>
      )}
      {beat === 'needle' && (
        <>
          <Label x={0.05} y={0.04}>{t(`${int(count)} needles of length $l = ${texDec(String(Math.min(l, d)))}$, lines $d = ${texDec(String(d))}$ apart`, `${int(count)} игл длины $l = ${texDec(String(Math.min(l, d)))}$, прямые через $d = ${texDec(String(d))}$`)}</Label>
          <Label x={0.05} y={0.66}>{t('$\\hat\\pi = 2ln/(dm)$ as $n$ grows', '$\\hat\\pi = 2ln/(dm)$ с ростом $n$')}</Label>
        </>
      )}
      {beat === 'chords' && (
        <>
          <Label x={0.05} y={0.04}>{t(`${int(count)} chords per circle: which are longer than $\\sqrt3$?`, `${int(count)} хорд в каждом круге: какие длиннее $\\sqrt3$?`)}</Label>
          {[t('a point on a radius $\\to 1/2$', 'точка на радиусе $\\to 1/2$'), t('two random endpoints $\\to 1/3$', 'два случайных конца $\\to 1/3$'), t('a midpoint in the disc $\\to 1/4$', 'середина в круге $\\to 1/4$')].map((name, j) => (
            <Label key={j} x={CX[j]} y={0.79} align="middle" hot={hot === ['radius', 'endpoints', 'midpoint'][j]}>{name}</Label>
          ))}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- layout (fractions of the figure)
const SQ = { x0: 0.06, y0: 0.13, side: 0.5 }; // the square: side in units of the figure width, clipped by its height
const BARS = { x0: 0.68, w: 0.09, gap: 0.12, top: 0.5, base: 0.86 };
const CX = [0.2, 0.5, 0.8];

function arrive(s: Sim, o: Live, dt: number, total: number, rate = 2.2) {
  s.clock += dt;
  if (o.reduced) { s.count = total; return; }
  if (s.count >= total) return;
  s.acc += dt * Math.min(total / 1.2, 3 * rate ** (s.clock * 2.2));
  const add = Math.floor(s.acc);
  s.acc -= add;
  s.count = Math.min(total, s.count + add);
}

function step(s: Sim, o: Live, f: Frame) {
  arrive(s, o, f.dt, o.opts.N, o.beat === 'chords' ? 1.9 : 2.2);
  if (o.beat === 'additive') drawAdditive(s, o, f);
  else if (o.beat === 'square') drawSquare(s, o, f);
  else if (o.beat === 'needle') drawNeedles(s, o, f);
  else drawChords(s, o, f);
}

function square(w: number, h: number) {
  const side = Math.min(w * SQ.side, h * 0.72);
  return { x: w * SQ.x0, y: h * SQ.y0, side };
}

function drawAdditive(s: Sim, o: Live, { ctx, w, h }: Frame) {
  const { a, b } = o.opts, { xs, ys } = o.data.d1, hot = o.hot;
  const S = square(w, h), X = (v: number) => S.x + v * S.side, Y = (v: number) => S.y + (1 - v) * S.side;
  ctx.fillStyle = rgba(PALETTE.coral, hot === 'pA' ? 0.22 : 0.1);
  ctx.fillRect(X(0), Y(1), a * S.side, S.side);
  ctx.fillStyle = rgba(PALETTE.violet, hot === 'pB' ? 0.25 : 0.12);
  ctx.fillRect(X(1 - b), Y(1), b * S.side, S.side);
  if (a + b > 1) {
    ctx.fillStyle = rgba(PALETTE.signal, hot === 'pAB' ? 0.35 : 0.18);
    ctx.fillRect(X(1 - b), Y(1), (a + b - 1) * S.side, S.side);
  }
  frame(ctx, S.x, S.y, S.side, S.side);
  if (a > 0) small(ctx, 'A', X(a / 2), Y(0) + 20, 'center', PALETTE.coral, 15);
  if (b > 0) small(ctx, 'B', X(1 - b / 2), Y(0) + 20, 'center', PALETTE.violet, 15);
  const from = Math.max(0, s.count - SHOW_DARTS);
  for (let k = from; k < s.count; k++) {
    const p = inA(xs[k], a), q = inB(xs[k], b);
    ctx.fillStyle = p && q ? PALETTE.signal : p ? PALETTE.coral : q ? PALETTE.violet : 'rgba(244,244,242,0.35)';
    ctx.fillRect(X(xs[k]) - 1, Y(ys[k]) - 1, 2.2, 2.2);
  }
  // the bars: P(A) + P(B) stacked against P(A ∪ B)
  const ad = additive(o.data.d1, a, b, s.count), c = Math.max(1, s.count);
  const top = h * BARS.top, base = h * BARS.base, unit = (base - top) / 1.0, bw = w * BARS.w;
  const x1 = w * BARS.x0, x2 = w * (BARS.x0 + BARS.gap + BARS.w);
  const pa = ad.mA / c, pb = ad.mB / c, pu = ad.mU / c;
  ctx.fillStyle = rgba(PALETTE.coral, 0.8);
  ctx.fillRect(x1, base - pa * unit, bw, pa * unit);
  ctx.fillStyle = rgba(PALETTE.violet, 0.8);
  ctx.fillRect(x1, base - (pa + pb) * unit, bw, pb * unit);
  ctx.fillStyle = rgba(PALETTE.signal, hot === 'pU' ? 0.95 : 0.75);
  ctx.fillRect(x2, base - pu * unit, bw, pu * unit);
  if (pa + pb > pu + 1e-9) {
    ctx.strokeStyle = PALETTE.signal;
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x1 + 0.5, base - (pa + pb) * unit + 0.5, bw - 1, (pa + pb - pu) * unit);
    ctx.setLineDash([]);
  }
  // the exact union area: a tick on both bars
  const ex = Math.min(1, a + b);
  ctx.strokeStyle = 'rgba(244,244,242,0.8)';
  ctx.lineWidth = 1.5;
  for (const x of [x1, x2]) { ctx.beginPath(); ctx.moveTo(x - 5, base - ex * unit); ctx.lineTo(x + bw + 5, base - ex * unit); ctx.stroke(); }
  axisLine(ctx, x1 - 12, x2 + bw + 12, base + 0.5);
  small(ctx, '1', x1 - 16, top + 4, 'right');
  small(ctx, '0', x1 - 16, base + 4, 'right');
}

function drawSquare(s: Sim, o: Live, { ctx, w, h }: Frame) {
  const { xs, ys } = o.data.d0;
  const S = square(w, h), X = (v: number) => S.x + v * S.side, Y = (v: number) => S.y + (1 - v) * S.side;
  ctx.fillStyle = rgba(PALETTE.signal, 0.06);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0));
  ctx.arc(X(0), Y(0), S.side, -Math.PI / 2, 0);
  ctx.closePath();
  ctx.fill();
  frame(ctx, S.x, S.y, S.side, S.side);
  ctx.strokeStyle = PALETTE.signal;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(X(0), Y(0), S.side, -Math.PI / 2, 0);
  ctx.stroke();
  const from = Math.max(0, s.count - SHOW_DARTS);
  for (let k = from; k < s.count; k++) {
    const inside = xs[k] * xs[k] + ys[k] * ys[k] <= 1;
    ctx.fillStyle = inside ? rgba(PALETTE.signal, 0.85) : 'rgba(244,244,242,0.35)';
    ctx.fillRect(X(xs[k]) - 1, Y(ys[k]) - 1, 2.2, 2.2);
  }
  const q = quarter(o.data.d0, s.count);
  trace(ctx, s, o.data.dartPi, q.pi, { x0: w * 0.66, x1: w * 0.95, top: h * 0.58, base: h * 0.9 }, o.opts.N, 0.6);
}

function drawNeedles(s: Sim, o: Live, { ctx, w, h }: Frame) {
  const nd = o.data.nd, d = nd.d, half = nd.l / 2;
  const bw = w * 0.56, bh = h * 0.46, x0 = w * 0.05, y0 = h * 0.13;
  const sx = bw / (BOARD.width * d), sy = bh / (BOARD.strips * d), sc = Math.min(sx, sy);
  const X = (v: number) => x0 + v * sc, Y = (v: number) => y0 + BOARD.strips * d * sc - v * sc;
  ctx.strokeStyle = 'rgba(244,244,242,0.45)';
  ctx.lineWidth = 1;
  for (let j = 0; j <= BOARD.strips; j++) { ctx.beginPath(); ctx.moveTo(X(0), Y(j * d) + 0.5); ctx.lineTo(X(BOARD.width * d), Y(j * d) + 0.5); ctx.stroke(); }
  const from = Math.max(0, s.count - SHOW_NEEDLES);
  for (let k = from; k < s.count; k++) {
    const age = (s.count - 1 - k) / SHOW_NEEDLES, c = Math.cos(nd.theta[k]) * half, sn = Math.sin(nd.theta[k]) * half;
    ctx.strokeStyle = nd.hit[k] ? rgba(PALETTE.coral, 1 - age * 0.7) : `rgba(244,244,242,${0.75 - age * 0.55})`;
    ctx.lineWidth = nd.hit[k] ? 1.8 : 1.2;
    ctx.beginPath();
    ctx.moveTo(X(nd.x[k] - c), Y(nd.y[k] - sn));
    ctx.lineTo(X(nd.x[k] + c), Y(nd.y[k] + sn));
    ctx.stroke();
  }
  const cr = crossings(nd, s.count);
  trace(ctx, s, o.data.needlePi, cr.pi, { x0: w * 0.05, x1: w * 0.95, top: h * 0.71, base: h * 0.93 }, o.opts.N, 1);
}

function drawChords(s: Sim, o: Live, { ctx, w, h }: Frame) {
  const r = Math.min(w * 0.13, h * 0.24), cy = h * 0.47, hot = o.hot;
  const ids = ['radius', 'endpoints', 'midpoint'];
  o.data.ch.forEach((c, j) => {
    const cx = w * CX[j];
    ctx.strokeStyle = 'rgba(244,244,242,0.6)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // the inscribed triangle's side: the yardstick √3
    ctx.strokeStyle = rgba(PALETTE.cyan, 0.35);
    ctx.beginPath();
    for (let v = 0; v <= 3; v++) { const t = -Math.PI / 2 + (v * 2 * Math.PI) / 3; v ? ctx.lineTo(cx + r * Math.cos(t), cy + r * Math.sin(t)) : ctx.moveTo(cx + r * Math.cos(t), cy + r * Math.sin(t)); }
    ctx.stroke();
    const from = Math.max(0, s.count - SHOW_CHORDS);
    for (let k = from; k < s.count; k++) {
      const age = (s.count - 1 - k) / SHOW_CHORDS, e = c.ends;
      ctx.strokeStyle = c.long[k] ? rgba(PALETTE.signal, (hot === ids[j] ? 1 : 0.85) - age * 0.6) : `rgba(244,244,242,${0.4 - age * 0.3})`;
      ctx.lineWidth = c.long[k] ? 1.4 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + r * e[4 * k], cy - r * e[4 * k + 1]);
      ctx.lineTo(cx + r * e[4 * k + 2], cy - r * e[4 * k + 3]);
      ctx.stroke();
    }
    const share = longShare(c, s.count);
    small(ctx, share == null ? '—' : dec(share.toFixed(3)), cx, cy + r + 34, 'center', PALETTE.signal, 15);
  });
}

// ---------------------------------------------------------------- the running π̂ trace on a log axis
function trace(ctx: CanvasRenderingContext2D, s: Sim, path: [number, number][], pi: number | null, box: { x0: number; x1: number; top: number; base: number }, N: number, span: number) {
  const lN = Math.log10(Math.max(10, N));
  const X = (n: number) => lerp(box.x0, box.x1, Math.log10(n) / lN);
  const Y = (v: number) => lerp(box.base, box.top, (Math.max(Math.PI - span, Math.min(Math.PI + span, v)) - (Math.PI - span)) / (2 * span));
  ctx.strokeStyle = rgba(PALETTE.signal, 0.6);
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(box.x0, Y(Math.PI));
  ctx.lineTo(box.x1, Y(Math.PI));
  ctx.stroke();
  ctx.setLineDash([]);
  small(ctx, 'π', box.x1 + 6, Y(Math.PI) + 4, 'left', PALETTE.signal, 12);
  ctx.strokeStyle = PALETTE.violet;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  let first = true;
  for (const [n, v] of path) {
    if (n > s.count) break;
    if (first) ctx.moveTo(X(n), Y(v)); else ctx.lineTo(X(n), Y(v));
    first = false;
  }
  if (pi != null && s.count) ctx.lineTo(X(s.count), Y(pi));
  ctx.stroke();
  if (pi != null && s.count) {
    ctx.fillStyle = PALETTE.violet;
    ctx.beginPath();
    ctx.arc(X(s.count), Y(pi), 3.5, 0, Math.PI * 2);
    ctx.fill();
    small(ctx, dec(pi.toFixed(4)), X(s.count) - 6, Y(pi) - 10, 'right', PALETTE.violet, 12);
  }
  axisLine(ctx, box.x0, box.x1, box.base + 0.5);
  for (const n of [1, 10, 100, 1000, 10000]) if (n <= N) small(ctx, int(n), X(n), box.base + 14, 'center');
}

function frame(ctx: CanvasRenderingContext2D, x: number, y: number, wd: number, ht: number) {
  ctx.strokeStyle = 'rgba(244,244,242,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, wd, ht);
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
