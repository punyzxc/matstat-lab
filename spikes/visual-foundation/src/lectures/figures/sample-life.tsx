import { useMemo, useRef, useState } from 'react';
import { PALETTE } from './specs.mjs';
import { dec, int, t, texDec } from '../../i18n-core';
import { axisOf, describe, gapAt, LAWS, population, POPULATION, type Described } from './sample-model.mjs';
import { clamp01, ease, Label, lerp, rgba, useCanvasLoop, useThrottledReport, type FigureProps, type Frame } from './kit';

/**
 * The living population (#125, L10). Five thousand members of a law fill its density; n of them fly out into the
 * study strip and become, beat by beat, the variation series, the interval frequency table, the histogram and
 * the empirical distribution function. Every observation is one dot that travels between the portraits, so the
 * reader can follow it; in the "linked" beat the four portraits stand side by side and a hovered observation
 * lights up in all of them. The sample is the Sample station's own (same seed, law and n).
 * Beat "gap" adds the largest distance D_n between F_n and the true F (the Kolmogorov statistic).
 */
type Rect = { x0: number; y0: number; x1: number; y1: number };
type Opts = { law: number; n: number; bins: number; seed: number };
type Sim = {
  key: string; clock: number; launched: number | null; beat: string; beatSince: number;
  cur: Float32Array; ready: boolean; drawn: Float32Array; drawnCount: number; landed: number;
};
type Live = {
  beat: string; hot: string | null; reduced: boolean; opts: Opts; d: Described; pop: { x: number[]; lift: number[] };
  axis: [number, number]; hover: number | null;
};

const FULL: Rect = { x0: 0.06, y0: 0.1, x1: 0.95, y1: 0.86 };
const QUAD: Record<string, Rect> = {
  draw: { x0: 0.06, y0: 0.1, x1: 0.47, y1: 0.42 },
  sort: { x0: 0.57, y0: 0.1, x1: 0.96, y1: 0.42 },
  hist: { x0: 0.06, y0: 0.6, x1: 0.47, y1: 0.9 },
  ecdf: { x0: 0.57, y0: 0.6, x1: 0.96, y1: 0.9 },
};
/** The ECDF stays clear of the scientist cards in the top right corner. */
const CURVE: Rect = { x0: 0.06, y0: 0.3, x1: 0.95, y1: 0.86 };
const FLIGHT = 0.85;
const LAUNCH = 0.35;

