import { useMemo, useRef } from 'react';
import { PALETTE } from './specs.mjs';
import { MathText } from '../../math';
import { dec, int, t, texDec } from '../../i18n-core';
import { BEAM, beamThrows, irwinHallPdf, lawDraws, overlap, sumsOf, throwStats, within, type MomentLaw } from './moment-model.mjs';
import { clamp01, Label, lerp, rgba, useCanvasLoop, useSteadyState, useThrottledReport, type FigureProps, type Frame } from './kit';

/**
 * Centre of mass (L6). Every number is a station's own (Balance, Moments, Convolution; same seed and streams).
 * Beat "beam": four weights p_i at x_i on a beam that balances on its centre of mass Mξ; throws rain onto the
 * values, their frequencies grow under the beam, and the sample mean x̄ slides to the fulcrum. The bracket Mξ ± σ
 * shows the spread.
 * Beat "sigma": draws of a law pile into a histogram inside the nested bands Mξ ± σ, 2σ, 3σ; the shares inside
 * each band settle at their exact values (0.6827, 0.9545, 0.9973 for the normal law).
 * Beat "slide": the convolution integral at work: the box f_U(z − x) slides along f_{m−1}(x); the shaded overlap
 * is the density of the sum at z, traced below as z moves.
 * Beat "sums": R sums of m uniforms pile into a histogram against the exact density and the normal curve.
 */
const BEAM_TIME = 5;
const SLIDE_TIME = 4.2;
const SIGMA_BINS = 72;
const SUM_BINS = 60;

type Opts = { n: number; law: number; lambda: number; sigma: number; m: number; R: number; seed: number; x: number[]; p: number[] };
type Sim = { key: string; clock: number; count: number; acc: number; z: number; pause: number };
type Live = {
  beat: string; hot: string | null; reduced: boolean; opts: Opts;
  beam: ReturnType<typeof beamThrows>; draws: { L: MomentLaw; xs: Float64Array }; sums: Float64Array;
};

