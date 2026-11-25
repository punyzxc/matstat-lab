import { useRef, useState } from 'react';
import { MathText } from '../../math';
import { PALETTE } from './specs.mjs';
import { dec, int, t, texDec } from '../../i18n-core';
import { intervalAt, type Interval } from './ci-model.mjs';
import { clamp01, ease, easeInOut, Label, lerp, rgba, useCanvasLoop, useThrottledReport, type FigureProps, type Frame } from './kit';

/**
 * The confidence interval wall (#112, L11). One sample falls onto the axis, collapses into its mean x̄, opens into
 * the interval x̄ ± t·s/√n and lifts into the wall; then the wall fills with hundreds of intervals, and the share that
 * covers the true mean a settles near γ. Intervals come from the estimation kernel with the Confidence station's
 * streams, so 1000 intervals here hit exactly as often as the station's coverage run (same seed, n, γ).
 * Beats: sample, interval, wall.
 */
const R = 1000;
const MU = 0, SIGMA = 1, D0 = -3.2, D1 = 3.2;
const CYCLE = { fall: 1.0, mean: 1.6, open: 2.3, lift: 3.0 };

type Flying = { iv: Interval; born: number };
type Sim = {
  key: string;
  clock: number;
  made: Interval[];
  hits: number;
  width: number;
  flying: Flying | null;
  acc: number;
  fastSince: number | null;
  beat: string;
  scroll: number;
};

export function CiWall({ beat, params, seed, hot, onHot, playing, reduced, runKey, onResults }: FigureProps) {
  const n = Math.round(params.n), gamma = params.gamma, law = Math.round(params.law), method = Math.round(params.method);
  const key = `${n}|${gamma}|${law}|${method}|${seed}|${runKey}`;
  const sim = useRef<Sim | null>(null);
  if (!sim.current || sim.current.key !== key) sim.current = { key, clock: 0, made: [], hits: 0, width: 0, flying: null, acc: 0, fastSince: null, beat, scroll: 0 };
  const opts = { n, gamma, law, method, mu: MU, sigma: SIGMA, seed };
  const live = useRef({ beat, hot, reduced, opts });
  live.current = { beat, hot, reduced, opts };
  const [shown, setShown] = useState({ count: 0, hits: 0, last: null as Interval | null });

  useThrottledReport(() => {
    const s = sim.current!, last = s.flying?.iv ?? s.made.at(-1) ?? null;
    setShown({ count: s.made.length, hits: s.hits, last });
    const sd = last ? Math.sqrt(last.sample.reduce((q, v) => q + (v - last.estimate) ** 2, 0) / (n - 1)) : null;
    return {
      cover: s.made.length ? s.hits / s.made.length : null, hits: s.hits, count: s.made.length,
      width: s.made.length ? s.width / s.made.length : null, xbar: last?.estimate ?? null, s: sd, t: last?.critical ?? null,
    };
  }, onResults, 120);

  const canvas = useCanvasLoop((f) => step(sim.current!, live.current, f), playing);
  const cover = shown.count ? shown.hits / shown.count : null;
  const frac = (x: number) => 0.05 + ((x - D0) / (D1 - D0)) * 0.66;
  const last = shown.last;
  return (
    <div
      className="figure figure--ci"
      data-beat={beat}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        onHot(x > 0.74 ? 'cover' : y < 0.3 ? (beat === 'sample' ? 'xbar' : 't') : Math.abs(x - frac(MU)) < 0.015 ? 'a' : 'gamma');
      }}
      onMouseLeave={() => onHot(null)}
    >
      <canvas ref={canvas} className="figure-canvas" role="img"
        aria-label={t(`Confidence interval wall: n = ${n}, gamma = ${gamma}; ${shown.hits} of ${shown.count} intervals cover the true mean.`, `Стена доверительных интервалов: n = ${n}, γ = ${dec(String(gamma))}; ${shown.hits} из ${shown.count} интервалов накрывают истинное среднее.`)} />
      <Label x={0.03} y={0.025}>{law ? t(`one sample of $n = ${n}$ from a skewed law`, `одна выборка объёма $n = ${n}$ из асимметричного закона`) : t(`one sample of $n = ${n}$ from $N(a,\\,\\sigma^2)$`, `одна выборка объёма $n = ${n}$ из $N(a,\\,\\sigma^2)$`)}</Label>
      <Label x={frac(MU)} y={0.055} align="middle" hot={hot === 'a'} className="figure-mark">{'$a$'}</Label>
      {last && beat !== 'wall' && (
        <Label x={frac(Math.min(D1, Math.max(D0, last.estimate)))} y={0.205} align="middle" hot={hot === 'xbar'} className="figure-chip">{`$\\bar{x} = ${texDec(last.estimate.toFixed(2))}$`}</Label>
      )}
      <Label x={0.03} y={0.33} dim={beat === 'sample'}>{t(`every new sample adds one interval $\\bar{x} \\pm ${method ? 'z' : 't'}_{\\gamma}\\dfrac{s}{\\sqrt{n}}$`, `каждая новая выборка добавляет интервал $\\bar{x} \\pm ${method ? 'z' : 't'}_{\\gamma}\\dfrac{s}{\\sqrt{n}}$`)}</Label>
      <div className={`ci-gauge${hot === 'cover' || hot === 'gamma' ? ' is-hot' : ''}`} aria-live="off">
        <span className="ci-gauge-label">{t('covered', 'накрыли')}</span>
        <b data-testid="ci-coverage">{cover == null ? '—' : dec((cover * 100).toFixed(1)) + '%'}</b>
        <span className="ci-gauge-count">{int(shown.hits)} {t('of', 'из')} {int(shown.count)}</span>
        <div className="ci-gauge-bar">
          <i style={{ height: `${(cover ?? 0) * 100}%` }} />
          <em style={{ bottom: `${gamma * 100}%` }}><span className="ci-gauge-gamma"><MathText text={`$\\gamma = ${texDec(String(gamma))}$`} /></span></em>
        </div>
      </div>
    </div>
  );
}

