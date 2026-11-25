import { useRef, useState } from 'react';
import { PALETTE } from './specs.mjs';
import { ksToNormal, phi, replicate, sourceOf, SOURCES, zSample, type Source } from './clt-model.mjs';
import { clamp01, ease, easeInOut, Label, lerp, rgba, useCanvasLoop, useThrottledReport, type FigureProps, type Frame } from './kit';

/**
 * The normal distribution factory (#111, L8). Terms fall from the source law into the machine, merge into a sum,
 * pass the standardizing gate and drop into the histogram of z, where the bell of φ(z) appears.
 * The z values are the CLT kernel's (same seed and n as the CLT station), computed up front; the animation only
 * decides when each one lands. Beats: source, terms, sum, standardize, histogram, normal, race.
 */
const R = 4000;
const BINS = 40, Z_LO = -4, Z_HI = 4, BW = (Z_HI - Z_LO) / BINS;
const MAX_SLOTS = 24;
const SLOW = { fall: 1.1, merge: 1.7, gate: 2.5, land: 3.2 };
const FAST = 0.85;
const SLOW_BEATS = new Set(['terms', 'sum', 'standardize']);

type Flight = { r: number; born: number; terms: number[]; sum: number; z: number; slow: boolean };
type Lane = { src: Source; z: Float64Array; landed: number; counts: number[]; ks: number | null; ksAt: number };
type Sim = {
  key: string;
  n: number;
  p: number;
  main: Lane;
  race: Lane[] | null;
  flights: Flight[];
  spawned: number;
  clock: number;
  spawnAcc: number;
  fastSince: number | null;
  lastSlow: number;
  rug: { x: number; born: number }[];
  rugAcc: number;
  rugIndex: number;
  beat: string;
  beatSince: number;
  last: { sum: number | null; z: number | null };
};

const lane = (src: Source, n: number, seed: number, p: number): Lane => ({
  src, z: zSample(src, n, R, seed, p), landed: 0, counts: new Array(BINS).fill(0), ks: null, ksAt: -1,
});
const land = (l: Lane, upTo: number) => {
  for (; l.landed < upTo; l.landed++) {
    const k = Math.floor((l.z[l.landed] - Z_LO) / BW);
    if (k >= 0 && k < BINS) l.counts[k]++;
  }
};