export function CentreMass({ beat, params, seed, hot, playing, reduced, runKey, onResults }: FigureProps) {
  const n = Math.round(params.n), law = Math.round(params.law), m = Math.round(params.m), R = Math.round(params.R);
  const ms = Math.max(2, m); // the slide needs a density to slide along
  const x = [params.x1, params.x2, params.x3, params.x4], p = [params.p1, params.p2, params.p3, params.p4];
  const opts: Opts = { n, law, lambda: params.lambda, sigma: params.sigma, m, R, seed, x, p };
  const beamParams = { x1: x[0], x2: x[1], x3: x[2], x4: x[3], p1: p[0], p2: p[1], p3: p[2], p4: p[3] };
  const beam = useMemo(() => beamThrows(beamParams, seed, n), [seed, n, ...x, ...p]); // eslint-disable-line react-hooks/exhaustive-deps
  const draws = useMemo(() => lawDraws(law, { lambda: params.lambda, sigma: params.sigma }, seed, n), [law, params.lambda, params.sigma, seed, n]);
  const sums = useMemo(() => sumsOf(m, R, seed), [m, R, seed]);
  const total = beat === 'beam' ? n : beat === 'sigma' ? n : beat === 'sums' ? R : 0;
  const key = `${beat}|${seed}|${n}|${law}|${params.lambda}|${params.sigma}|${m}|${R}|${x.join()}|${p.join()}|${runKey}`;
  const sim = useRef<Sim | null>(null);
  if (!sim.current || sim.current.key !== key) sim.current = { key, clock: 0, count: 0, acc: 0, z: 0, pause: 0 };
  const live = useRef<Live>({ beat, hot, reduced, opts, beam, draws, sums });
  live.current = { beat, hot, reduced, opts, beam, draws, sums };
  const [shown, setShown] = useSteadyState({ count: 0, z: 0 });

  useThrottledReport(() => {
    const s = sim.current!;
    setShown({ count: s.count, z: s.z });
    const st = throwStats(beam.law, beam.hits, beat === 'beam' ? s.count : n);
    const L = draws.L, c = beat === 'sigma' ? s.count : n;
    const w = [1, 2, 3].map((k) => within(L, draws.xs, k, c));
    let sm = 0, sv = 0;
    const cs = beat === 'sums' ? s.count : R;
    for (let i = 0; i < cs; i++) sm += sums[i];
    const mean = cs ? sm / cs : null;
    for (let i = 0; i < cs; i++) sv += (sums[i] - mean!) ** 2;
    return {
      Mx: beam.law.mean, Dx: beam.law.variance, sd: Math.sqrt(beam.law.variance), xbar: st.mean, s2: st.s2, throws: beat === 'beam' ? s.count : n,
      in1: w[0].observed, in2: w[1].observed, in3: w[2].observed, ex1: w[0].exact, ex2: w[1].exact, ex3: w[2].exact, out3: w[2].observed == null ? null : 1 - w[2].observed,
      lawMean: L.mean, lawVar: L.variance,
      z: s.z, fz: overlap(ms, s.z), m, summean: mean, sumvar: cs > 1 ? sv / cs : null, sumMth: m / 2, sumDth: m / 12, count: s.count,
    };
  }, onResults, 120, playing);

  const canvas = useCanvasLoop((f) => step(sim.current!, live.current, f, total), playing);
  const L = draws.L;
  const lawName = t(['Bernoulli law', 'binomial law', 'Poisson law', 'uniform law', 'exponential law', 'normal law', 'gamma law', 'beta law'][law],
    ['закон Бернулли', 'биномиальный закон', 'закон Пуассона', 'равномерный закон', 'показательный закон', 'нормальный закон', 'гамма-закон', 'бета-закон'][law]);
  const sigmaRows = [1, 2, 3].map((k) => ({ k, ...within(L, draws.xs, k, beat === 'sigma' ? shown.count : n) }));
  return (
    <div className="figure figure--centre" data-beat={beat}>
      <canvas ref={canvas} className="figure-canvas" role="img"
        aria-label={t(`Centre of mass: the beam balances at M = ${beam.law.mean.toFixed(3)}.`, `Центр масс: рычаг уравновешен в точке M = ${dec(beam.law.mean.toFixed(3))}.`)} />
      {beat === 'beam' && (
        <>
          <Label x={0.05} y={0.04}>{t('four weights $p_i$ at the points $x_i$ on a weightless beam', 'четыре груза $p_i$ в точках $x_i$ на невесомом рычаге')}</Label>
          <Label x={BX(beam.law.mean)} y={0.47} align="middle" hot={hot === 'Mx'} className="est-signal">{`$M\\xi = ${texDec(beam.law.mean.toFixed(3))}$`}</Label>
          <Label x={0.05} y={0.56}>{t(`${int(shown.count)} throws: frequencies $n_i/n$ against $p_i$`, `${int(shown.count)} бросков: частоты $n_i/n$ против $p_i$`)}</Label>
        </>
      )}
      {beat === 'sigma' && (
        <>
          <Label x={0.05} y={0.04}>{t(`${int(n)} draws, ${lawName}`, `${int(n)} значений, ${lawName}`)}</Label>
          <div className="centre-table" data-testid="sigma-table">
            <span />
            <span>{t('sample', 'выборка')}</span>
            <span>{t('exact', 'точно')}</span>
            {sigmaRows.map((r) => (
              <Row key={r.k} k={r.k} observed={r.observed} exact={r.exact} hot={hot === `in${r.k}` || hot === `ex${r.k}`} />
            ))}
          </div>
        </>
      )}
      {beat === 'slide' && (
        <>
          <Label x={0.06} y={0.04}>
            {ms === 2 ? t('$f(x)$ stays, the box $f(z - x)$ slides', '$f(x)$ стоит, прямоугольник $f(z - x)$ скользит') : t(`$f_{${ms - 1}}(x)$ stays, the box $f(z - x)$ slides`, `$f_{${ms - 1}}(x)$ стоит, прямоугольник $f(z - x)$ скользит`)}
          </Label>
          <Label x={0.06} y={0.53} hot={hot === 'fz'}>{t(`overlap area $=$ density of the sum $f_{${ms}}(z)$`, `площадь перекрытия $=$ плотность суммы $f_{${ms}}(z)$`)}</Label>
          <Label x={SX(shown.z, ms)} y={0.465} align="middle" hot={hot === 'z'} className="est-signal">{`$z = ${texDec(shown.z.toFixed(2))}$`}</Label>
        </>
      )}
      {beat === 'sums' && (
        <>
          <Label x={0.06} y={0.04}>{t(`${int(shown.count)} sums of $m = ${m}$ uniforms`, `${int(shown.count)} сумм $m = ${m}$ равномерных`)}</Label>
          <Label x={0.94} y={0.04} align="end" className="est-cyan">{t('line: exact density; dashed: normal', 'линия: точная плотность; пунктир: нормальная')}</Label>
        </>
      )}
    </div>
  );
}

