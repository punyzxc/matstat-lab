import { useMemo, useRef, useState } from 'react';
import { PALETTE } from './specs.mjs';
import { dec, int, t, texDec } from '../../i18n-core';
import { courtCases, errorsOf, phi, powerCurve, rejects, type Region } from './test-model.mjs';
import { MathText } from '../../math';
import { clamp01, ease, Label, lerp, rgba, useCanvasLoop, useThrottledReport, type FigureProps, type Frame } from './kit';

/**
 * The hypothesis court (L12). One statistic U, two laws: N(0, 1) when H0 is true and N(δ, 1) when the true mean is a.
 * Beat "laws": the critical region K cuts α out of the H0 law, β and the power 1 − β out of the H1 law.
 * Beat "stream": seeded samples arrive one by one, their U falls onto the axis and stacks, coloured by the verdict;
 * the share rejected settles at α (H0 true) or at the power (H1 true). The samples are the Testing station's own.
 * Beat "power": the power curve 1 − β(a), exact and simulated, with the current a marked.
 */
const R = 1000;
const POWER_R = 400;
const GRID = Array.from({ length: 31 }, (_, i) => Math.round((-1.5 + i * 0.1) * 100) / 100);
const SLOW = 3;
const BINS = 64;

type Opts = { n: number; a: number; alpha: number; tail: number; truth: number; seed: number };
type Sim = {
  key: string; clock: number; made: number; hits: number; acc: number; fastSince: number | null;
  flying: { u: number; born: number } | null; bins: Int32Array; binsReject: Int32Array; shown: number;
  lo: number; hi: number;
  /** the bins span the axis the laws settle on for these parameters */
  binLo: number; binHi: number;
};
type Live = { beat: string; hot: string | null; reduced: boolean; opts: Opts; cases: number[]; region: Region; delta: number; curve: ReturnType<typeof powerCurve> };

