import { useMemo, useRef } from 'react';
import { PALETTE } from './specs.mjs';
import { dec, int, t, texDec } from '../../i18n-core';
import { estimatesAt, LADDER, MU, theory, type Estimates } from './est-model.mjs';
import { clamp01, ease, easeInOut, Label, lerp, rgba, useCanvasLoop, useSteadyState, useThrottledReport, type FigureProps, type Frame } from './kit';

/**
 * Clouds of estimates and the n vs n − 1 race (#135, L11). Samples come from the estimation kernel with the
 * Estimation station's streams, so after 2000 samples the two variance means equal the station's bias readouts.
 * Beat "cloud": every sample falls, collapses into x̄ and drops into a cloud around the true mean a; the bracket
 * ±σ/√n and the curve N(a, σ²/n) say where the cloud is heading, and the ladder below shows clouds for
 * n = 2 … 50 side by side: the larger n, the tighter the cloud (consistency).
 * Beat "race": the same samples feed both variance formulas; two histograms grow on one axis, and their means
 * are marked against σ²: the divisor-n mean settles at (n − 1)σ²/n, the divisor-(n − 1) mean on σ² (bias).
 */
const R = 2000;
const SLOW = 2;
const CYCLE = { fall: 0.9, mean: 1.4, drop: 2.0 };
const SPAN = 3.2; // the sample axis covers a ± SPAN·σ
const CLOUD_BINS = 96;
const VAR_BINS = 44;
const LADDER_SIZE = 160;

type Sim = {
  key: string;
  clock: number;
  made: Estimates[];
  flying: { e: Estimates; born: number } | null;
  acc: number;
  fastSince: number | null;
  sm: number; sm2: number; svn: number; svn1: number;
  cloud: Int32Array; binsN: Int32Array; binsN1: Int32Array;
  vScale: number;
};
type Opts = { n: number; sigma: number; law: number; seed: number };
type Live = { beat: string; hot: string | null; reduced: boolean; opts: Opts; vMax: number; ladder: number[][] };

/** Upper end of the variance axis: wide enough for most estimates at this n, in units of σ². */
const varAxis = (n: number) => Math.min(4.5, Math.max(2.2, 1 + 4 * Math.sqrt(2 / Math.max(1, n - 1))));