export function SampleLife({ beat, params, seed, hot, onHot, playing, reduced, runKey, onResults }: FigureProps) {
  const law = Math.round(params.law), n = Math.round(params.n), bins = Math.round(params.bins);
  const opts: Opts = { law, n, bins, seed };
  const d = useMemo(() => describe({ law, n, bins, seed }), [law, n, bins, seed]);
  const pop = useMemo(() => population({ law, seed }), [law, seed]);
  const axis = axisOf(law, d);
  const [hover, setHover] = useState<number | null>(null);
  const key = `${law}|${n}|${seed}|${runKey}`;
  const sim = useRef<Sim | null>(null);
  if (!sim.current || sim.current.key !== key) {
    sim.current = {
      key, clock: 0, launched: null, beat, beatSince: 0, cur: new Float32Array(2 * n), ready: false,
      drawn: new Float32Array(3 * 4 * n), drawnCount: 0, landed: 0,
    };
  }
  const live = useRef<Live>({ beat, hot, reduced, opts, d, pop, axis, hover });
  live.current = { beat, hot, reduced, opts, d, pop, axis, hover };

  useThrottledReport(() => {
    const s = sim.current!;
    return {
      n: d.n, N: POPULATION, k: d.k, h: d.table.h, sum: d.sum, xbar: d.mean, s2: d.s2, a: d.a, sigma2: d.variance,
      xmin: d.min, xmax: d.max, range: d.max - d.min, med: d.median, area: d.table.area, dn: d.dn, lambda: d.lambda, crit: d.critical,
      landed: s.landed,
    };
  }, onResults, 120, playing);

  const canvas = useCanvasLoop((f) => step(sim.current!, live.current, f), playing);
  const linked = beat === 'linked';
  const VX = (v: number) => FULL.x0 + ((v - axis[0]) / (axis[1] - axis[0])) * (FULL.x1 - FULL.x0);
  const SX = (r: number) => FULL.x0 + ((r + 0.5) / d.n) * (FULL.x1 - FULL.x0);
  const SY = (v: number) => FULL.y1 - ((v - axis[0]) / (axis[1] - axis[0])) * (FULL.y1 - FULL.y0);
  const R = (b: string): Rect => (linked ? QUAD[b] : FULL);
  const lawText = t(LAWS[law].id === 'normal' ? 'normal law' : LAWS[law].id === 'uniform' ? 'uniform law' : 'exponential law',
    LAWS[law].id === 'normal' ? 'нормальный закон' : LAWS[law].id === 'uniform' ? 'равномерный закон' : 'показательный закон');
  const obs = hover != null && hover < d.n ? hover : null;
  const card = obs == null ? null : obsCard(d, obs);

  return (
    <div
      className={`figure figure--sample${linked ? ' is-linked' : ''}`}
      data-beat={beat}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
        const s = sim.current!;
        let best = -1, bestD = 14 * 14;
        for (let j = 0; j < s.drawnCount; j++) {
          const dx = s.drawn[3 * j] - mx, dy = s.drawn[3 * j + 1] - my, dd = dx * dx + dy * dy;
          if (dd < bestD) { bestD = dd; best = s.drawn[3 * j + 2]; }
        }
        setHover(best >= 0 ? best : null);
        onHot(best >= 0 ? 'obs' : null);
      }}
      onMouseLeave={() => { setHover(null); onHot(null); }}
    >
      <canvas ref={canvas} className="figure-canvas" role="img"
        aria-label={t(`A sample of n = ${n} from a population of ${POPULATION}, ${lawText}: ${d.k} intervals, mean ${d.mean.toFixed(3)}.`,
          `Выборка объёма n = ${n} из генеральной совокупности ${POPULATION}, ${lawText}: ${d.k} интервалов, среднее ${dec(d.mean.toFixed(3))}.`)} />
      {(beat === 'draw' || linked) && (
        <>
          <Label x={R('draw').x0} y={R('draw').y0 - 0.06} hot={hot === 'N' || (linked && hot === 'n')}>
            {linked ? t(`sample, $n = ${n}$, and the density $f(x)$`, `выборка, $n = ${n}$, и плотность $f(x)$`) : t(`population, $N = ${int(POPULATION)}$`, `генеральная совокупность, $N = ${int(POPULATION)}$`)}
          </Label>
          {!linked && <Label x={FULL.x0} y={0.6} hot={hot === 'n'} className="est-signal">{t(`sample, $n = ${n}$`, `выборка, $n = ${n}$`)}</Label>}
          {!linked && <Label x={VX(d.mean) + 0.006} y={0.62} hot={hot === 'xbar'} className="est-violet">{'$\\bar{x}$'}</Label>}
        </>
      )}
      {(beat === 'sort' || linked) && (
        <>
          <Label x={R('sort').x0} y={R('sort').y0 - 0.06} hot={hot === 'xmin' || hot === 'xmax'}>
            {t('variation series $x_{(1)} \\le x_{(2)} \\le \\dots \\le x_{(n)}$', 'вариационный ряд $x_{(1)} \\le x_{(2)} \\le \\dots \\le x_{(n)}$')}
          </Label>
          {!linked && beat === 'sort' && (
            <>
              <Label x={FULL.x1} y={FULL.y1 + 0.04} align="end">{t('rank $r$', 'номер $r$')}</Label>
              <Label x={SX(0) + 0.006} y={SY(d.min) + 0.02} hot={hot === 'xmin'} className="sample-order">{'$x_{(1)}$'}</Label>
              <Label x={SX(d.n - 1) - 0.008} y={SY(d.max) - 0.075} align="end" hot={hot === 'xmax'} className="sample-order">{'$x_{(n)}$'}</Label>
              <Label x={FULL.x0 + 0.01} y={SY(d.median) - 0.05} hot={hot === 'med'} className="est-violet">{t('median', 'медиана')}</Label>
            </>
          )}
        </>
      )}
      {beat === 'table' && (
        <>
          <Label x={0.035} y={0.095} hot={hot === 'sum' || hot === 'mr'}>{'$m_r$'}</Label>
          <Label x={0.035} y={0.165}>{'$W_r$'}</Label>
        </>
      )}
      {(beat === 'hist' || linked) && (
        <Label x={R('hist').x0} y={R('hist').y0 - 0.06} hot={hot === 'area' || hot === 'h'}>
          {linked ? t('histogram $H_r = W_r/h$', 'гистограмма $H_r = W_r/h$') : t(`histogram $H_r = W_r/h$ and the density $f(x)$, ${lawText}`, `гистограмма $H_r = W_r/h$ и плотность $f(x)$, ${lawText}`)}
        </Label>
      )}
      {(beat === 'ecdf' || beat === 'gap' || linked) && (
        <Label x={linked ? QUAD.ecdf.x0 : CURVE.x0} y={(linked ? QUAD.ecdf.y0 : CURVE.y0) - 0.08} hot={hot === 'Fn'}>
          {linked ? t('$F_n^*(x)$ and $F(x)$', '$F_n^*(x)$ и $F(x)$') : t(`$F_n^*(x)$, steps of $1/n$; dashed: the true $F(x)$`, `$F_n^*(x)$, ступени по $1/n$; пунктир: истинная $F(x)$`)}
        </Label>
      )}
      {beat === 'gap' && (
        <Label x={0.95} y={0.74} align="end" className="sample-gap" hot={hot === 'dn'}>
          {`$D_n = ${texDec(d.dn.toFixed(3))},\\quad \\lambda_n(${texDec('0.05')}) = ${texDec(d.critical.toFixed(3))}$`}
        </Label>
      )}
      {card && (
        <div className="sample-obs" data-testid="sample-obs">
          <Label x={linked ? 0.5 : 0.5} y={linked ? 0.455 : 0.935} align="middle" className="figure-chip">{card}</Label>
        </div>
      )}
      {linked && !card && <Label x={0.5} y={0.455} align="middle" className="sample-hint">{t('hover an observation: it lights up in all four portraits', 'наведите на наблюдение: оно загорится на всех четырёх портретах')}</Label>}
    </div>
  );
}