type Live = { beat: string; hot: string | null; reduced: boolean; opts: { n: number; gamma: number; law: number; method: number; mu: number; sigma: number; seed: number } };

function make(s: Sim, o: Live) {
  const iv = intervalAt({ ...o.opts, r: s.made.length + (s.flying ? 1 : 0) });
  return iv;
}
function commit(s: Sim, iv: Interval) {
  s.made.push(iv);
  s.hits += iv.hit ? 1 : 0;
  s.width += iv.upper - iv.lower;
  s.scroll += 1;
}

function step(s: Sim, o: Live, { ctx, w, h, dt }: Frame) {
  if (s.beat !== o.beat) {
    s.beat = o.beat;
    if (o.beat !== 'wall') s.fastSince = null;
  }
  s.clock += dt;
  const slow = o.beat !== 'wall';
  if (o.reduced) {
    if (!slow) while (s.made.length < R) commit(s, intervalAt({ ...o.opts, r: s.made.length }));
    else if (!s.flying && s.made.length < R) s.flying = { iv: make(s, o), born: -CYCLE.open + 0.001 };
  } else if (slow) {
    if (!s.flying && s.made.length < R) s.flying = { iv: make(s, o), born: s.clock };
  } else {
    if (s.flying) {
      commit(s, s.flying.iv);
      s.flying = null;
    }
    if (s.fastSince == null) s.fastSince = s.clock;
    const rate = Math.min(90, 2 * 1.8 ** ((s.clock - s.fastSince) * 1.4));
    s.acc += rate * dt;
    while (s.acc >= 1 && s.made.length < R) {
      s.acc -= 1;
      commit(s, intervalAt({ ...o.opts, r: s.made.length }));
    }
  }
  s.scroll = Math.max(0, s.scroll - dt * (slow ? 3 : 14) * Math.max(1, s.scroll));

  const X = (x: number) => w * 0.05 + ((x - D0) / (D1 - D0)) * w * 0.66;
  const stripY = h * 0.15, wallTop = h * 0.4, wallBot = h * 0.97;
  const rowStep = Math.max(3, Math.min(9, (wallBot - wallTop) / 70));
  ctx.save();
  // axis of the sample strip, and the true mean through everything
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(X(D0), stripY + 0.5);
  ctx.lineTo(X(D1), stripY + 0.5);
  ctx.stroke();
  for (let x = -3; x <= 3; x++) tick(ctx, x < 0 ? `−${-x}` : `${x}`, X(x), stripY + 14);
  const hotA = o.hot === 'a';
  ctx.strokeStyle = rgba(PALETTE.coral, hotA ? 1 : 0.7);
  ctx.lineWidth = hotA ? 2 : 1.2;
  ctx.shadowColor = rgba(PALETTE.coral, 0.7);
  ctx.shadowBlur = hotA ? 12 : 4;
  ctx.beginPath();
  ctx.moveTo(X(MU), h * 0.06);
  ctx.lineTo(X(MU), wallBot);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // the wall: newest on top
  const visible = Math.ceil((wallBot - wallTop) / rowStep) + 1;
  const from = Math.max(0, s.made.length - visible);
  const hotW = o.hot === 'width' || o.hot === 'gamma' || o.hot === 'n';
  for (let i = s.made.length - 1; i >= from; i--) {
    const iv = s.made[i];
    const row = s.made.length - 1 - i;
    const y = wallTop + (row - s.scroll + 1) * rowStep;
    if (y < wallTop - rowStep) continue;
    const fade = clamp01((wallBot - y) / (rowStep * 6));
    const x0 = X(Math.max(D0, iv.lower)), x1 = X(Math.min(D1, iv.upper));
    ctx.fillStyle = iv.hit ? `rgba(226,226,222,${(hotW ? 0.75 : 0.5) * fade})` : rgba(PALETTE.coral, 0.95 * fade);
    const th = Math.max(1.5, rowStep * 0.55);
    ctx.fillRect(x0, y - th / 2, Math.max(1, x1 - x0), th);
    if (!iv.hit) {
      ctx.fillStyle = rgba(PALETTE.coral, fade);
      ctx.beginPath();
      ctx.arc(X(Math.min(D1, Math.max(D0, iv.estimate))), y, th * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // the interval being built from one sample
  if (s.flying) {
    const f = s.flying, age = s.clock - f.born, iv = f.iv;
    const hotX = o.hot === 'xbar', hotT = o.hot === 't' || o.hot === 's';
    const meanK = easeInOut((age - CYCLE.fall) / (CYCLE.mean - CYCLE.fall));
    const openK = easeInOut((age - CYCLE.mean) / (CYCLE.open - CYCLE.mean));
    const liftK = easeInOut((age - CYCLE.open) / (CYCLE.lift - CYCLE.open));
    const k = iv.sample.length;
    if (liftK < 1) {
      for (let i = 0; i < k; i++) {
        const fall = ease((age - (i * 0.6) / k) / 0.4);
        if (fall <= 0) continue;
        const x = lerp(X(Math.min(D1, Math.max(D0, iv.sample[i]))), X(iv.estimate), meanK);
        const y = lerp(h * 0.05, stripY - 4, fall);
        ctx.fillStyle = rgba(PALETTE.violet, (1 - meanK * 0.8) * (1 - liftK));
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (meanK > 0) {
      const y = lerp(stripY - 4, wallTop, liftK);
      const lo = X(Math.max(D0, lerp(iv.estimate, iv.lower, openK))), hi = X(Math.min(D1, lerp(iv.estimate, iv.upper, openK)));
      ctx.strokeStyle = iv.hit || openK < 1 ? (hotT ? PALETTE.cyan : 'rgba(244,244,242,0.9)') : PALETTE.coral;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lo, y);
      ctx.lineTo(hi, y);
      ctx.moveTo(lo, y - 6);
      ctx.lineTo(lo, y + 6);
      ctx.moveTo(hi, y - 6);
      ctx.lineTo(hi, y + 6);
      ctx.stroke();
      ctx.fillStyle = PALETTE.violet;
      ctx.shadowColor = rgba(PALETTE.violet, 0.9);
      ctx.shadowBlur = hotX ? 16 : 8;
      ctx.beginPath();
      ctx.arc(X(Math.min(D1, Math.max(D0, iv.estimate))), y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    if (!o.reduced && age >= CYCLE.lift) {
      commit(s, iv);
      s.flying = null;
    }
  }
  ctx.restore();
}

function tick(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(200,200,196,0.7)';
  ctx.fillText(text, x, y);
}