export function CltFactory({ beat, params, seed, hot, onHot, playing, reduced, runKey, onResults }: FigureProps) {
  const n = Math.round(params.n), p = params.p, src = sourceOf(params.src);
  const key = `${n}|${src.id}|${p}|${seed}|${runKey}`;
  const sim = useRef<Sim | null>(null);
  if (!sim.current || sim.current.key !== key) {
    sim.current = {
      key, n, p, main: lane(src, n, seed, p), race: null, flights: [], spawned: 0, clock: 0, spawnAcc: 0, fastSince: null, lastSlow: -99,
      rug: [], rugAcc: 0, rugIndex: 0, beat, beatSince: 0, last: { sum: null, z: null },
    };
  }
  const [shown, setShown] = useState<{ sum: number | null; z: number | null; ks: (number | null)[] }>({ sum: null, z: null, ks: [] });
  const props = { beat, hot, reduced, seed, src, n, p };
  const live = useRef(props);
  live.current = props;

  useThrottledReport(() => {
    const s = sim.current!, m = s.main;
    if (m.landed !== m.ksAt) {
      m.ks = ksToNormal(m.z, m.landed);
      m.ksAt = m.landed;
    }
    for (const l of s.race ?? []) if (l.landed !== l.ksAt) {
      l.ks = ksToNormal(l.z, l.landed);
      l.ksAt = l.landed;
    }
    setShown({ sum: s.last.sum, z: s.last.z, ks: (s.race ?? []).map((l) => l.ks) });
    return { ks: m.ks, count: m.landed, sum: s.last.sum, zlast: s.last.z, mean: m.src.mean(p), sd: m.src.sd(p) };
  }, onResults, 150);

  const canvas = useCanvasLoop((f) => step(sim.current!, live.current, f), playing);

  const race = beat === 'race';
  const slow = SLOW_BEATS.has(beat);
  const dimMachine = beat === 'source';
  const dimHist = beat === 'source' || slow;
  const fmt = (v: number | null, d = 2) => (v == null ? '—' : v.toFixed(d).replace('-', '−'));
  return (
    <div
      className="figure figure--clt"
      data-beat={beat}
      onMouseMove={(e) => {
        if (race) return;
        const r = e.currentTarget.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
        onHot(y < 0.27 ? 'X' : y < 0.46 ? 'S' : y < 0.6 ? 'z' : beat === 'normal' ? 'Phi' : 'z');
      }}
      onMouseLeave={() => onHot(null)}
    >
      <canvas ref={canvas} className="figure-canvas" role="img"
        aria-label={`Normal distribution factory: ${src.id} terms, n = ${n}, ${sim.current.main.landed} standardized sums in the histogram.`} />
      {!race ? (
        <>
          <Label x={0.03} y={0.03} hot={hot === 'X'}>{`one term $X \\sim ${src.tex(p)}$`}</Label>
          <Label x={srcFrac(src, src.mean(p))} y={0.045} hot={hot === 'a' || hot === 'sigma'} className="figure-mark">{'$a$'}</Label>
          <Label x={0.03} y={0.315} hot={hot === 'S' || hot === 'n'} dim={dimMachine}>{`$n = ${n}$ terms add up: $S_n = X_1 + \\dots + X_n$`}</Label>
          {slow && shown.sum != null && <Label x={0.5} y={0.405} align="middle" hot={hot === 'S'} className="figure-chip">{`$S_n = ${fmt(shown.sum)}$`}</Label>}
          <Label x={0.62} y={0.505} hot={hot === 'z' || hot === 'a' || hot === 'sigma'} dim={dimMachine}>{'$z = \\dfrac{S_n - na}{\\sigma\\sqrt{n}}$'}</Label>
          {slow && shown.z != null && <Label x={0.38} y={0.505} align="end" className="figure-chip">{`$z = ${fmt(shown.z)}$`}</Label>}
          <Label x={0.03} y={0.6} hot={hot === 'z' || hot === 'count'} dim={dimHist && beat === 'source'}>{`histogram of $z$ · ${sim.current.main.landed.toLocaleString('en-US')} sums`}</Label>
          {beat === 'normal' && <Label x={0.97} y={0.6} align="end" hot={hot === 'Phi' || hot === 'ks'}>{'$\\varphi(z) = \\tfrac{1}{\\sqrt{2\\pi}}\\,e^{-z^2/2}$'}</Label>}
        </>
      ) : (
        <>
          {SOURCES.map((s, i) => (
            <Label key={s.id} x={(i + 0.5) / 3} y={0.03} align="middle">{`$X \\sim ${s.tex(p)}$`}</Label>
          ))}
          {SOURCES.map((s, i) => (
            <Label key={s.id + 'ks'} x={(i + 0.5) / 3} y={0.9} align="middle" hot={hot === 'ks'} className="figure-chip">
              {`$D = ${shown.ks[i] == null ? '\\text{—}' : (shown.ks[i] as number).toFixed(3)}$`}
            </Label>
          ))}
          <Label x={0.5} y={0.25} align="middle">{`$n = ${n}$ terms in every sum`}</Label>
        </>
      )}
    </div>
  );
}

/** Horizontal position of x on the source axis, as a fraction of the width (matches layout().srcX). */
const srcFrac = (src: Source, x: number) => {
  const [d0, d1] = src.domain();
  return 0.12 + ((x - d0) / (d1 - d0)) * 0.76;
};

type Live = { beat: string; hot: string | null; reduced: boolean; seed: number; src: Source; n: number; p: number };