function obsCard(d: Described, i: number) {
  const r = d.rank[i], b = d.bin[i], e = d.table.edges;
  const close = b === d.k - 1 ? ']' : ')';
  return t(
    `$x_{${i + 1}} = ${texDec(d.x[i].toFixed(3))} = x_{(${r + 1})}$ · interval $[${texDec(e[b].toFixed(2))}, ${texDec(e[b + 1].toFixed(2))}${close}$, $m_{${b + 1}} = ${d.table.counts[b]}$ · $F_n^*(x_{${i + 1}}) = ${texDec(d.fnAt[i].toFixed(3))}$`,
    `$x_{${i + 1}} = ${texDec(d.x[i].toFixed(3))} = x_{(${r + 1})}$ · интервал $[${texDec(e[b].toFixed(2))}, ${texDec(e[b + 1].toFixed(2))}${close}$, $m_{${b + 1}} = ${d.table.counts[b]}$ · $F_n^*(x_{${i + 1}}) = ${texDec(d.fnAt[i].toFixed(3))}$`,
  );
}

// ---------------------------------------------------------------- layouts
type Ctx = CanvasRenderingContext2D;
type Geo = { w: number; h: number; o: Live; r: Rect; px: (f: number) => number; py: (f: number) => number; vx: (v: number) => number };
const geo = (o: Live, r: Rect, w: number, h: number, axis = o.axis): Geo => {
  const [lo, hi] = axis;
  const px = (f: number) => f * w, py = (f: number) => f * h;
  return { w, h, o, r, px, py, vx: (v: number) => px(r.x0) + ((v - lo) / (hi - lo)) * px(r.x1 - r.x0) };
};
const pdfMax = (law: number, [lo, hi]: [number, number]) => {
  let m = 0;
  for (let i = 0; i <= 200; i++) m = Math.max(m, LAWS[law].pdf(lo + ((hi - lo) * i) / 200));
  return m;
};
/** Population cloud: the base line of the density and its height. */
const cloudBase = (g: Geo, linked: boolean) => (linked ? g.py(g.r.y1) : g.py(0.5));
const cloudHeight = (g: Geo, linked: boolean) => (linked ? g.py(g.r.y1 - g.r.y0) * 0.8 : g.py(0.4));
const rugY = (g: Geo, i: number, linked: boolean) => {
  const j = g.o.pop.lift[i] - 0.5;
  return linked ? g.py(g.r.y1) - 6 - (j + 0.5) * 10 : g.py(0.73) + j * g.py(0.07);
};
const seriesPos = (g: Geo, i: number): [number, number] => {
  const { d, axis: [lo, hi] } = g.o;
  const x = g.px(g.r.x0) + ((d.rank[i] + 0.5) / d.n) * g.px(g.r.x1 - g.r.x0);
  const y = g.py(g.r.y1) - ((d.x[i] - lo) / (hi - lo)) * g.py(g.r.y1 - g.r.y0);
  return [x, y];
};
const ecdfPos = (g: Geo, i: number): [number, number] => [g.vx(g.o.d.x[i]), g.py(g.r.y1) - g.o.d.fnAt[i] * g.py(g.r.y1 - g.r.y0)];
/** Dot stacks for the table and the histogram: columns per bin and the spacing that fits the tallest bin. */
function stacks(g: Geo, room: number, tower = 0) {
  const { d } = g.o, bw = g.vx(d.table.edges[1]) - g.vx(d.table.edges[0]);
  let most = 1;
  for (const c of d.table.counts) most = Math.max(most, c);
  // towers: as few columns as the height allows, at a comfortable spacing
  if (tower > 0) {
    const cols = Math.max(1, Math.ceil((most * tower) / room));
    if (cols * tower <= bw * 0.86) return { u: tower, cols, bw };
  }
  let u = 12;
  for (; u > 1.6; u -= 0.25) {
    const cols = Math.max(1, Math.floor((bw * 0.86) / u));
    if (Math.ceil(most / cols) * u <= room) break;
  }
  const cols = Math.max(1, Math.floor((bw * 0.86) / u));
  return { u, cols, bw };
}
const tableFloor = (g: Geo) => g.py(0.84);
const tablePos = (g: Geo, i: number, st: ReturnType<typeof stacks>): [number, number] => {
  const { d } = g.o, b = d.bin[i], j = d.slot[i];
  const cx = (g.vx(d.table.edges[b]) + g.vx(d.table.edges[b + 1])) / 2;
  const col = j % st.cols, row = Math.floor(j / st.cols);
  return [cx + (col - (st.cols - 1) / 2) * st.u, tableFloor(g) - (row + 0.5) * st.u];
};
const histScale = (g: Geo, linked: boolean) => {
  const { d, opts, axis } = g.o;
  let top = pdfMax(opts.law, axis);
  for (const H of d.table.height) top = Math.max(top, H);
  return (linked ? g.py(g.r.y1 - g.r.y0) * 0.92 : g.py(0.62)) / top;
};
const histFloor = (g: Geo, linked: boolean) => (linked ? g.py(g.r.y1) : g.py(0.84));
const histPos = (g: Geo, i: number, st: ReturnType<typeof stacks>, linked: boolean): [number, number] => {
  const { d } = g.o, b = d.bin[i], j = d.slot[i], m = d.table.counts[b];
  const left = g.vx(d.table.edges[b]), bw = g.vx(d.table.edges[b + 1]) - left;
  const cols = Math.max(1, Math.min(st.cols, m)), rows = Math.ceil(m / cols);
  const barH = d.table.height[b] * histScale(g, linked);
  const col = j % cols, row = Math.floor(j / cols);
  return [left + ((col + 0.5) / cols) * bw, histFloor(g, linked) - ((row + 0.5) / rows) * barH];
};