export function TestCourt({ beat, params, seed, hot, onHot, playing, reduced, runKey, onResults }: FigureProps) {
  const n = Math.round(params.n), a = params.a, alpha = params.alpha, tail = Math.round(params.tail), truth = Math.round(params.truth);
  const opts: Opts = { n, a, alpha, tail, truth, seed };
  const err = errorsOf({ n, d: a, alpha, tail });
  const all = useMemo(() => courtCases({ n, d: a, alpha, tail, seed, R }), [n, a, alpha, tail, seed]);
  const cases = truth ? all.h1 : all.h0;
  const curve = useMemo(() => powerCurve({ n, alpha, tail, seed, R: POWER_R, grid: GRID }), [n, alpha, tail, seed]);
  const key = `${n}|${a}|${alpha}|${tail}|${truth}|${seed}|${runKey}`;
  const sim = useRef<Sim | null>(null);
  if (!sim.current || sim.current.key !== key) {
    const prev = sim.current;
    sim.current = {
      key, clock: 0, made: 0, hits: 0, acc: 0, fastSince: null, flying: null, bins: new Int32Array(BINS), binsReject: new Int32Array(BINS), shown: 0,
      lo: prev?.lo ?? Math.min(-4.2, err.delta - 4.2), hi: prev?.hi ?? Math.max(4.2, err.delta + 4.2),
      binLo: Math.min(-4.2, err.delta - 4.2), binHi: Math.max(4.2, err.delta + 4.2),
    };
  }
  const live = useRef<Live>({ beat, hot, reduced, opts, cases, region: err.region, delta: err.delta, curve });
  live.current = { beat, hot, reduced, opts, cases, region: err.region, delta: err.delta, curve };
  const [shown, setShown] = useState({ made: 0, hits: 0 });
  const ucr = err.region.upper ?? -(err.region.lower ?? 0);

  useThrottledReport(() => {
    const s = sim.current!;
    setShown({ made: s.made, hits: s.hits });
    const last = s.made ? cases[s.made - 1] : null;
    return {
      alpha, beta: err.beta, power: err.power, ucr, delta: err.delta, U: s.flying?.u ?? last, rej: s.made ? s.hits / s.made : null, count: s.made, a0: 0,
    };
  }, onResults, 120);

  const canvas = useCanvasLoop((f) => step(sim.current!, live.current, f), playing);
  const rate = shown.made ? shown.hits / shown.made : null;
  const target = truth && err.power != null ? err.power : alpha;
  const top = beat === 'laws' ? 0.86 : 0.44;
  const s = sim.current!;
  const U = (u: number) => 0.04 + ((u - s.lo) / (s.hi - s.lo)) * 0.92;
  return (
    <div
      className="figure figure--court"
      data-beat={beat}
      onMouseMove={(e) => {
        if (beat === 'power') return onHot(null);
        const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        if (y > top + 0.02) return onHot('rej');
        const u = s.lo + ((x - 0.04) / 0.92) * (s.hi - s.lo);
        if (Math.abs(u - ucr) < 0.15 || (err.region.lower !== null && Math.abs(u - err.region.lower) < 0.15)) return onHot('ucr');
        const inK = rejects(u, err.region);
        onHot(inK ? (u > err.delta / 2 + 1 && err.power != null ? 'power' : 'alpha') : err.beta != null && u > err.delta - 2.5 && u < err.delta + 2.5 ? 'beta' : 'a0');
      }}
      onMouseLeave={() => onHot(null)}
    >
      <canvas ref={canvas} className="figure-canvas" role="img"
        aria-label={t(`Hypothesis test, n = ${n}, true mean ${a}, alpha ${alpha}: ${shown.hits} of ${shown.made} samples reject H0.`,
          `Проверка гипотезы, n = ${n}, истинное среднее ${dec(String(a))}, α = ${dec(String(alpha))}: ${shown.hits} из ${shown.made} выборок отвергают H0.`)} />
      {beat !== 'power' && (
        <>
          <Label x={U(0)} y={0.045} align="middle" hot={hot === 'a0'}>{'$H_0$'}</Label>
          {err.power != null && <Label x={U(err.delta)} y={0.045} align="middle" hot={hot === 'a'} className="est-cyan">{'$H_1$'}</Label>}
          <Label x={0.03} y={top + 0.035} hot={hot === 'ucr'}>
            {t(`critical region $\\mathcal{K}$: $${err.region.lower !== null && err.region.upper !== null ? `|U| > ${texDec(ucr.toFixed(3))}` : err.region.upper !== null ? `U > ${texDec(ucr.toFixed(3))}` : `U < ${texDec((err.region.lower as number).toFixed(3))}`}$`,
              `критическая область $\\mathcal{K}$: $${err.region.lower !== null && err.region.upper !== null ? `|U| > ${texDec(ucr.toFixed(3))}` : err.region.upper !== null ? `U > ${texDec(ucr.toFixed(3))}` : `U < ${texDec((err.region.lower as number).toFixed(3))}`}$`)}
          </Label>
          <Label x={0.97} y={top + 0.035} align="end" className="court-errors">
            {`$\\color{#ff8a6b}{\\alpha = ${texDec(alpha.toFixed(3))}}$` + (err.power != null ? `$\\quad\\color{#b9a2ff}{\\beta = ${texDec(err.beta!.toFixed(3))}}\\quad\\color{#8fe3b0}{1 - \\beta = ${texDec(err.power.toFixed(3))}}$` : '')}
          </Label>
        </>
      )}
      {beat === 'stream' && (
        <div className={`ci-gauge court-gauge${hot === 'rej' ? ' is-hot' : ''}`}>
          <span className="ci-gauge-label"><MathText text={t('rejected $H_0$', 'отвергли $H_0$')} /></span>
          <b data-testid="court-rate">{rate == null ? '—' : dec((rate * 100).toFixed(1)) + '%'}</b>
          <span className="ci-gauge-count">{int(shown.hits)} {t('of', 'из')} {int(shown.made)}</span>
          <span className="court-target"><MathText text={truth && err.power != null ? t(`power $1 - \\beta = ${texDec(target.toFixed(3))}$`, `мощность $1 - \\beta = ${texDec(target.toFixed(3))}$`) : t(`$\\alpha = ${texDec(alpha.toFixed(3))}$: $H_0$ is true`, `$\\alpha = ${texDec(alpha.toFixed(3))}$: $H_0$ верна`)} /></span>
        </div>
      )}
      {beat === 'power' && (
        <>
          <Label x={0.08} y={0.05}>{t(`power $1 - \\beta(a)$ at $n = ${n}$, $\\alpha = ${texDec(String(alpha))}$`, `мощность $1 - \\beta(a)$ при $n = ${n}$, $\\alpha = ${texDec(String(alpha))}$`)}</Label>
          <Label x={0.92} y={0.93} align="end">{t('true mean $a$', 'истинное среднее $a$')}</Label>
          <Label x={0.92} y={0.05} align="end" className="est-mint">{t(`line: exact; dots: ${POWER_R} samples each`, `линия: точно; точки: по ${POWER_R} выборок`)}</Label>
        </>
      )}
    </div>
  );
}