/** Advance the simulation by dt and draw it. */
function step(s: Sim, o: Live, { ctx, w, h, dt }: Frame) {
  if (s.beat !== o.beat) {
    s.beat = o.beat;
    s.beatSince = s.clock;
    if (o.beat !== 'histogram' && o.beat !== 'normal') s.fastSince = null;
  }
  s.clock += dt;
  const sinceBeat = s.clock - s.beatSince;
  if (o.beat === 'race') return drawRace(s, o, ctx, w, h, dt, sinceBeat);
  const m = s.main;
  const slow = SLOW_BEATS.has(o.beat), fast = o.beat === 'histogram' || o.beat === 'normal';

  // ---- spawn
  if (o.reduced && fast) {
    land(m, R);
    s.spawned = R;
    s.flights = [];
  } else if (slow && s.spawned < R) {
    if (s.clock - s.lastSlow > (o.reduced ? 1e9 : 2.3) || (o.reduced && s.flights.length === 0)) {
      s.flights.push(newFlight(s, o, true));
      s.lastSlow = s.clock;
    }
  } else if (fast && s.spawned < R) {
    if (s.fastSince == null) s.fastSince = s.clock;
    const t = s.clock - s.fastSince;
    const rate = Math.min(1400, 1.5 * 2.2 ** (t * 1.5));
    s.spawnAcc += rate * dt;
    while (s.spawnAcc >= 1 && s.spawned < R) {
      s.spawnAcc -= 1;
      s.flights.push(newFlight(s, o, rate < 2.2));
    }
  }
  if (o.beat === 'source' && !o.reduced) {
    s.rugAcc += dt * 9;
    while (s.rugAcc >= 1) {
      s.rugAcc -= 1;
      s.rug.push({ x: o.src.draw(o.seed, 0, 10000 + s.rugIndex++, o.p), born: s.clock });
    }
    if (s.rug.length > 240) s.rug.splice(0, s.rug.length - 240);
  } else if (o.beat === 'source' && o.reduced && s.rug.length === 0) {
    for (let i = 0; i < 120; i++) s.rug.push({ x: o.src.draw(o.seed, 0, 10000 + i, o.p), born: -99 });
  }

  // ---- layout
  const L = layout(w, h, o.src);
  const dimMachine = o.beat === 'source', dimHist = o.beat === 'source' || slow;
  drawSource(ctx, L, o, s);
  drawMachine(ctx, L, o, s.n, dimMachine);
  drawHistogram(ctx, L, m, o, dimHist ? 0.32 : 1, o.beat === 'normal' ? clamp01(sinceBeat / (o.reduced ? 0.001 : 1.3)) : 0);

  // ---- flights, in birth order; they land in order
  const keep: Flight[] = [];
  for (const f of s.flights) {
    const age = s.clock - f.born;
    const total = f.slow ? (o.reduced ? Infinity : SLOW.land) : FAST;
    if (age >= total) {
      land(m, f.r + 1);
      continue;
    }
    keep.push(f);
    drawFlight(ctx, L, f, o.reduced && f.slow ? SLOW.merge + 0.05 : age, o);
  }
  s.flights = keep;
}

function newFlight(s: Sim, o: Live, slow: boolean): Flight {
  const r = s.spawned++;
  const rep = slow ? replicate(o.src, s.n, o.seed, r, o.p, MAX_SLOTS) : null;
  const z = s.main.z[r];
  const sum = rep ? rep.sum : z * o.src.sd(o.p) * Math.sqrt(s.n) + s.n * o.src.mean(o.p);
  s.last = { sum, z };
  return { r, born: s.clock, terms: rep?.terms ?? [], sum, z, slow };
}

type Layout = ReturnType<typeof layout>;
function layout(w: number, h: number, src: Source) {
  const [d0, d1] = src.domain();
  const sx0 = w * 0.12, sx1 = w * 0.88;
  return {
    w, h,
    srcTop: h * 0.1, srcBase: h * 0.25,
    srcX: (x: number) => sx0 + ((x - d0) / (d1 - d0)) * (sx1 - sx0),
    rowY: h * 0.43,
    gateY: h * 0.545,
    histTop: h * 0.67, histBase: h * 0.93,
    zX: (z: number) => w * 0.06 + ((z - Z_LO) / (Z_HI - Z_LO)) * w * 0.88,
    slotX: (t: number, k: number) => w / 2 + (t - (k - 1) / 2) * Math.min(30, (w * 0.7) / k),
  };
}