function Row({ k, observed, exact, hot }: { k: number; observed: number | null; exact: number; hot: boolean }) {
  return (
    <>
      <span className={hot ? 'is-hot' : ''}><MathText text={`$|\\xi - M\\xi| < ${k}\\sigma$`} /></span>
      <b className={hot ? 'is-hot' : ''} data-testid={`sigma-in${k}`}>{observed == null ? '—' : dec(observed.toFixed(4))}</b>
      <i>{dec(exact.toFixed(4))}</i>
    </>
  );
}

// ---------------------------------------------------------------- coordinates
const BX = (v: number) => 0.08 + ((v - BEAM.lo) / (BEAM.hi - BEAM.lo)) * 0.86;
const SX = (z: number, m: number) => 0.08 + (z / Math.max(2, m)) * 0.86;

// ---------------------------------------------------------------- the frame
function step(s: Sim, o: Live, f: Frame, total: number) {
  const { dt } = f;
  s.clock += dt;
  if (o.beat === 'slide') {
    const span = Math.max(2, o.opts.m);
    if (o.reduced) s.z = span / 2;
    else if (s.pause > 0) s.pause -= dt;
    else {
      s.z += (dt * span) / SLIDE_TIME;
      if (s.z >= span) { s.z = span; s.pause = 1.2; }
    }
    if (!o.reduced && s.pause <= 0 && s.z >= span) s.z = 0;
    return drawSlide(s, o, f);
  }
  // arrivals: slow, then a flood
  if (o.reduced) s.count = total;
  else if (s.count < total) {
    s.acc += dt * Math.min(total / 1.2, 4 * 2.1 ** (s.clock * (o.beat === 'beam' ? 2 : 2.4)));
    const add = Math.floor(s.acc);
    s.acc -= add;
    s.count = Math.min(total, s.count + add);
  }
  if (o.beat === 'beam') drawBeam(s, o, f);
  else if (o.beat === 'sigma') drawSigma(s, o, f);
  else drawSums(s, o, f);
}