// ---------------------------------------------------------------- the frame
function step(s: Sim, o: Live, f: Frame) {
  const { ctx, w, h, dt } = f;
  s.clock += dt;
  if (o.beat !== s.beat) {
    s.beat = o.beat;
    s.beatSince = s.clock;
  }
  const { d } = o, n = d.n, linked = o.beat === 'linked';
  const dot = n <= 60 ? 4.2 : n <= 200 ? 3 : n <= 500 ? 2.2 : 1.7;
  const age = s.clock - s.beatSince;
  const fade = o.reduced ? 1 : clamp01(age / 0.6);
  s.drawnCount = 0;
  const mark = (x: number, y: number, i: number) => {
    if (s.drawnCount < s.drawn.length / 3) {
      s.drawn[3 * s.drawnCount] = x;
      s.drawn[3 * s.drawnCount + 1] = y;
      s.drawn[3 * s.drawnCount + 2] = i;
      s.drawnCount++;
    }
  };

  // the flight from the population into the study strip happens once per sample
  if (o.beat === 'draw' && s.launched == null) s.launched = s.clock;
  const flightTime = (i: number) => LAUNCH + i * Math.min(0.07, 2.6 / n);
  const since = s.launched == null ? Infinity : o.reduced ? Infinity : s.clock - s.launched;
  let landed = 0;
  for (let i = 0; i < n; i++) if (since >= flightTime(i) + FLIGHT) landed++;
  s.landed = landed;

  // targets for the moving dots: the current portrait (linked: the histogram quadrant)
  const e = d.table.edges, pad = (e[d.k] - e[0]) * 0.06;
  const main = o.beat === 'table' ? geo(o, FULL, w, h, [e[0] - pad, e[d.k] + pad]) : geo(o, linked ? QUAD.hist : o.beat === 'ecdf' || o.beat === 'gap' ? CURVE : FULL, w, h);
  const st = o.beat === 'table' ? stacks(main, h * 0.5, 2 * Math.min(dot, 4.5) + 4) : stacks(main, linked ? main.py(main.r.y1 - main.r.y0) : h * 0.6);
  const target = (i: number): [number, number] => {
    switch (o.beat) {
      case 'draw': return [main.vx(d.x[i]), rugY(main, i, false)];
      case 'sort': return seriesPos(main, i);
      case 'table': return tablePos(main, i, st);
      case 'hist': case 'linked': return histPos(main, i, st, linked);
      default: return ecdfPos(main, i);
    }
  };
  // backdrops
  if (linked) {
    drawCloud(ctx, geo(o, QUAD.draw, w, h), true, fade);
    drawSeriesAxes(ctx, geo(o, QUAD.sort, w, h), fade);
    drawHist(ctx, geo(o, QUAD.hist, w, h), true, fade);
    drawEcdf(ctx, geo(o, QUAD.ecdf, w, h), false, fade);
  } else if (o.beat === 'draw') drawCloud(ctx, main, false, 1);
  else if (o.beat === 'sort') drawSeriesAxes(ctx, main, fade);
  else if (o.beat === 'table') drawTable(ctx, main, st, fade);
  else if (o.beat === 'hist') drawHist(ctx, main, false, fade);
  else drawEcdf(ctx, main, o.beat === 'gap', fade);

  // move the dots
  const k = 1 - Math.exp(-dt * 7);
  const pc = geo(o, FULL, w, h), base = cloudBase(pc, false), height = cloudHeight(pc, false), pm = pdfMax(o.opts.law, o.axis);
  for (let i = 0; i < n; i++) {
    let [tx, ty] = target(i);
    if (o.beat === 'draw') {
      const t0 = flightTime(i), a = clamp01((since - t0) / FLIGHT);
      const sx = pc.vx(d.x[i]), sy = base - o.pop.lift[i] * (LAWS[o.opts.law].pdf(d.x[i]) / pm) * height;
      if (!s.ready || a < 1) {
        const e = ease(a);
        tx = lerp(sx, tx, e);
        ty = lerp(sy, ty, e) - Math.sin(Math.PI * e) * h * 0.08;
        s.cur[2 * i] = tx;
        s.cur[2 * i + 1] = ty;
        continue;
      }
    }
    if (!s.ready || o.reduced) {
      s.cur[2 * i] = tx;
      s.cur[2 * i + 1] = ty;
      continue;
    }
    // a wave: observations start moving in rank order
    if (age < (d.rank[i] / n) * 0.7) continue;
    s.cur[2 * i] += (tx - s.cur[2 * i]) * k;
    s.cur[2 * i + 1] += (ty - s.cur[2 * i + 1]) * k;
  }
  s.ready = true;

  const hov = o.hover, hot = o.hot;
  const colour = (i: number) => {
    if (i === hov) return '#ffffff';
    if ((hot === 'xmin' && d.rank[i] === 0) || (hot === 'xmax' && d.rank[i] === n - 1)) return PALETTE.coral;
    return PALETTE.signal;
  };
  const drawDot = (x: number, y: number, i: number, r = dot) => {
    ctx.fillStyle = colour(i);
    ctx.beginPath();
    ctx.arc(x, y, i === hov ? r + 1.5 : r, 0, Math.PI * 2);
    ctx.fill();
    mark(x, y, i);
  };
  ctx.globalAlpha = 1;
  if (hot === 'n') {
    ctx.shadowColor = PALETTE.signal;
    ctx.shadowBlur = 8;
  }
  const r = linked ? Math.min(dot, 3) : o.beat === 'table' ? Math.min(4.5, st.u * 0.4) : o.beat === 'hist' ? Math.min(dot, st.u * 0.42) : dot;
  for (let i = 0; i < n; i++) {
    if (o.beat === 'draw' && since < flightTime(i)) continue;
    drawDot(s.cur[2 * i], s.cur[2 * i + 1], i, r);
  }
  ctx.shadowBlur = 0;
  if (linked) {
    ctx.globalAlpha = fade;
    const gd = geo(o, QUAD.draw, w, h), gs = geo(o, QUAD.sort, w, h), ge = geo(o, QUAD.ecdf, w, h);
    for (let i = 0; i < n; i++) {
      drawDot(gd.vx(d.x[i]), rugY(gd, i, true), i, Math.min(dot, 2.6));
      const [sx, sy] = seriesPos(gs, i);
      drawDot(sx, sy, i, Math.min(dot, 2.6));
      const [ex, ey] = ecdfPos(ge, i);
      drawDot(ex, ey, i, Math.min(dot, 2.6));
    }
    ctx.globalAlpha = 1;
  }
  if (hov != null && hov < n) halo(ctx, s, hov);
}