function drawSource(ctx: CanvasRenderingContext2D, L: Layout, o: Live, s: Sim) {
  const { src, p } = o;
  const hotX = o.hot === 'X', hotA = o.hot === 'a' || o.hot === 'sigma';
  const H = L.srcBase - L.srcTop;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L.srcX(src.domain()[0]), L.srcBase + 0.5);
  ctx.lineTo(L.srcX(src.domain()[1]), L.srcBase + 0.5);
  ctx.stroke();
  const fill = rgba(PALETTE.cyan, hotX ? 0.3 : 0.14), line = rgba(PALETTE.cyan, hotX ? 1 : 0.75);
  if (src.atoms) {
    for (const [x, q] of src.atoms(p)) {
      const x0 = L.srcX(x);
      ctx.fillStyle = fill;
      ctx.fillRect(x0 - 14, L.srcBase - q * H, 28, q * H);
      ctx.strokeStyle = line;
      ctx.strokeRect(x0 - 14 + 0.5, L.srcBase - q * H + 0.5, 27, q * H);
      label(ctx, `${x}`, x0, L.srcBase + 13, 'center');
    }
  } else {
    const [d0, d1] = src.domain();
    ctx.beginPath();
    ctx.moveTo(L.srcX(d0), L.srcBase);
    for (let i = 0; i <= 160; i++) {
      const x = d0 + ((d1 - d0) * i) / 160;
      ctx.lineTo(L.srcX(x), L.srcBase - src.density!(x) * H);
    }
    ctx.lineTo(L.srcX(d1), L.srcBase);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = hotX ? 2 : 1.4;
    ctx.stroke();
    for (const x of [0, 1, ...(d1 > 3 ? [2, 3, 4] : [])]) label(ctx, `${x}`, L.srcX(x), L.srcBase + 13, 'center');
  }
  // expectation a and a ± σ
  const a = src.mean(p), sd = src.sd(p);
  ctx.strokeStyle = rgba(PALETTE.coral, hotA ? 1 : 0.55);
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(L.srcX(a), L.srcTop - 4);
  ctx.lineTo(L.srcX(a), L.srcBase);
  ctx.stroke();
  ctx.setLineDash([]);
  if (hotA) {
    ctx.strokeStyle = PALETTE.coral;
    ctx.beginPath();
    ctx.moveTo(L.srcX(a - sd), L.srcTop + 2);
    ctx.lineTo(L.srcX(a + sd), L.srcTop + 2);
    ctx.stroke();
  }
  // single draws raining onto the axis
  for (const d of s.rug) {
    const age = s.clock - d.born, f = ease(age / 0.6);
    const x = L.srcX(d.x) + (src.discrete ? ((d.born * 997) % 1 - 0.5) * 22 : 0);
    const y = lerp(L.srcTop - 10, L.srcBase - 3, f);
    ctx.fillStyle = rgba(PALETTE.cyan, f < 1 ? 0.95 : Math.max(0.18, 0.9 - (age - 0.6) * 0.08));
    ctx.beginPath();
    ctx.arc(x, y, f < 1 ? 2.6 : 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMachine(ctx: CanvasRenderingContext2D, L: Layout, o: Live, n: number, dim: boolean) {
  const k = Math.min(n, MAX_SLOTS);
  const hot = o.hot === 'n' || o.hot === 'S';
  ctx.save();
  ctx.globalAlpha = dim ? 0.3 : 1;
  for (let t = 0; t < k; t++) {
    const x = L.slotX(t, k);
    ctx.strokeStyle = hot ? rgba(PALETTE.signal, 0.6) : 'rgba(255,255,255,0.16)';
    ctx.strokeRect(x - 8.5, L.rowY - 8.5, 17, 17);
  }
  if (n > k) label(ctx, `+ ${n - k} more`, L.slotX(k - 1, k) + 16, L.rowY + 4, 'left');
  // the gate
  const g = L.gateY, cx = L.w / 2;
  const hotG = o.hot === 'z' || o.hot === 'a' || o.hot === 'sigma';
  ctx.strokeStyle = hotG ? PALETTE.signal : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = hotG ? 2 : 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 70, g - 14);
  ctx.lineTo(cx - 12, g);
  ctx.lineTo(cx - 70, g + 14);
  ctx.moveTo(cx + 70, g - 14);
  ctx.lineTo(cx + 12, g);
  ctx.lineTo(cx + 70, g + 14);
  ctx.stroke();
  ctx.restore();
}

function drawFlight(ctx: CanvasRenderingContext2D, L: Layout, f: Flight, age: number, o: Live) {
  const cx = L.w / 2, zx = L.zX(f.z);
  const bin = Math.floor((f.z - Z_LO) / BW);
  const binTop = L.histBase - 4;
  if (!f.slow) {
    const k = ease(age / FAST);
    ctx.fillStyle = `rgba(244,244,242,${0.9 - 0.4 * k})`;
    ctx.beginPath();
    ctx.arc(lerp(cx, zx, Math.min(1, k * 1.6)), lerp(L.gateY, binTop, k), 2.1, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const k = f.terms.length;
  const hotX = o.hot === 'X', hotS = o.hot === 'S';
  // terms fall into their slots, then slide together
  const merge = easeInOut((age - SLOW.fall) / (SLOW.merge - SLOW.fall));
  if (merge < 1) {
    for (let t = 0; t < k; t++) {
      const d = (t * 0.8) / k;
      const fall = ease((age - d) / 0.5);
      if (fall <= 0) continue;
      const sx = L.srcX(f.terms[t]), tx = L.slotX(t, k);
      let x = lerp(sx, tx, fall), y = lerp(L.srcBase, L.rowY, fall) - Math.sin(Math.PI * fall) * 18;
      x = lerp(x, cx, merge);
      y = lerp(y, L.rowY, merge);
      ctx.fillStyle = rgba(PALETTE.cyan, 1 - merge * 0.6);
      ctx.beginPath();
      ctx.arc(x, y, (hotX ? 5 : 4) * (1 - 0.5 * merge), 0, Math.PI * 2);
      ctx.fill();
      if (k <= 8 && fall >= 1 && merge === 0) label(ctx, f.terms[t].toFixed(o.src.discrete ? 0 : 2), tx, L.rowY + 22, 'center');
    }
  }
  if (merge <= 0) return;
  // the bead: S_n, then z
  const gate = easeInOut((age - SLOW.merge) / (SLOW.gate - SLOW.merge));
  const drop = ease((age - SLOW.gate) / (SLOW.land - SLOW.gate));
  let x = cx, y = L.rowY;
  if (gate > 0) {
    y = lerp(L.rowY, L.gateY, Math.min(1, gate * 2));
    x = lerp(cx, zx, clamp01(gate * 2 - 1));
  }
  if (drop > 0) y = lerp(L.gateY, binTop, drop);
  const through = gate > 0.5;
  ctx.fillStyle = through ? PALETTE.ink : PALETTE.violet;
  ctx.shadowColor = through ? 'rgba(255,255,255,0.8)' : rgba(PALETTE.violet, 0.9);
  ctx.shadowBlur = hotS || o.hot === 'z' ? 18 : 10;
  ctx.beginPath();
  ctx.arc(x, y, 6.5 * Math.min(1, merge * 1.4), 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (bin >= 0 && bin < BINS && drop > 0) {
    ctx.strokeStyle = rgba(PALETTE.ink, 0.25 * (1 - drop));
    ctx.beginPath();
    ctx.moveTo(zx, L.gateY);
    ctx.lineTo(zx, y);
    ctx.stroke();
  }
}

function drawHistogram(ctx: CanvasRenderingContext2D, L: Layout, m: Lane, o: Live, alpha: number, curve: number) {
  const H = L.histBase - L.histTop;
  const dens = m.counts.map((c) => (m.landed ? c / (m.landed * BW) : 0));
  const top = Math.max(0.46, ...dens.map((d) => d * 1.04));
  const y = (d: number) => L.histBase - (d / top) * H;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(L.zX(Z_LO), L.histBase + 0.5);
  ctx.lineTo(L.zX(Z_HI), L.histBase + 0.5);
  ctx.stroke();
  for (let z = -4; z <= 4; z++) label(ctx, z < 0 ? `−${-z}` : `${z}`, L.zX(z), L.histBase + 14, 'center');
  const hotZ = o.hot === 'z' || o.hot === 'count';
  for (let i = 0; i < BINS; i++) {
    if (!m.counts[i]) continue;
    const x0 = L.zX(Z_LO + i * BW) + 1, x1 = L.zX(Z_LO + (i + 1) * BW) - 1;
    ctx.fillStyle = hotZ ? 'rgba(244,244,242,0.95)' : 'rgba(214,214,210,0.82)';
    ctx.fillRect(x0, y(dens[i]), x1 - x0, L.histBase - y(dens[i]));
  }
  if (curve > 0) {
    const hot = o.hot === 'Phi' || o.hot === 'ks';
    ctx.strokeStyle = PALETTE.signal;
    ctx.lineWidth = hot ? 3 : 2;
    ctx.shadowColor = rgba(PALETTE.signal, 0.6);
    ctx.shadowBlur = hot ? 14 : 6;
    ctx.beginPath();
    const end = Z_LO + (Z_HI - Z_LO) * ease(curve);
    for (let z = Z_LO; z <= end; z += 0.04) {
      const px = L.zX(z), py = y(phi(z));
      if (z === Z_LO) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawRace(s: Sim, o: Live, ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, since: number) {
  if (!s.race) s.race = SOURCES.map((src) => lane(src, s.n, o.seed, o.p));
  const rate = Math.min(1400, 3 * 1.9 ** (since * 1.5));
  s.spawnAcc += rate * dt;
  const add = Math.floor(s.spawnAcc);
  s.spawnAcc -= add;
  const target = o.reduced ? R : Math.min(R, s.race[0].landed + add);
  for (const l of s.race) land(l, target);
  const col = w / 3;
  s.race.forEach((l, i) => {
    const x0 = col * i + col * 0.08, x1 = col * (i + 1) - col * 0.08;
    // mini source
    const sTop = h * 0.1, sBase = h * 0.21, [d0, d1] = l.src.domain();
    const sx = (x: number) => x0 + ((x - d0) / (d1 - d0)) * (x1 - x0);
    ctx.save();
    ctx.fillStyle = rgba(PALETTE.cyan, 0.16);
    ctx.strokeStyle = rgba(PALETTE.cyan, 0.8);
    if (l.src.atoms) {
      for (const [x, q] of l.src.atoms(o.p)) {
        ctx.fillRect(sx(x) - 8, sBase - q * (sBase - sTop), 16, q * (sBase - sTop));
        ctx.strokeRect(sx(x) - 8 + 0.5, sBase - q * (sBase - sTop) + 0.5, 15, q * (sBase - sTop));
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(sx(d0), sBase);
      for (let j = 0; j <= 80; j++) {
        const x = d0 + ((d1 - d0) * j) / 80;
        ctx.lineTo(sx(x), sBase - l.src.density!(x) * (sBase - sTop));
      }
      ctx.lineTo(sx(d1), sBase);
      ctx.fill();
      ctx.stroke();
    }
    // histogram of z with φ
    const hTop = h * 0.34, hBase = h * 0.84, zx = (z: number) => x0 + ((z - Z_LO) / (Z_HI - Z_LO)) * (x1 - x0);
    const dens = l.counts.map((c) => (l.landed ? c / (l.landed * BW) : 0));
    const top = Math.max(0.46, ...dens.map((d) => d * 1.04));
    const yy = (d: number) => hBase - (d / top) * (hBase - hTop);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(x0, hBase + 0.5);
    ctx.lineTo(x1, hBase + 0.5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(214,214,210,0.82)';
    for (let b = 0; b < BINS; b++) if (l.counts[b]) ctx.fillRect(zx(Z_LO + b * BW) + 0.5, yy(dens[b]), Math.max(1, zx(Z_LO + (b + 1) * BW) - zx(Z_LO + b * BW) - 1), hBase - yy(dens[b]));
    ctx.strokeStyle = PALETTE.signal;
    ctx.lineWidth = o.hot === 'Phi' || o.hot === 'ks' ? 2.6 : 1.8;
    ctx.beginPath();
    for (let z = Z_LO; z <= Z_HI; z += 0.05) (z === Z_LO ? ctx.moveTo : ctx.lineTo).call(ctx, zx(z), yy(phi(z)));
    ctx.stroke();
    for (const z of [-3, 0, 3]) label(ctx, z < 0 ? `−${-z}` : `${z}`, zx(z), hBase + 14, 'center');
    ctx.restore();
  });
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign, color = 'rgba(200,200,196,0.75)') {
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(text.replace('-', '−'), x, y);
}