function drawBeam(s: Sim, o: Live, { ctx, w, h }: Frame) {
  const { law, hits } = o.beam, hot = o.hot;
  const X = (v: number) => w * BX(v);
  const by = h * 0.36;
  // the beam, the fulcrum and the weights
  ctx.strokeStyle = 'rgba(244,244,242,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(X(BEAM.lo), by);
  ctx.lineTo(X(BEAM.hi), by);
  ctx.stroke();
  const fx = X(law.mean);
  ctx.fillStyle = hot === 'Mx' ? PALETTE.signal : rgba(PALETTE.signal, 0.9);
  ctx.shadowColor = PALETTE.signal;
  ctx.shadowBlur = hot === 'Mx' ? 18 : 8;
  ctx.beginPath();
  ctx.moveTo(fx, by + 2);
  ctx.lineTo(fx - 13, by + 24);
  ctx.lineTo(fx + 13, by + 24);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // σ bracket
  const sd = Math.sqrt(law.variance);
  ctx.strokeStyle = rgba(PALETTE.coral, hot === 'sd' || hot === 'Dx' ? 1 : 0.6);
  ctx.lineWidth = hot === 'sd' || hot === 'Dx' ? 2 : 1.2;
  ctx.beginPath();
  ctx.moveTo(X(law.mean - sd), by + 34);
  ctx.lineTo(X(law.mean - sd), by + 40);
  ctx.lineTo(X(law.mean + sd), by + 40);
  ctx.lineTo(X(law.mean + sd), by + 34);
  ctx.stroke();
  for (let i = 0; i < law.x.length; i++) {
    const r = 6 + Math.sqrt(law.p[i]) * 34;
    ctx.strokeStyle = 'rgba(244,244,242,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X(law.x[i]), by - 2);
    ctx.lineTo(X(law.x[i]), by - 14);
    ctx.stroke();
    const g = ctx.createRadialGradient(X(law.x[i]) - r / 3, by - 14 - r - r / 3, r / 6, X(law.x[i]), by - 14 - r, r);
    g.addColorStop(0, '#e6e6e2');
    g.addColorStop(1, '#5c5c58');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(X(law.x[i]), by - 14 - r, r, 0, Math.PI * 2);
    ctx.fill();
    small(ctx, dec(law.p[i].toFixed(2)), X(law.x[i]), by - 14 - r + 4, 'center', '#111', 11);
  }
  // frequencies under the beam: bars n_i/n, ticks at p_i
  const base = h * 0.9, top = h * 0.62, scale = (top - base) / Math.max(0.5, ...law.p);
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < s.count; i++) counts[hits[i]]++;
  for (let i = 0; i < law.x.length; i++) {
    const fr = s.count ? counts[i] / s.count : 0, bw = 22;
    ctx.fillStyle = rgba(PALETTE.violet, 0.55);
    ctx.fillRect(X(law.x[i]) - bw / 2, base + fr * scale, bw, -fr * scale);
    ctx.strokeStyle = PALETTE.signal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(law.x[i]) - bw / 2 - 5, base + law.p[i] * scale);
    ctx.lineTo(X(law.x[i]) + bw / 2 + 5, base + law.p[i] * scale);
    ctx.stroke();
  }
  axis(ctx, X(BEAM.lo), X(BEAM.hi), base + 0.5);
  for (let v = BEAM.lo; v <= BEAM.hi; v++) small(ctx, v < 0 ? `−${-v}` : String(v), X(v), base + 15, 'center');
  // the latest throws fall from the weights to the bars
  for (let q = 0; q < Math.min(5, s.count); q++) {
    const k = hits[s.count - 1 - q];
    ctx.globalAlpha = 1 - q / 5;
    ctx.fillStyle = PALETTE.violet;
    ctx.beginPath();
    ctx.arc(X(law.x[k]), lerp(by + 30, base - 6, clamp01(0.2 + q * 0.2)), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // the sample mean
  if (s.count) {
    const st = throwStats(law, hits, s.count), xm = X(st.mean!);
    ctx.strokeStyle = hot === 'xbar' ? '#ffffff' : PALETTE.violet;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xm, top - 8);
    ctx.lineTo(xm, base);
    ctx.stroke();
    small(ctx, 'x̄', xm + 6, top, 'left', PALETTE.violet, 13);
  }
}