export function EstimateCloud({ beat, params, seed, hot, onHot, playing, reduced, runKey, onResults }: FigureProps) {
  const n = Math.round(params.n), sigma = params.sigma, law = Math.round(params.law);
  const key = `${n}|${sigma}|${law}|${seed}|${runKey}`;
  const sim = useRef<Sim | null>(null);
  if (!sim.current || sim.current.key !== key) {
    sim.current = {
      key, clock: 0, made: [], flying: null, acc: 0, fastSince: null, sm: 0, sm2: 0, svn: 0, svn1: 0,
      cloud: new Int32Array(CLOUD_BINS), binsN: new Int32Array(VAR_BINS), binsN1: new Int32Array(VAR_BINS), vScale: 0,
    };
  }
  const opts = { n, sigma, law, seed };
  const vMax = varAxis(n) * sigma * sigma;
  // The consistency ladder: the first LADDER_SIZE sample means for each n, from the same streams as the cloud.
  const ladder = useMemo(
    () => LADDER.map((m) => Array.from({ length: LADDER_SIZE }, (_, r) => estimatesAt({ n: m, sigma, law, seed, r }).mean)),
    [sigma, law, seed],
  );
  const live = useRef<Live>({ beat, hot, reduced, opts, vMax, ladder });
  live.current = { beat, hot, reduced, opts, vMax, ladder };
  const th = theory(n, sigma);
  const [shown, setShown] = useSteadyState({ count: 0, last: null as Estimates | null, mn: null as number | null, mn1: null as number | null, sdx: null as number | null });

  useThrottledReport(() => {
    const s = sim.current!, c = s.made.length, last = s.flying?.e ?? s.made.at(-1) ?? null;
    const mn = c ? s.svn / c : null, mn1 = c ? s.svn1 / c : null;
    const sdx = c > 1 ? Math.sqrt(Math.max(0, (s.sm2 - (s.sm * s.sm) / c) / (c - 1))) : null;
    setShown({ count: c, last, mn, mn1, sdx });
    return {
      count: c, xbar: last?.mean ?? null, vn: last?.vn ?? null, vn1: last?.vn1 ?? null, sdx, sdth: th.sdX,
      mn, mn1, mnth: th.meanN, s2: sigma * sigma, bias: mn == null ? null : mn - sigma * sigma,
    };
  }, onResults, 120, playing);

  const canvas = useCanvasLoop((f) => step(sim.current!, live.current, f), playing);
  const race = beat === 'race';
  const X = (x: number) => 0.04 + ((x - MU + SPAN * sigma) / (2 * SPAN * sigma)) * 0.92;
  const V = (v: number) => 0.04 + clamp01(v / vMax) * 0.92;
  const last = shown.last;
  return (
    <div
      className="figure figure--est"
      data-beat={beat}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        if (y < 0.22) return onHot('xbar');
        if (race) return onHot(Math.abs(x - V(sigma * sigma)) < 0.02 ? 's2' : y < 0.62 ? 'mn' : 'mn1');
        onHot(y > 0.7 ? 'n' : Math.abs(x - X(MU)) < 0.015 ? 'a' : 'sdx');
      }}
      onMouseLeave={() => onHot(null)}
    >
      <canvas ref={canvas} className="figure-canvas" role="img"
        aria-label={race
          ? t(`Variance race, n = ${n}: ${shown.count} samples; mean with divisor n ${fmt(shown.mn)}, with divisor n − 1 ${fmt(shown.mn1)}, true variance ${fmt(sigma * sigma)}.`,
            `Гонка дисперсий, n = ${n}: ${shown.count} выборок; среднее с делителем n ${dec(fmt(shown.mn))}, с делителем n − 1 ${dec(fmt(shown.mn1))}, истинная дисперсия ${dec(fmt(sigma * sigma))}.`)
          : t(`Cloud of sample means, n = ${n}: ${shown.count} samples, spread ${fmt(shown.sdx)} against sigma/sqrt(n) = ${fmt(th.sdX)}.`,
            `Облако выборочных средних, n = ${n}: ${shown.count} выборок, разброс ${dec(fmt(shown.sdx))} против σ/√n = ${dec(fmt(th.sdX))}.`)} />
      <Label x={0.03} y={0.02}>{law ? t(`one sample of $n = ${n}$ from a skewed law`, `одна выборка объёма $n = ${n}$ из асимметричного закона`) : t(`one sample of $n = ${n}$ from $N(a,\\,\\sigma^2)$`, `одна выборка объёма $n = ${n}$ из $N(a,\\,\\sigma^2)$`)}</Label>
      <Label x={0.97} y={0.02} align="end" className="figure-count">{t(`${int(shown.count)} samples`, `выборок: ${int(shown.count)}`)}</Label>
      {!race && (
        <>
          <Label x={X(MU)} y={0.215} align="middle" hot={hot === 'a'} className="figure-mark">{'$a$'}</Label>
          {last && <Label x={X(Math.max(-SPAN * sigma, Math.min(SPAN * sigma, last.mean)))} y={0.11} align="middle" hot={hot === 'xbar'} className="figure-chip">{`$\\bar{x} = ${texDec(last.mean.toFixed(2))}$`}</Label>}
          <Label x={X(MU + th.sdX) + 0.01} y={0.625} hot={hot === 'sdth'} className="est-mint">{`$\\pm\\dfrac{\\sigma}{\\sqrt{n}} = \\pm${texDec(th.sdX.toFixed(3))}$`}</Label>
          <Label x={0.03} y={0.31} hot={hot === 'sdx'}>{t(`cloud of $\\bar{x}$: spread $${texDec(fmt(shown.sdx))}$`, `облако $\\bar{x}$: разброс $${texDec(fmt(shown.sdx))}$`)}</Label>
          {LADDER.map((m, i) => (
            <Label key={m} x={0.005} y={0.725 + i * 0.05} hot={m === n || hot === 'n'} dim={m !== n} className="est-rung">{`$n = ${m}$`}</Label>
          ))}
        </>
      )}
      {race && (
        <>
          <Label x={V(sigma * sigma)} y={0.315} align="middle" hot={hot === 's2'} className="figure-mark">{'$\\sigma^2$'}</Label>
          <Label x={0.97} y={0.36} align="end" hot={hot === 'mn' || hot === 'vn'} className="est-coral">{t('divisor $n$: $s_n^2 = \\dfrac{1}{n}\\sum (x_i - \\bar{x})^2$', 'делитель $n$: $s_n^2 = \\dfrac{1}{n}\\sum (x_i - \\bar{x})^2$')}</Label>
          <Label x={0.97} y={0.8} align="end" hot={hot === 'mn1' || hot === 'vn1'} className="est-cyan">{t('divisor $n - 1$: $s^2 = \\dfrac{1}{n-1}\\sum (x_i - \\bar{x})^2$', 'делитель $n - 1$: $s^2 = \\dfrac{1}{n-1}\\sum (x_i - \\bar{x})^2$')}</Label>
          {shown.mn != null && (
            <Label x={V(shown.mn)} y={0.385} align="end" hot={hot === 'mn'} className="figure-chip est-coral" style={{ marginLeft: -8 }}>{`$\\overline{s_n^2} = ${texDec(fmt(shown.mn))}$`}</Label>
          )}
          {shown.mn1 != null && (
            <Label x={V(shown.mn1)} y={0.79} hot={hot === 'mn1'} className="figure-chip est-cyan" style={{ marginLeft: 8 }}>{`$\\overline{s^2} = ${texDec(fmt(shown.mn1))}$`}</Label>
          )}
          {last && (
            <Label x={0.97} y={0.11} align="end" className="figure-chip">{`$s_n^2 = ${texDec(last.vn.toFixed(2))},\\;\\; s^2 = ${texDec(last.vn1.toFixed(2))}$`}</Label>
          )}
        </>
      )}
    </div>
  );
}

