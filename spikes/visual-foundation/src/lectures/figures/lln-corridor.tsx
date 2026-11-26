import { useMemo, useRef } from 'react';
import { PALETTE } from './specs.mjs';
import { MathText } from '../../math';
import { dec, int, t, texDec } from '../../i18n-core';
import { centreOf, corridor, exactTail, kBound, LAWS, TAIL_R, tailDraws, tailShare, type Corridor } from './lln-model.mjs';
import { clamp01, ease, Label, lerp, rgba, useCanvasLoop, useSteadyState, useThrottledReport, type FigureProps, type Frame } from './kit';

/**
 * The corridor of running means (L7). Draws and paths are the LLN station's own (same seed and streams).
 * Beat "tail": draws pile up into the law's histogram; the tails |X − a| ≥ kσ are lit coral, and two bars compare
 * the real share in the tails with Chebyshev's bound 1/k².
 * Beat "paths": M running means X̄_n grow from n = 1 to N on a log axis inside the corridor a ± ε; a strip below
 * counts the share of paths outside the corridor against the Chebyshev bound σ²/(nε²).
 * Beat "share": the strip alone, large: the bound and the real share as n grows.
 * Cauchy (law 4) has no mean and no variance: its paths never settle and there is no bound.
 */
const GROW = 5.5; // seconds for the paths to reach N
const TAIL_TIME = 4.5;
const BINS = 90;

type Opts = { law: number; N: number; M: number; eps: number; k: number; seed: number };
type Sim = { key: string; clock: number; front: number; drawn: number; acc: number; bins: Int32Array; tailHits: number };
type Live = { beat: string; hot: string | null; reduced: boolean; opts: Opts; c: Corridor; draws: Float64Array };