function drawSigma(s: Sim, o: Live, { ctx, w, h }: Frame) {
  const { L, xs } = o.draws, hot = o.hot, sd = Math.sqrt(L.variance);
  // continuous laws: a window of ±4.5σ around the mean, inside the law's own range
  const lo = L.discrete ? -0.5 : Math.max(L.range![0], L.mean - 4.5 * sd);
  const hi = L.discrete ? Math.min(27, L.support!.at(-1)!) + 0.5 : Math.min(L.range![1], L.mean + 4.5 * sd);
  const x0 = w * 0.05, x1 = w * 0.68, base = h * 0.86, top = h * 0.14;
  const X = (v: number) => lerp(x0, x1, (v - lo) / (hi - lo));
  // the bands, widest first
  for (const k of [3, 2, 1]) {
    const a = Math.max(lo, L.mean - k * sd), b = Math.min(hi, L.mean + k * sd);
    ctx.fillStyle = rgba(PALETTE.signal, hot === `in${k}` || hot === `ex${k}` ? 0.2 : 0.06);
    ctx.fillRect(X(a), top, X(b) - X(a), base - top);
    ctx.strokeStyle = rgba(PALETTE.signal, 0.35);
    ctx.lineWidth = 1;
    for (const v of [L.mean - k * sd, L.mean + k * sd]) {
      if (v < lo || v > hi) continue;
      ctx.beginPath();
      ctx.moveTo(X(v) + 0.5, top);
      ctx.lineTo(X(v) + 0.5, base);
      ctx.stroke();
      small(ctx, `${v < L.mean ? '−' : '+'}${k}σ`, X(v), top - 6, 'center', rgba(PALETTE.signal, 0.85));
    }
  }
  // the histogram of the draws so far
  const bins = L.discrete ? Math.round(hi - lo) : SIGMA_BINS, bw = (hi - lo) / bins;
  const counts = new Int32Array(bins);
  for (let i = 0; i < s.count; i++) {
    const b = Math.floor((xs[i] - lo) / bw);
    if (b >= 0 && b < bins) counts[b]++;
  }
  let peak = 0;
  if (L.discrete) for (const q of L.pmf!) peak = Math.max(peak, q);
  else for (let i = 0; i <= 200; i++) peak = Math.max(peak, L.pdf!(lo + ((hi - lo) * i) / 200));
  const unit = (base - top - 20) / (peak * 1.08);
  for (let b = 0; b < bins; b++) {
    if (!counts[b]) continue;
    const dens = counts[b] / Math.max(1, s.count) / (L.discrete ? 1 : bw);
    const vm = lo + (b + 0.5) * bw, out = Math.abs(vm - L.mean) >= 3 * sd;
    ctx.fillStyle = out ? rgba(PALETTE.coral, 0.9) : 'rgba(244,244,242,0.45)';
    ctx.fillRect(X(lo + b * bw) + 0.5, base - dens * unit, Math.max(1, X(lo + (b + 1) * bw) - X(lo + b * bw) - 1), dens * unit);
  }
  // the law
  ctx.strokeStyle = rgba(PALETTE.cyan, 0.9);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (L.discrete) {
    L.support!.forEach((k, i) => { if (k <= hi) { ctx.moveTo(X(k), base); ctx.lineTo(X(k), base - L.pmf![i] * unit); } });
  } else for (let i = 0; i <= 240; i++) { const v = lo + ((hi - lo) * i) / 240; i ? ctx.lineTo(X(v), base - L.pdf!(v) * unit) : ctx.moveTo(X(v), base - L.pdf!(v) * unit); }
  ctx.stroke();
  axis(ctx, x0, x1, base + 0.5);
  ctx.strokeStyle = PALETTE.ink;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(X(L.mean), top);
  ctx.lineTo(X(L.mean), base);
  ctx.stroke();
  ctx.setLineDash([]);
  small(ctx, 'Mξ', X(L.mean), base + 15, 'center', PALETTE.ink);
}