const fmt = (v: number | null) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(3));

function commit(s: Sim, o: Live, e: Estimates) {
  s.made.push(e);
  s.sm += e.mean; s.sm2 += e.mean * e.mean; s.svn += e.vn; s.svn1 += e.vn1;
  const span = SPAN * o.opts.sigma;
  const k = Math.floor(((e.mean - MU + span) / (2 * span)) * CLOUD_BINS);
  if (k >= 0 && k < CLOUD_BINS) s.cloud[k]++;
  const vb = (v: number) => Math.min(VAR_BINS - 1, Math.floor((v / o.vMax) * VAR_BINS));
  s.binsN[vb(e.vn)]++;
  s.binsN1[vb(e.vn1)]++;
}
const next = (s: Sim, o: Live) => estimatesAt({ ...o.opts, r: s.made.length + (s.flying ? 1 : 0) });

function step(s: Sim, o: Live, { ctx, w, h, dt }: Frame) {
  s.clock += dt;
  if (o.reduced) {
    while (s.made.length < R) commit(s, o, next(s, o));
  } else if (s.made.length < SLOW) {
    // the first samples go one by one, slowly enough to follow
    if (!s.flying) s.flying = { e: next(s, o), born: s.clock };
  } else {
    if (s.fastSince == null) s.fastSince = s.clock;
    const rate = Math.min(160, 2 * 1.9 ** ((s.clock - s.fastSince) * 1.4));
    s.acc += rate * dt;
    while (s.acc >= 1 && s.made.length < R) {
      s.acc -= 1;
      commit(s, o, next(s, o));
    }
  }
  const sigma = o.opts.sigma, span = SPAN * sigma;
  const X = (x: number) => w * 0.04 + ((x - MU + span) / (2 * span)) * w * 0.92;
  const stripY = h * 0.19;
  ctx.save();
  axis(ctx, X(-span), X(span), stripY);
  for (let k = -3; k <= 3; k++) tick(ctx, num(MU + k * sigma), X(MU + k * sigma), stripY + 13);

  // the sample being drawn: dots fall onto the axis and collapse into their mean
  if (s.flying) {
    const f = s.flying, age = s.clock - f.born, e = f.e, k = e.sample.length;
    const meanK = easeInOut((age - CYCLE.fall) / (CYCLE.mean - CYCLE.fall));
    const dropK = easeInOut((age - CYCLE.mean) / (CYCLE.drop - CYCLE.mean));
    const race = o.beat === 'race';
    for (let i = 0; i < k; i++) {
      const fall = ease((age - (i * 0.6) / k) / 0.4);
      if (fall <= 0) continue;
      const x = lerp(X(clampTo(e.sample[i], span)), X(clampTo(e.mean, span)), race ? 0 : meanK);
      ctx.fillStyle = rgba(PALETTE.violet, (race ? 1 - dropK : 1 - meanK * 0.8) * (1 - dropK * 0.5));
      dot(ctx, x, lerp(h * 0.045, stripY - 4, fall), 3.2);
      if (race && meanK > 0) {
        // the squared deviations from x̄: the thing both formulas add up
        ctx.strokeStyle = rgba(PALETTE.violet, 0.35 * meanK * (1 - dropK));
        ctx.beginPath();
        ctx.moveTo(X(clampTo(e.mean, span)), stripY - 4);
        ctx.lineTo(x, stripY - 4);
        ctx.stroke();
      }
    }
    if (meanK > 0 && dropK < 1) {
      ctx.fillStyle = PALETTE.violet;
      ctx.shadowColor = rgba(PALETTE.violet, 0.9);
      ctx.shadowBlur = o.hot === 'xbar' ? 16 : 8;
      dot(ctx, X(clampTo(e.mean, span)), lerp(stripY - 4, race ? stripY - 4 : h * 0.58, race ? 0 : dropK), 5);
      ctx.shadowBlur = 0;
    }
    if (age >= CYCLE.drop) {
      commit(s, o, e);
      s.flying = null;
    }
  }

  if (o.beat === 'race') drawRace(s, o, ctx, w, h, dt);
  else drawCloud(s, o, ctx, w, h, X);
  ctx.restore();
}