/** A ring around every drawn copy of the hovered observation, and threads between them in the linked view. */
function halo(ctx: Ctx, s: Sim, i: number) {
  const pts: [number, number][] = [];
  for (let j = 0; j < s.drawnCount; j++) if (s.drawn[3 * j + 2] === i) pts.push([s.drawn[3 * j], s.drawn[3 * j + 1]]);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1;
  for (let j = 1; j < pts.length; j++) {
    ctx.beginPath();
    ctx.moveTo(pts[j - 1][0], pts[j - 1][1]);
    ctx.lineTo(pts[j][0], pts[j][1]);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  for (const [x, y] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- backdrops
function drawCloud(ctx: Ctx, g: Geo, linked: boolean, alpha: number) {
  const { o } = g, law = o.opts.law, pm = pdfMax(law, o.axis), base = cloudBase(g, linked), height = cloudHeight(g, linked);
  const [lo, hi] = o.axis, n = o.d.n;
  ctx.globalAlpha = alpha;
  if (!linked) {
    ctx.fillStyle = o.hot === 'N' ? 'rgba(244,244,242,0.5)' : 'rgba(244,244,242,0.26)';
    const { x, lift } = o.pop;
    for (let j = n; j < x.length; j++) {
      if (x[j] < lo || x[j] > hi) continue;
      ctx.fillRect(g.vx(x[j]) - 0.8, base - lift[j] * (LAWS[law].pdf(x[j]) / pm) * height - 0.8, 1.6, 1.6);
    }
  }
  // the density outline
  ctx.strokeStyle = o.hot === 'a' ? PALETTE.cyan : rgba(PALETTE.cyan, 0.75);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i <= 240; i++) {
    const v = lo + ((hi - lo) * i) / 240, y = base - (LAWS[law].pdf(v) / pm) * height;
    i ? ctx.lineTo(g.vx(v), y) : ctx.moveTo(g.vx(v), y);
  }
  ctx.stroke();
  axisLine(ctx, g.vx(lo), g.vx(hi), base + 0.5);
  if (!linked) {
    // the study strip and its value axis
    const ay = g.py(0.84);
    axisLine(ctx, g.vx(lo), g.vx(hi), ay);
    ticks(ctx, g, ay + 14);
    // the sample mean against the true mean
    const xm = g.vx(o.d.mean), xa = g.vx(o.d.a);
    ctx.strokeStyle = rgba(PALETTE.violet, o.hot === 'xbar' ? 1 : 0.7);
    ctx.lineWidth = o.hot === 'xbar' ? 2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(xm, g.py(0.64));
    ctx.lineTo(xm, ay);
    ctx.stroke();
    ctx.strokeStyle = rgba(PALETTE.cyan, 0.6);
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(xa, base);
    ctx.lineTo(xa, ay);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}

function drawSeriesAxes(ctx: Ctx, g: Geo, alpha: number) {
  const { d, axis: [lo, hi] } = g.o;
  ctx.globalAlpha = alpha;
  const x0 = g.px(g.r.x0), x1 = g.px(g.r.x1), y1 = g.py(g.r.y1), y0 = g.py(g.r.y0);
  axisLine(ctx, x0, x1, y1 + 0.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(x0 - 6, y0);
  ctx.lineTo(x0 - 6, y1);
  ctx.stroke();
  const Y = (v: number) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
  for (let v = Math.ceil(lo); v <= hi; v++) small(ctx, v < 0 ? `−${-v}` : String(v), x0 - 10, Y(v) + 3, 'rgba(200,200,196,0.7)', 'right');
  // stems from the axis to every ordered value
  ctx.strokeStyle = 'rgba(232,228,133,0.18)';
  ctx.lineWidth = 1;
  for (let r = 0; r < d.n; r++) {
    const x = x0 + ((r + 0.5) / d.n) * (x1 - x0);
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, Y(d.sorted[r]));
    ctx.stroke();
  }
  // the median
  ctx.strokeStyle = rgba(PALETTE.violet, g.o.hot === 'med' ? 1 : 0.55);
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(x0, Y(d.median));
  ctx.lineTo(x1, Y(d.median));
  ctx.stroke();
  ctx.setLineDash([]);
  if (g.r === FULL) {
    small(ctx, '1', x0, y1 + 14, 'rgba(200,200,196,0.7)', 'center');
    small(ctx, String(d.n), x1, y1 + 14, 'rgba(200,200,196,0.7)', 'center');
  }
  ctx.globalAlpha = 1;
}

function drawTable(ctx: Ctx, g: Geo, st: ReturnType<typeof stacks>, alpha: number) {
  const { d, hot } = g.o, e = d.table.edges, floor = tableFloor(g);
  ctx.globalAlpha = alpha;
  // the table on top: one column per interval, counts and frequencies
  const top = g.py(0.06), rowH = g.py(0.07);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  ctx.fillRect(g.vx(e[0]), top, g.vx(e[d.k]) - g.vx(e[0]), rowH * 2);
  for (let b = 0; b <= d.k; b++) {
    const x = g.vx(e[b]);
    ctx.strokeStyle = hot === 'k' || hot === 'h' ? rgba(PALETTE.signal, 0.6) : 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, top);
    ctx.lineTo(x + 0.5, floor + 6);
    ctx.stroke();
  }
  axisLine(ctx, g.vx(e[0]) - 4, g.vx(e[d.k]) + 4, floor + 0.5);
  const fs = d.k > 14 ? 9 : 11;
  for (let b = 0; b < d.k; b++) {
    const cx = (g.vx(e[b]) + g.vx(e[b + 1])) / 2;
    small(ctx, String(d.table.counts[b]), cx, top + rowH * 0.62, hot === 'sum' || hot === 'mr' ? PALETTE.signal : '#f4f4f2', 'center', fs + 2);
    small(ctx, dec(d.table.freq[b].toFixed(d.n >= 100 ? 3 : 2)), cx, top + rowH * 1.62, 'rgba(200,200,196,0.8)', 'center', fs);
  }
  // interval edges under the axis
  const every = Math.ceil((d.k + 1) / 12);
  for (let b = 0; b <= d.k; b += every) small(ctx, dec(e[b].toFixed(2)), g.vx(e[b]), floor + 16, 'rgba(200,200,196,0.7)', 'center', 9.5);
  ctx.globalAlpha = 1;
  void st;
}

function drawHist(ctx: Ctx, g: Geo, linked: boolean, alpha: number) {
  const { d, opts, axis: [lo, hi], hot } = g.o, e = d.table.edges, floor = histFloor(g, linked), sc = histScale(g, linked);
  ctx.globalAlpha = alpha;
  for (let b = 0; b < d.k; b++) {
    const x0 = g.vx(e[b]), x1 = g.vx(e[b + 1]), H = d.table.height[b] * sc;
    ctx.fillStyle = hot === 'area' ? rgba(PALETTE.signal, 0.22) : 'rgba(232,228,133,0.1)';
    ctx.fillRect(x0 + 0.5, floor - H, x1 - x0 - 1, H);
    ctx.strokeStyle = hot === 'h' || hot === 'k' ? PALETTE.signal : 'rgba(232,228,133,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, floor - H + 0.5, x1 - x0 - 1, H);
  }
  ctx.strokeStyle = hot === 'a' ? PALETTE.cyan : rgba(PALETTE.cyan, 0.85);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i <= 240; i++) {
    const v = lo + ((hi - lo) * i) / 240, y = floor - LAWS[opts.law].pdf(v) * sc;
    i ? ctx.lineTo(g.vx(v), y) : ctx.moveTo(g.vx(v), y);
  }
  ctx.stroke();
  axisLine(ctx, g.vx(lo), g.vx(hi), floor + 0.5);
  if (!linked) ticks(ctx, g, floor + 14);
  ctx.globalAlpha = 1;
}

function drawEcdf(ctx: Ctx, g: Geo, gap: boolean, alpha: number) {
  const { d, opts, axis: [lo, hi], hot } = g.o, floor = g.py(g.r.y1), top = g.py(g.r.y0);
  const Y = (p: number) => floor - p * (floor - top);
  const F = LAWS[opts.law].cdf;
  const full = g.r === CURVE;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  for (const p of full ? [0.25, 0.5, 0.75, 1] : [1]) {
    ctx.beginPath();
    ctx.moveTo(g.vx(lo), Y(p));
    ctx.lineTo(g.vx(hi), Y(p));
    ctx.stroke();
    if (full) small(ctx, dec(String(p)), g.vx(lo) - 8, Y(p) + 3, 'rgba(200,200,196,0.7)', 'right');
  }
  axisLine(ctx, g.vx(lo), g.vx(hi), floor + 0.5);
  if (full) ticks(ctx, g, floor + 14);
  // the true F
  ctx.strokeStyle = rgba(PALETTE.cyan, hot === 'a' ? 1 : 0.8);
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i <= 240; i++) {
    const v = lo + ((hi - lo) * i) / 240;
    i ? ctx.lineTo(g.vx(v), Y(F(v))) : ctx.moveTo(g.vx(v), Y(F(v)));
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // the steps of F_n
  const E = d.ecdf;
  ctx.strokeStyle = hot === 'Fn' ? PALETTE.signal : 'rgba(232,228,133,0.75)';
  ctx.lineWidth = hot === 'Fn' ? 2 : 1.4;
  ctx.beginPath();
  ctx.moveTo(g.vx(lo), Y(0));
  let prev = 0;
  for (let j = 0; j < E.x.length; j++) {
    const x = g.vx(E.x[j]);
    ctx.lineTo(x, Y(prev));
    ctx.moveTo(x, Y(E.y[j]));
    prev = E.y[j];
  }
  ctx.lineTo(g.vx(hi), Y(1));
  ctx.stroke();
  if (gap) {
    const q = gapAt(d, F), x = g.vx(q.x);
    ctx.strokeStyle = PALETTE.coral;
    ctx.lineWidth = hot === 'dn' ? 4 : 3;
    ctx.shadowColor = PALETTE.coral;
    ctx.shadowBlur = hot === 'dn' ? 14 : 8;
    ctx.beginPath();
    ctx.moveTo(x, Y(q.from));
    ctx.lineTo(x, Y(q.to));
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

function ticks(ctx: Ctx, g: Geo, y: number) {
  const [lo, hi] = g.o.axis;
  for (let v = Math.ceil(lo); v <= hi; v++) small(ctx, v < 0 ? `−${-v}` : String(v), g.vx(v), y, 'rgba(200,200,196,0.7)', 'center');
}
function axisLine(ctx: Ctx, a: number, b: number, y: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(a, y);
  ctx.lineTo(b, y);
  ctx.stroke();
}
function small(ctx: Ctx, text: string, x: number, y: number, colour: string, align: CanvasTextAlign, size = 10) {
  ctx.font = `${size}px "IBM Plex Mono", monospace`;
  ctx.textAlign = align;
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
}