function drawSlide(s: Sim, o: Live, { ctx, w, h }: Frame) {
  const m = Math.max(2, o.opts.m), span = Math.max(2, m), hot = o.hot, z = s.z;
  const X = (v: number) => w * SX(v, m);
  // top: f_{m−1} and the sliding box
  const b1 = h * 0.42, t1 = h * 0.12;
  const f1 = (x: number) => (m - 1 <= 1 ? (x >= 0 && x <= 1 ? 1 : 0) : irwinHallPdf(x, m - 1));
  const peak1 = m - 1 <= 1 ? 1 : f1((m - 1) / 2);
  const Y1 = (v: number) => b1 - (v / Math.max(1, peak1)) * (b1 - t1) * 0.9;
  // the overlap, shaded
  ctx.fillStyle = rgba(PALETTE.signal, hot === 'fz' ? 0.55 : 0.35);
  ctx.beginPath();
  const a = Math.max(0, z - 1), b = Math.min(m - 1, z);
  if (b > a) {
    ctx.moveTo(X(a), b1);
    for (let i = 0; i <= 80; i++) { const v = a + ((b - a) * i) / 80; ctx.lineTo(X(v), Y1(f1(v))); }
    ctx.lineTo(X(b), b1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = rgba(PALETTE.ink, 0.9);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i <= 300; i++) { const v = -0.3 + ((span + 0.6) * i) / 300; i ? ctx.lineTo(X(v), Y1(f1(v))) : ctx.moveTo(X(v), Y1(f1(v))); }
  ctx.stroke();
  ctx.strokeStyle = PALETTE.cyan;
  ctx.lineWidth = 2;
  ctx.strokeRect(X(z - 1), Y1(1), X(z) - X(z - 1), b1 - Y1(1));
  axis(ctx, X(-0.3), X(span + 0.3), b1 + 0.5);
  for (let v = 0; v <= span; v++) small(ctx, String(v), X(v), b1 + 15, 'center');
  // bottom: the density of the sum, traced up to z
  const b2 = h * 0.9, t2 = h * 0.6;
  const peak2 = m <= 1 ? 1 : irwinHallPdf(m / 2, m);
  const Y2 = (v: number) => b2 - (v / Math.max(1, peak2)) * (b2 - t2) * 0.9;
  ctx.strokeStyle = 'rgba(232,228,133,0.25)';
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= 300; i++) { const v = (span * i) / 300; i ? ctx.lineTo(X(v), Y2(irwinHallPdf(v, m))) : ctx.moveTo(X(v), Y2(irwinHallPdf(v, m))); }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = PALETTE.signal;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  const steps = Math.max(1, Math.round((z / span) * 300));
  for (let i = 0; i <= steps; i++) { const v = (z * i) / steps; i ? ctx.lineTo(X(v), Y2(irwinHallPdf(v, m))) : ctx.moveTo(X(v), Y2(irwinHallPdf(v, m))); }
  ctx.stroke();
  const fz = irwinHallPdf(z, m);
  ctx.strokeStyle = rgba(PALETTE.signal, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(X(z), b1);
  ctx.lineTo(X(z), Y2(fz));
  ctx.stroke();
  ctx.fillStyle = PALETTE.signal;
  ctx.shadowColor = PALETTE.signal;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(X(z), Y2(fz), 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  axis(ctx, X(0), X(span), b2 + 0.5);
  for (let v = 0; v <= span; v++) small(ctx, String(v), X(v), b2 + 15, 'center');
}

function drawSums(s: Sim, o: Live, { ctx, w, h }: Frame) {
  const m = o.opts.m, sums = o.sums, lo = 0, hi = Math.max(2, m), bw = (hi - lo) / SUM_BINS;
  const x0 = w * 0.06, x1 = w * 0.94, base = h * 0.88, top = h * 0.14;
  const X = (v: number) => lerp(x0, x1, (v - lo) / (hi - lo));
  const counts = new Int32Array(SUM_BINS);
  for (let i = 0; i < s.count; i++) { const b = Math.floor((sums[i] - lo) / bw); if (b >= 0 && b < SUM_BINS) counts[b]++; }
  const peak = m <= 1 ? 1 : irwinHallPdf(m / 2, m), unit = (base - top) / (peak * 1.15);
  for (let b = 0; b < SUM_BINS; b++) {
    if (!counts[b]) continue;
    const d = counts[b] / Math.max(1, s.count) / bw;
    ctx.fillStyle = 'rgba(244,244,242,0.42)';
    ctx.fillRect(X(lo + b * bw) + 0.5, base - d * unit, X(lo + (b + 1) * bw) - X(lo + b * bw) - 1, d * unit);
  }
  const mu = m / 2, sd = Math.sqrt(m / 12);
  ctx.strokeStyle = rgba(PALETTE.violet, 0.9);
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i <= 300; i++) { const v = lo + ((hi - lo) * i) / 300, y = Math.exp(-0.5 * ((v - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI)); i ? ctx.lineTo(X(v), base - y * unit) : ctx.moveTo(X(v), base - y * unit); }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = PALETTE.cyan;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 300; i++) { const v = lo + ((hi - lo) * i) / 300; i ? ctx.lineTo(X(v), base - irwinHallPdf(v, m) * unit) : ctx.moveTo(X(v), base - irwinHallPdf(v, m) * unit); }
  ctx.stroke();
  axis(ctx, x0, x1, base + 0.5);
  for (let v = lo; v <= hi; v++) small(ctx, String(v), X(v), base + 15, 'center');
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