function drawCloud(s: Sim, o: Live, ctx: CanvasRenderingContext2D, w: number, h: number, X: (x: number) => number) {
  const { n, sigma } = o.opts, span = SPAN * sigma, sd = sigma / Math.sqrt(n);
  const base = h * 0.6, top = h * 0.3;
  const binW = (2 * span) / CLOUD_BINS, px = (X(span) - X(-span)) / CLOUD_BINS;
  // the tallest stack a full cloud reaches, so the scale never jumps while it fills
  const peak = (R * binW) / (sd * Math.sqrt(2 * Math.PI));
  const unit = Math.min(4, (base - top) / (peak * 1.12));
  // the true mean through the strip and the cloud
  const hotA = o.hot === 'a';
  ctx.strokeStyle = rgba(PALETTE.coral, hotA ? 1 : 0.65);
  ctx.lineWidth = hotA ? 2 : 1.2;
  ctx.beginPath();
  ctx.moveTo(X(MU), h * 0.06);
  ctx.lineTo(X(MU), base + 6);
  ctx.stroke();
  // the cloud: one tiny brick per sample mean, stacked in its bin
  const hotC = o.hot === 'sdx' || o.hot === 'xbar' || o.hot === 'n';
  ctx.fillStyle = rgba(PALETTE.violet, hotC ? 0.95 : 0.78);
  for (let k = 0; k < CLOUD_BINS; k++) {
    const c = s.cloud[k];
    if (!c) continue;
    const x0 = X(-span) + k * px;
    ctx.fillRect(x0 + 0.5, base - c * unit, Math.max(1, px - 1), c * unit);
  }
  // where the cloud is heading: the curve N(a, σ²/n) at the full R, and the bracket ±σ/√n
  const hotT = o.hot === 'sdth';
  ctx.strokeStyle = rgba(PALETTE.mint, hotT ? 1 : 0.7);
  ctx.lineWidth = hotT ? 2 : 1.3;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (let i = 0; i <= 240; i++) {
    const x = -span + (2 * span * i) / 240, z = (x - MU) / sd;
    const y = base - (R * binW * Math.exp(-0.5 * z * z)) / (sd * Math.sqrt(2 * Math.PI)) * unit;
    i ? ctx.lineTo(X(x), y) : ctx.moveTo(X(x), y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  axis(ctx, X(-span), X(span), base + 0.5);
  const by = base + 12;
  ctx.strokeStyle = rgba(PALETTE.mint, hotT ? 1 : 0.85);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(X(MU - sd), by - 4); ctx.lineTo(X(MU - sd), by); ctx.lineTo(X(MU + sd), by); ctx.lineTo(X(MU + sd), by - 4);
  ctx.stroke();

  // the ladder: the same experiment at n = 2, 5, 10, 20, 50; the cloud tightens like σ/√n
  const rowH = h * 0.05, y0 = h * 0.725;
  for (let i = 0; i < LADDER.length; i++) {
    const m = LADDER[i], cur = m === n, y = y0 + i * rowH + rowH * 0.5, sdm = sigma / Math.sqrt(m);
    ctx.fillStyle = cur ? 'rgba(232,228,133,0.06)' : 'rgba(255,255,255,0.015)';
    ctx.fillRect(X(-span), y - rowH * 0.42, X(span) - X(-span), rowH * 0.84);
    ctx.strokeStyle = rgba(PALETTE.mint, cur ? 0.9 : 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X(MU - sdm), y - rowH * 0.36); ctx.lineTo(X(MU - sdm), y + rowH * 0.36);
    ctx.moveTo(X(MU + sdm), y - rowH * 0.36); ctx.lineTo(X(MU + sdm), y + rowH * 0.36);
    ctx.stroke();
    // a ladder row shows as many sample means as the cloud has, up to its size
    const shown = Math.min(o.ladder[i].length, Math.max(cur ? 0 : 24, s.made.length));
    ctx.fillStyle = cur ? rgba(PALETTE.signal, 0.85) : rgba(PALETTE.violet, 0.5);
    for (let r = 0; r < shown; r++) {
      const jit = ((r * 0.6180339887) % 1) - 0.5;
      ctx.fillRect(X(clampTo(o.ladder[i][r], span)) - 1, y + jit * rowH * 0.6 - 1, 2, 2);
    }
  }
  ctx.strokeStyle = rgba(PALETTE.coral, 0.4);
  ctx.beginPath();
  ctx.moveTo(X(MU), y0);
  ctx.lineTo(X(MU), y0 + LADDER.length * rowH);
  ctx.stroke();
}

function drawRace(s: Sim, o: Live, ctx: CanvasRenderingContext2D, w: number, h: number, dt: number) {
  const { n, sigma } = o.opts, s2 = sigma * sigma, vMax = o.vMax;
  const V = (v: number) => w * 0.04 + clamp01(v / vMax) * w * 0.92;
  const mid = h * 0.6, upTop = h * 0.33, downBot = h * 0.9;
  const px = (V(vMax) - V(0)) / VAR_BINS;
  let peak = 1;
  for (let k = 0; k < VAR_BINS; k++) peak = Math.max(peak, s.binsN[k], s.binsN1[k]);
  // ease the scale so the bars never jump
  const target = Math.min(mid - upTop, downBot - mid - 8) / Math.max(peak * 1.1, 12);
  s.vScale = s.vScale ? lerp(s.vScale, target, clamp01(dt * 4)) : target;
  const hotN = o.hot === 'mn' || o.hot === 'vn', hotN1 = o.hot === 'mn1' || o.hot === 'vn1';
  for (let k = 0; k < VAR_BINS; k++) {
    const x0 = V(0) + k * px;
    const a = s.binsN[k] * s.vScale, b = s.binsN1[k] * s.vScale;
    ctx.fillStyle = rgba(PALETTE.coral, hotN ? 0.95 : 0.72);
    ctx.fillRect(x0 + 0.5, mid - 3 - a, Math.max(1, px - 1), a);
    ctx.fillStyle = rgba(PALETTE.cyan, hotN1 ? 0.95 : 0.72);
    ctx.fillRect(x0 + 0.5, mid + 3, Math.max(1, px - 1), b);
  }
  axis(ctx, V(0), V(vMax), mid + 0.5);
  const stepV = vMax > 6 ? 2 : vMax > 3 ? 1 : 0.5;
  // the value axis sits under both histograms, where no bar covers it
  axis(ctx, V(0), V(vMax), downBot + 4.5);
  for (let v = 0; v <= vMax + 1e-9; v += stepV) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(V(v) - 0.5, downBot + 2, 1, 5);
    tick(ctx, num(v), V(v), downBot + 18);
  }
  // the target σ² through both histograms
  const hotS = o.hot === 's2';
  ctx.strokeStyle = rgba(PALETTE.signal, hotS ? 1 : 0.8);
  ctx.lineWidth = hotS ? 2.2 : 1.4;
  ctx.shadowColor = rgba(PALETTE.signal, 0.7);
  ctx.shadowBlur = hotS ? 12 : 4;
  ctx.beginPath();
  ctx.moveTo(V(s2), h * 0.32);
  ctx.lineTo(V(s2), downBot);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // theory for divisor n: (n − 1)σ²/n
  ctx.strokeStyle = rgba(PALETTE.coral, 0.55);
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(V(((n - 1) / n) * s2), upTop);
  ctx.lineTo(V(((n - 1) / n) * s2), mid - 3);
  ctx.stroke();
  ctx.setLineDash([]);
  const c = s.made.length;
  if (c) {
    const mn = s.svn / c, mn1 = s.svn1 / c;
    marker(ctx, V(mn), mid - 3, upTop + 18, PALETTE.coral, hotN, -1);
    marker(ctx, V(mn1), mid + 3, downBot - 22, PALETTE.cyan, hotN1, 1);
    // the bias: the gap between the divisor-n mean and σ²
    if (Math.abs(V(s2) - V(mn)) > 6) {
      const y = upTop + 6;
      ctx.strokeStyle = rgba(PALETTE.coral, 0.9);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(V(mn), y); ctx.lineTo(V(s2), y);
      ctx.moveTo(V(mn), y - 3); ctx.lineTo(V(mn), y + 3);
      ctx.moveTo(V(s2), y - 3); ctx.lineTo(V(s2), y + 3);
      ctx.stroke();
    }
  }
}

function marker(ctx: CanvasRenderingContext2D, x: number, from: number, to: number, color: string, hot: boolean, dir: 1 | -1) {
  ctx.strokeStyle = rgba(color, hot ? 1 : 0.9);
  ctx.lineWidth = hot ? 2 : 1.4;
  ctx.beginPath();
  ctx.moveTo(x, from);
  ctx.lineTo(x, to);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, to);
  ctx.lineTo(x - 5, to + dir * 8);
  ctx.lineTo(x + 5, to + dir * 8);
  ctx.closePath();
  ctx.fill();
}
function axis(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function tick(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(200,200,196,0.7)';
  ctx.fillText(text, x, y);
}
const clampTo = (v: number, span: number) => Math.max(-span, Math.min(span, v));
/** An axis number: minus sign, and the decimal comma in Russian. */
const num = (v: number) => dec(String(Math.round(v * 100) / 100)).replace('-', '−');