const colours = (truth: number) => ({ reject: truth ? PALETTE.mint : PALETTE.coral, keep: truth ? PALETTE.violet : 'rgba(226,226,222,0.8)' });

function step(s: Sim, o: Live, f: Frame) {
  const { ctx, w, h, dt } = f;
  s.clock += dt;
  // the axis follows both laws, smoothly
  const lo = Math.min(-4.2, o.delta - 4.2), hi = Math.max(4.2, o.delta + 4.2);
  const k = o.reduced ? 1 : clamp01(dt * 5);
  s.lo = lerp(s.lo, lo, k);
  s.hi = lerp(s.hi, hi, k);
  if (o.beat === 'power') return drawPower(s, o, f);
  // verdicts arrive in every beat but are drawn only in the stream
  const commit = () => {
    const u = o.cases[s.made];
    const b = Math.min(BINS - 1, Math.max(0, Math.floor(((u - s.binLo) / (s.binHi - s.binLo)) * BINS)));
    s.bins[b]++;
    if (rejects(u, o.region)) {
      s.hits++;
      s.binsReject[b]++;
    }
    s.made++;
  };
  if (o.reduced) while (s.made < R) commit();
  else if (s.made < SLOW && o.beat === 'stream') {
    if (!s.flying) s.flying = { u: o.cases[s.made], born: s.clock };
    else if (s.clock - s.flying.born > 1.3) {
      s.flying = null;
      commit();
    }
  } else if (s.made < R) {
    s.flying = null;
    if (s.fastSince == null) s.fastSince = s.clock;
    s.acc += Math.min(160, 3 * 1.9 ** ((s.clock - s.fastSince) * 1.3)) * dt;
    while (s.acc >= 1 && s.made < R) {
      s.acc -= 1;
      commit();
    }
  }
  const X = (u: number) => w * 0.04 + ((u - s.lo) / (s.hi - s.lo)) * w * 0.92;
  const base = h * (o.beat === 'laws' ? 0.84 : 0.42), peak = h * (o.beat === 'laws' ? 0.6 : 0.3);
  const Y = (p: number) => base - (p / phi(0)) * peak;
  const region = o.region, d = o.delta, h1 = Math.abs(d) > 1e-9;
  const inK = (u: number) => rejects(u, region);
  // shaded areas: alpha under H0 in K, beta under H1 outside K, power under H1 in K
  const fill = (center: number, pick: (u: number) => boolean, color: string, a: number) => {
    ctx.fillStyle = rgba(color, a);
    const steps = 360;
    for (let i = 0; i < steps; i++) {
      const u0 = s.lo + ((s.hi - s.lo) * i) / steps, u1 = s.lo + ((s.hi - s.lo) * (i + 1)) / steps, um = (u0 + u1) / 2;
      if (!pick(um)) continue;
      const y = Y(phi(um - center));
      ctx.fillRect(X(u0), y, X(u1) - X(u0) + 0.5, base - y);
    }
  };
  const hot = o.hot;
  if (h1) {
    fill(d, (u) => !inK(u), PALETTE.violet, hot === 'beta' ? 0.55 : 0.28);
    fill(d, inK, PALETTE.mint, hot === 'power' ? 0.55 : 0.25);
  }
  fill(0, inK, PALETTE.coral, hot === 'alpha' ? 0.85 : 0.6);
  const curve = (center: number, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const u = s.lo + ((s.hi - s.lo) * i) / 240;
      i ? ctx.lineTo(X(u), Y(phi(u - center))) : ctx.moveTo(X(u), Y(phi(u - center)));
    }
    ctx.stroke();
  };
  curve(0, hot === 'a0' ? '#fff' : 'rgba(244,244,242,0.85)', 1.6);
  if (h1) curve(d, hot === 'a' || hot === 'delta' ? PALETTE.cyan : rgba(PALETTE.cyan, 0.85), 1.6);
  axisLine(ctx, X(s.lo), X(s.hi), base + 0.5);
  for (let u = Math.ceil(s.lo); u <= s.hi; u++) tick(ctx, u < 0 ? `−${-u}` : `${u}`, X(u), base + 13);
  // the border of K
  ctx.strokeStyle = rgba(PALETTE.signal, hot === 'ucr' ? 1 : 0.85);
  ctx.lineWidth = hot === 'ucr' ? 2.2 : 1.4;
  for (const c of [region.lower, region.upper]) {
    if (c === null) continue;
    ctx.beginPath();
    ctx.moveTo(X(c), base - peak - 10);
    ctx.lineTo(X(c), o.beat === 'stream' ? h * 0.95 : base + 4);
    ctx.stroke();
  }
  if (o.beat !== 'stream') return;

  // the verdicts: every U stacks in its bin; colour = verdict, under the chosen truth
  const c = colours(o.opts.truth);
  const floor = h * 0.95, room = h * 0.42;
  let most = 1;
  for (let b = 0; b < BINS; b++) most = Math.max(most, s.bins[b]);
  const unit = Math.min(5, room / Math.max(most * 1.1, R * 0.045));
  const bx = (b: number) => X(s.binLo + (b * (s.binHi - s.binLo)) / BINS), bw = Math.max(1, bx(1) - bx(0) - 1);
  for (let b = 0; b < BINS; b++) {
    const all = s.bins[b], rej = s.binsReject[b];
    if (!all) continue;
    ctx.fillStyle = rgba(c.reject, hot === 'rej' ? 1 : 0.85);
    ctx.fillRect(bx(b), floor - rej * unit, bw, rej * unit);
    ctx.fillStyle = rgba(c.keep, 0.7);
    ctx.fillRect(bx(b), floor - all * unit, bw, (all - rej) * unit);
  }
  axisLine(ctx, X(s.lo), X(s.hi), floor + 0.5);
  if (s.flying) {
    const age = s.clock - s.flying.born, u = s.flying.u, kf = ease(age / 1.1);
    const y = lerp(base + 10, floor - 6, kf);
    ctx.fillStyle = inK(u) ? c.reject : c.keep;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(X(u), y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawPower(s: Sim, o: Live, { ctx, w, h, dt }: Frame) {
  const { grid, exact, simulated } = o.curve;
  s.shown = o.reduced ? grid.length : Math.min(grid.length, s.shown + dt * 9);
  const x0 = w * 0.08, x1 = w * 0.92, y0 = h * 0.88, y1 = h * 0.12;
  const X = (a: number) => lerp(x0, x1, (a - grid[0]) / (grid[grid.length - 1] - grid[0])), Y = (p: number) => lerp(y0, y1, p);
  axisLine(ctx, x0, x1, y0 + 0.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  for (const p of [0.25, 0.5, 0.75, 1]) {
    ctx.beginPath();
    ctx.moveTo(x0, Y(p));
    ctx.lineTo(x1, Y(p));
    ctx.stroke();
    tick(ctx, dec(String(p)), x0 - 14, Y(p) + 3);
  }
  for (const a of [-1.5, -1, -0.5, 0, 0.5, 1, 1.5]) tick(ctx, a < 0 ? `−${dec(String(-a))}` : dec(String(a)), X(a), y0 + 14);
  // alpha: the height of the curve at a = a0
  ctx.strokeStyle = rgba(PALETTE.coral, 0.8);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x0, Y(o.opts.alpha));
  ctx.lineTo(x1, Y(o.opts.alpha));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = PALETTE.mint;
  ctx.lineWidth = 2;
  ctx.beginPath();
  grid.forEach((a, i) => (i ? ctx.lineTo(X(a), Y(exact[i])) : ctx.moveTo(X(a), Y(exact[i]))));
  ctx.stroke();
  ctx.fillStyle = PALETTE.ink;
  for (let i = 0; i < Math.floor(s.shown); i++) {
    ctx.beginPath();
    ctx.arc(X(grid[i]), Y(simulated[i]), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // the current a
  const a = o.opts.a, p = errorsOf({ n: o.opts.n, d: a, alpha: o.opts.alpha, tail: o.opts.tail }).power ?? o.opts.alpha;
  ctx.strokeStyle = rgba(PALETTE.cyan, 0.8);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(X(a), y0);
  ctx.lineTo(X(a), Y(p));
  ctx.stroke();
  ctx.fillStyle = PALETTE.signal;
  ctx.shadowColor = PALETTE.signal;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(X(a), Y(p), 6, 0, Math.PI * 2);
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
function tick(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(200,200,196,0.7)';
  ctx.fillText(text, x, y);
}