export function LlnCorridor({ beat, params, seed, hot, onHot, playing, reduced, runKey, onResults }: FigureProps) {
  const law = Math.round(params.law), N = Math.round(params.N), M = Math.round(params.M), eps = params.eps, k = params.k;
  const opts: Opts = { law, N, M, eps, k, seed };
  const c = useMemo(() => corridor({ law, N, M, eps, seed }), [law, N, M, eps, seed]);
  const draws = useMemo(() => tailDraws({ law, seed }), [law, seed]);
  const key = beat === 'tail' ? `t|${law}|${k}|${seed}|${runKey}` : `p|${law}|${N}|${M}|${seed}|${runKey}`;
  const sim = useRef<Sim | null>(null);
  if (!sim.current || sim.current.key !== key) sim.current = { key, clock: 0, front: 0, drawn: 0, acc: 0, bins: new Int32Array(BINS), tailHits: 0 };
  const live = useRef<Live>({ beat, hot, reduced, opts, c, draws });
  live.current = { beat, hot, reduced, opts, c, draws };
  const { a, sd, cauchy } = centreOf(law);
  const [shown, setShown] = useSteadyState({ j: 0, drawn: 0 });

  const at = (j: number) => {
    const i = Math.min(c.ns.length - 1, Math.max(0, j));
    return { n: c.ns[i], m: c.outside[i], share: c.outside[i] / M, bound: c.bound[i], xbar: c.paths[0][i] };
  };
  useThrottledReport(() => {
    const s = sim.current!, j = Math.floor(s.front);
    setShown({ j, drawn: s.drawn });
    const p = at(j);
    let lo = Infinity, hi = -Infinity;
    for (const y of c.paths) { lo = Math.min(lo, y[Math.min(j, c.ns.length - 1)]); hi = Math.max(hi, y[Math.min(j, c.ns.length - 1)]); }
    return {
      n: p.n, N, M, eps, k, a: cauchy ? null : a, sigma: cauchy ? null : sd, m: p.m, share: p.share, bound: p.bound, xbar: p.xbar, spread: hi - lo,
      tailsim: s.drawn ? tailShare(draws, law, k, s.drawn) : null, tail: exactTail(law, k), kbound: kBound(law, k), drawn: s.drawn,
      boundN: c.bound.at(-1) ?? null, shareN: c.outside.at(-1)! / M,
    };
  }, onResults, 120, playing);

  const canvas = useCanvasLoop((f) => step(sim.current!, live.current, f), playing);
  const p = at(shown.j);
  const lawName = t(['normal', 'uniform', 'exponential', 'Poisson', 'Cauchy'][law] + ' law', ['нормальный закон', 'равномерный закон', 'показательный закон', 'закон Пуассона', 'закон Коши'][law]);
  const tailSim = shown.drawn ? tailShare(draws, law, k, shown.drawn) : null, kb = kBound(law, k);
  return (
    <div className="figure figure--lln" data-beat={beat}>
      <canvas ref={canvas} className="figure-canvas" role="img"
        aria-label={t(`Law of large numbers, ${lawName}: ${M} running means up to n = ${N}, corridor ±${eps}.`,
          `Закон больших чисел, ${lawName}: ${M} путей бегущего среднего до n = ${N}, коридор ±${dec(String(eps))}.`)} />
      {beat === 'tail' && (
        <>
          <Label x={0.05} y={0.04}>{t(`${int(TAIL_R)} draws of one variable, ${lawName}`, `${int(TAIL_R)} значений одной величины, ${lawName}`)}</Label>
          <Label x={0.05} y={0.75} hot={hot === 'k'} className="est-coral">
            {cauchy ? t(`tails $|X| \\ge ${texDec(k.toFixed(1))}$`, `хвосты $|X| \\ge ${texDec(k.toFixed(1))}$`) : t(`tails $|X - a| \\ge ${texDec(k.toFixed(1))}\\sigma$`, `хвосты $|X - a| \\ge ${texDec(k.toFixed(1))}\\sigma$`)}
          </Label>
          <div className="lln-bars" data-testid="lln-tail">
            <div className={`lln-bar is-real${hot === 'tailsim' || hot === 'tail' ? ' is-hot' : ''}`}>
              <span className="lln-bar-label"><MathText text={t('in the tails, really', 'в хвостах на деле')} /></span>
              <i style={{ width: `${(tailSim ?? 0) * 100}%` }} />
              <b>{tailSim == null ? '—' : dec(tailSim.toFixed(4))}</b>
            </div>
            <div className={`lln-bar is-bound${hot === 'kbound' ? ' is-hot' : ''}`}>
              <span className="lln-bar-label"><MathText text={t('Chebyshev bound $1/k^2$', 'граница Чебышёва $1/k^2$')} /></span>
              <i style={{ width: `${(kb ?? 0) * 100}%` }} />
              <b>{kb == null ? t('none: no variance', 'нет: нет дисперсии') : dec(kb.toFixed(4))}</b>
            </div>
          </div>
        </>
      )}
      {beat === 'paths' && (
        <>
          <Label x={0.06} y={0.03}>{t(`running means $\\bar X_n$ of $M = ${M}$ paths, ${lawName}`, `бегущие средние $\\bar X_n$ для $M = ${M}$ путей, ${lawName}`)}</Label>
          <Label x={0.955} y={0.03} align="end" hot={hot === 'eps'} className="est-signal">
            {cauchy ? t(`corridor $0 \\pm ${texDec(String(eps))}$`, `коридор $0 \\pm ${texDec(String(eps))}$`) : t(`corridor $a \\pm \\varepsilon = ${texDec(String(a))} \\pm ${texDec(String(eps))}$`, `коридор $a \\pm \\varepsilon = ${texDec(String(a))} \\pm ${texDec(String(eps))}$`)}
          </Label>
        </>
      )}
      {beat === 'share' && (
        <Label x={0.08} y={0.04}>{t(`share of ${M} paths outside $a \\pm \\varepsilon$ against Chebyshev's bound`, `доля ${M} путей вне $a \\pm \\varepsilon$ против границы Чебышёва`)}</Label>
      )}
      {beat !== 'tail' && (
        <div className={`lln-count${hot === 'm' || hot === 'share' ? ' is-hot' : ''}`} data-testid="lln-count" style={{ top: beat === 'share' ? '93%' : '65.5%' }}>
          <span>
            <MathText text={t(`share of paths outside the corridor: at $n = ${int(p.n)}$, $${p.m}$ of $${M}$`, `доля путей вне коридора: при $n = ${int(p.n)}$ — $${p.m}$ из $${M}$`)} />
          </span>
          <em><MathText text={p.bound == null ? t('no Chebyshev bound', 'границы Чебышёва нет') : t(`bound $${texDec(p.bound.toFixed(3))}$`, `граница $${texDec(p.bound.toFixed(3))}$`)} /></em>
        </div>
      )}
      {(beat === 'paths' || beat === 'share') && (
        <Label x={0.955} y={beat === 'share' ? 0.93 : 0.95} align="end">{t('$n$, log scale', '$n$, логарифмическая шкала')}</Label>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the frame
function step(s: Sim, o: Live, f: Frame) {
  const { dt } = f;
  s.clock += dt;
  if (o.beat === 'tail') return drawTail(s, o, f);
  const last = o.c.ns.length - 1;
  s.front = o.reduced ? last : Math.min(last, s.front + (dt * last) / GROW * (0.35 + 1.3 * ease(clamp01(s.clock / GROW))));
  if (o.beat === 'paths') {
    drawPaths(s, o, f, { x0: 0.06, x1: 0.955, y0: 0.09, y1: 0.6 });
    drawShare(s, o, f, { x0: 0.06, x1: 0.955, y0: 0.7, y1: 0.9 }, false);
  } else drawShare(s, o, f, { x0: 0.08, x1: 0.95, y0: 0.12, y1: 0.86 }, true);
}

type Box = { x0: number; x1: number; y0: number; y1: number };

function drawPaths(s: Sim, o: Live, { ctx, w, h }: Frame, b: Box) {
  const { c, opts, hot } = o, lN = Math.log10(opts.N);
  const span = c.cauchy ? 4 : Math.max(3 * opts.eps, 2.5 * c.sd);
  const X = (n: number) => w * lerp(b.x0, b.x1, Math.log10(n) / lN);
  const Y = (v: number) => h * lerp(b.y1, b.y0, (Math.max(c.a - span, Math.min(c.a + span, v)) - (c.a - span)) / (2 * span));
  // the corridor
  ctx.fillStyle = rgba(PALETTE.signal, hot === 'eps' ? 0.2 : 0.1);
  ctx.fillRect(w * b.x0, Y(c.a + opts.eps), w * (b.x1 - b.x0), Y(c.a - opts.eps) - Y(c.a + opts.eps));
  ctx.strokeStyle = rgba(PALETTE.signal, 0.65);
  ctx.lineWidth = 1;
  for (const v of [c.a - opts.eps, c.a + opts.eps]) {
    ctx.beginPath();
    ctx.moveTo(w * b.x0, Y(v) + 0.5);
    ctx.lineTo(w * b.x1, Y(v) + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(PALETTE.cyan, hot === 'a' ? 1 : 0.6);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(w * b.x0, Y(c.a));
  ctx.lineTo(w * b.x1, Y(c.a));
  ctx.stroke();
  ctx.setLineDash([]);
  // Chebyshev's 3-sigma envelope of one mean, for scale: σ/√n shrinking
  // the paths up to the front
  const j = Math.floor(s.front), frac = s.front - j;
  const M = c.paths.length, alpha = Math.max(0.05, Math.min(0.35, 9 / M));
  const path = (y: number[], colour: string, width: number) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i <= j; i++) i ? ctx.lineTo(X(c.ns[i]), Y(y[i])) : ctx.moveTo(X(c.ns[i]), Y(y[i]));
    if (j + 1 < c.ns.length && frac > 0) ctx.lineTo(X(lerp(c.ns[j], c.ns[j + 1], frac)), Y(lerp(y[j], y[j + 1], frac)));
    ctx.stroke();
  };
  for (let p = 1; p < M; p++) {
    const out = Math.abs(c.paths[p][j] - c.a) >= opts.eps;
    path(c.paths[p], out ? `rgba(255,138,107,${alpha + 0.1})` : `rgba(244,244,242,${alpha})`, 1);
  }
  path(c.paths[0], hot === 'xbar' ? '#ffffff' : PALETTE.violet, 2);
  // the front: dots for every path at the current n
  const n = c.ns[j];
  for (let p = 0; p < M; p++) {
    const out = Math.abs(c.paths[p][j] - c.a) >= opts.eps;
    ctx.fillStyle = out ? PALETTE.coral : p === 0 ? PALETTE.violet : 'rgba(244,244,242,0.8)';
    ctx.beginPath();
    ctx.arc(X(n), Y(c.paths[p][j]), p === 0 ? 3.5 : 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  logTicks(ctx, w, h, b, lN, b.y1 + 0.03);
  for (const v of [c.a - span, c.a, c.a + span]) small(ctx, fmt(v), w * b.x0 - 8, Y(v) + 3, 'right');
}

function drawShare(s: Sim, o: Live, { ctx, w, h }: Frame, b: Box, big: boolean) {
  const { c, opts, hot } = o, lN = Math.log10(opts.N), M = c.paths.length;
  const X = (n: number) => w * lerp(b.x0, b.x1, Math.log10(n) / lN);
  const Y = (p: number) => h * lerp(b.y1, b.y0, p);
  const j = Math.floor(s.front);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  for (const p of big ? [0, 0.25, 0.5, 0.75, 1] : [0, 1]) {
    ctx.beginPath();
    ctx.moveTo(w * b.x0, Y(p) + 0.5);
    ctx.lineTo(w * b.x1, Y(p) + 0.5);
    ctx.stroke();
    small(ctx, dec(String(p)), w * b.x0 - 8, Y(p) + 3, 'right');
  }
  // the bound over the whole axis (dashed), solid up to the front
  if (!c.cauchy) {
    ctx.strokeStyle = rgba(PALETTE.signal, hot === 'bound' ? 1 : 0.85);
    ctx.lineWidth = hot === 'bound' ? 2.4 : 1.6;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    c.ns.forEach((n, i) => (i ? ctx.lineTo(X(n), Y(c.bound[i]!)) : ctx.moveTo(X(n), Y(c.bound[i]!))));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // the real share, up to the front, filled
  ctx.fillStyle = rgba(PALETTE.coral, 0.18);
  ctx.beginPath();
  ctx.moveTo(X(c.ns[0]), Y(0));
  for (let i = 0; i <= j; i++) ctx.lineTo(X(c.ns[i]), Y(c.outside[i] / M));
  ctx.lineTo(X(c.ns[j]), Y(0));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hot === 'share' || hot === 'm' ? '#ffffff' : PALETTE.coral;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= j; i++) i ? ctx.lineTo(X(c.ns[i]), Y(c.outside[i] / M)) : ctx.moveTo(X(c.ns[i]), Y(c.outside[i] / M));
  ctx.stroke();
  ctx.fillStyle = PALETTE.coral;
  ctx.beginPath();
  ctx.arc(X(c.ns[j]), Y(c.outside[j] / M), 4, 0, Math.PI * 2);
  ctx.fill();
  if (big) {
    logTicks(ctx, w, h, b, lN, b.y1 + 0.035);
    if (!c.cauchy) small(ctx, 'σ²/(nε²)', X(c.ns[Math.floor(c.ns.length * 0.55)]) + 8, Y(c.bound[Math.floor(c.ns.length * 0.55)]!) - 8, 'left', PALETTE.signal, 12);
  }
}

function drawTail(s: Sim, o: Live, { ctx, w, h, dt }: Frame) {
  const { draws, opts, hot } = o, law = opts.law, { a, sd, cauchy } = centreOf(law);
  // draws arrive slowly at first, then in a flood
  if (o.reduced) s.drawn = draws.length;
  else {
    s.acc += dt * Math.min(9000, 6 * 2.2 ** (s.clock * 2.4));
    const add = Math.floor(s.acc);
    s.acc -= add;
    s.drawn = Math.min(draws.length, s.drawn + add);
  }
  const lo = cauchy ? -8 : a - 4.5 * sd, hi = cauchy ? 8 : a + 4.5 * sd;
  const bw = (hi - lo) / BINS;
  s.bins.fill(0);
  for (let i = 0; i < s.drawn; i++) {
    const v = draws[i];
    if (v < lo || v >= hi) continue;
    s.bins[Math.floor((v - lo) / bw)]++;
  }
  const x0 = w * 0.05, x1 = w * 0.62, base = h * 0.68, top = h * 0.12;
  const X = (v: number) => lerp(x0, x1, (v - lo) / (hi - lo));
  let most = 1;
  for (let i = 0; i < BINS; i++) most = Math.max(most, s.bins[i]);
  const cut = (v: number) => (cauchy ? Math.abs(v) >= opts.k : Math.abs(v - a) >= opts.k * sd - 1e-12);
  for (let i = 0; i < BINS; i++) {
    const m = s.bins[i];
    if (!m) continue;
    const v = lo + (i + 0.5) * bw, H = (m / most) * (base - top);
    ctx.fillStyle = cut(v) ? rgba(PALETTE.coral, hot === 'tailsim' || hot === 'tail' ? 1 : 0.85) : 'rgba(244,244,242,0.42)';
    ctx.fillRect(X(lo + i * bw) + 0.5, base - H, Math.max(1, X(lo + (i + 1) * bw) - X(lo + i * bw) - 1), H);
  }
  // the latest draws as falling sparks
  const shownNow = Math.min(s.drawn, 6);
  for (let q = 0; q < shownNow; q++) {
    const v = draws[s.drawn - 1 - q];
    if (v < lo || v >= hi) continue;
    ctx.fillStyle = cut(v) ? PALETTE.coral : PALETTE.ink;
    ctx.globalAlpha = 1 - q / 6;
    ctx.beginPath();
    ctx.arc(X(v), top - 14 + q * 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  axis(ctx, x0, x1, base + 0.5);
  // a and a ± kσ
  ctx.strokeStyle = rgba(PALETTE.cyan, hot === 'a' ? 1 : 0.7);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(X(a), top - 4);
  ctx.lineTo(X(a), base);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = hot === 'k' ? PALETTE.signal : rgba(PALETTE.signal, 0.8);
  ctx.lineWidth = hot === 'k' ? 2 : 1.3;
  for (const v of cauchy ? [-opts.k, opts.k] : [a - opts.k * sd, a + opts.k * sd]) {
    if (v < lo || v > hi) continue;
    ctx.beginPath();
    ctx.moveTo(X(v), top);
    ctx.lineTo(X(v), base + 6);
    ctx.stroke();
  }
  // σ ticks
  for (let q = -4; q <= 4; q++) {
    const v = cauchy ? 2 * q : a + q * sd;
    if (v < lo || v > hi) continue;
    small(ctx, cauchy ? fmt(v) : q === 0 ? 'a' : `${q > 0 ? '+' : '−'}${Math.abs(q)}σ`, X(v), base + 16, 'center');
  }
  ctx.lineWidth = 1;
}

const fmt = (v: number) => (v < 0 ? '−' : '') + dec(String(Number(Math.abs(v).toFixed(2))));
function logTicks(ctx: CanvasRenderingContext2D, w: number, h: number, b: Box, lN: number, y: number) {
  axis(ctx, w * b.x0, w * b.x1, h * b.y1 + 0.5);
  for (let e = 0; e <= Math.floor(lN); e++) small(ctx, int(10 ** e), w * lerp(b.x0, b.x1, e / lN), h * y, 'center');
}
function axis(ctx: CanvasRenderingContext2D, a: number, b: number, y: number) {
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
