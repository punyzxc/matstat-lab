import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { touchDragDirection } from '../touch-drag';
import { useStationReducedMotion } from '../motion-preference';
import { MathText, SvgMathText, mathToPlain } from '../math';
import { RotateCcw } from 'lucide-react';
import { Button } from '../ui';
import type { Surface } from './kernel-contract';
import { clamp, lerpArray, lerpGrid, niceTicks, project, quadsByDepth, unit } from './surface-math.mjs';
import { useTween } from './use-tween';
import { locale, t } from '../i18n';

const W = 680, H = 340;
const VIEWPORT = { cx: 340, cy: 180, scale: 112 };
const DEFAULT_VIEW = { yaw: -0.6, pitch: 0.55 };
const PITCH_RANGE: [number, number] = [-0.1, 1.2];
const ZLO = -0.5; // world z of the floor; the surface rises to ZLO + 1

/** Blend two surfaces on the same grid; null when the grid changed (then the surface snaps). */
function mixSurface(a: Surface, b: Surface, t: number): Surface | null {
  const same =
    a.x.length === b.x.length && a.y.length === b.y.length && a.z.length === b.z.length &&
    a.z[0]?.length === b.z[0]?.length && Boolean(a.zSample) === Boolean(b.zSample) && Boolean(a.overlay) === Boolean(b.overlay) &&
    (a.wall?.z.length ?? -1) === (b.wall?.z.length ?? -1);
  if (!same) return null;
  return {
    ...b,
    x: lerpArray(a.x, b.x, t),
    y: lerpArray(a.y, b.y, t),
    z: lerpGrid(a.z, b.z, t),
    zSample: a.zSample && b.zSample ? lerpGrid(a.zSample, b.zSample, t) : b.zSample,
    overlay: a.overlay && b.overlay ? lerpGrid(a.overlay, b.overlay, t) : b.overlay,
    wall: a.wall && b.wall ? { ...b.wall, z: lerpArray(a.wall.z, b.wall.z, t) } : b.wall,
  };
}

const fmt = (v: number, step: number) => {
  const digits = Math.max(0, Math.min(4, -Math.floor(Math.log10(step) + 1e-9)));
  return v.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false }).replace('-', '−');
};
const stepOf = (t: number[]) => (t.length > 1 ? t[1] - t[0] : 1);
const finiteMin = (a: number[]) => a.reduce((m, v) => (Number.isFinite(v) && v < m ? v : m), Infinity);
const finiteMax = (a: number[]) => a.reduce((m, v) => (Number.isFinite(v) && v > m ? v : m), -Infinity);
const pathOf = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');

type Item = { points: number[][]; bias?: number; kind: 'quad' | 'stem' | 'bar' | 'overlay'; h: number; cell?: [number, number]; faces?: number[][][] };
/** #84: idle turn speed (radians per millisecond), and how long a drag or a key holds the camera before it turns again. */
const SPIN = 0.00016, HOLD_MS = 4000;
const sig4 = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(4)).toLocaleString(locale(), { maximumSignificantDigits: 4, useGrouping: false }).replace('-', '−') : '—');

type View = { yaw: number; pitch: number };
const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n1 = (v: number) => v.toFixed(1);

/** Place a React-rendered `SvgMathText` (a `<text>` or a `<foreignObject>`) without a React render. */
function placeMath(g: SVGGElement | null, x: number, y: number, anchor: 'start' | 'middle' | 'end', width: number) {
  const el = g?.firstElementChild;
  if (!el) return;
  if (el.tagName === 'text') {
    el.setAttribute('x', n1(x));
    el.setAttribute('y', n1(y));
    el.setAttribute('text-anchor', anchor);
    return;
  }
  el.setAttribute('x', n1(anchor === 'start' ? x : anchor === 'middle' ? x - width / 2 : x - width));
  el.setAttribute('y', n1(y - 15));
  const box = el.firstElementChild;
  if (box) box.className = `svg-math-box svg-math-${anchor}`;
}

/** Everything the painter needs besides the view; rebuilt by React when params, the tween or the cursor change. */
type Model = {
  items: Item[]; xs: number[]; ys: number[]; z: number[][]; zmax: number; x0: number; x1: number; y0: number; y1: number;
  wall: Surface['wall']; cursor: [number, number] | null;
};

/** Frames painted and React commits of each surface, read by the e2e specs (`svg.__paints`, `svg.__commits`). */
type CountedSvg = SVGSVGElement & { __paints?: number; __commits?: number };

/**
 * A rotatable SVG joint-density surface: theory as shaded quads, sample density as stems.
 * #196: React renders the frame of the chart and the typeset labels; the geometry that moves with the camera
 * (box, wall, quads, bars, stems, cursor, axes and ticks) is written straight into the SVG by `paint`, so the
 * idle turn costs no React render. React renders only when the surface, the cursor or the labels change.
 */
function Surface3DView({ surface, keyLabel }: { surface: Surface; keyLabel?: string }) {
  const shown = useTween(surface, mixSurface);
  const view = useRef<View>(DEFAULT_VIEW);
  const drag = useRef<{ id: number; x: number; y: number; active: boolean } | null>(null);
  const hintId = useId();
  const { x: xs, y: ys, z, zSample, labels, overlay, wall } = shown;
  const bars = Boolean(shown.bars);
  /** #84: the camera turns by itself while idle and on screen; a drag or a key holds it for HOLD_MS; reduced motion keeps a still 3/4 view. */
  const reduced = useStationReducedMotion();
  const heldUntil = useRef(0);
  const hold = () => { heldUntil.current = performance.now() + HOLD_MS; };
  const svgRef = useRef<CountedSvg | null>(null);
  const layer = { box: useRef<SVGGElement>(null), wall: useRef<SVGGElement>(null), items: useRef<SVGGElement>(null), cursor: useRef<SVGGElement>(null), axis: useRef<SVGGElement>(null) };
  const title = { x: useRef<SVGGElement>(null), y: useRef<SVGGElement>(null), z: useRef<SVGGElement>(null) };
  /** The cell under the pointer or the keyboard cursor (Shift + arrows): its x, y and z are read out. */
  const [cursor, setCursorState] = useState<[number, number] | null>(null);
  const setCursor = (c: [number, number] | null | ((c: [number, number] | null) => [number, number] | null)) =>
    setCursorState((prev) => {
      const next = typeof c === 'function' ? c(prev) : c;
      return prev && next && prev[0] === next[0] && prev[1] === next[1] ? prev : next;
    });

  const { x0, x1, y0, y1, zmax } = useMemo(() => {
    const zTop = Math.max(finiteMax(z.flat()), zSample ? finiteMax(zSample.flat()) : 0, overlay ? finiteMax(overlay.flat()) : 0, wall ? finiteMax(wall.z) : 0);
    return {
      x0: finiteMin(xs), x1: finiteMax(xs), y0: finiteMin(ys), y1: finiteMax(ys),
      zmax: Math.min(Number.isFinite(zTop) && zTop > 0 ? zTop : 1, shown.zCeil ?? Infinity) * 1.05,
    };
  }, [xs, ys, z, zSample, overlay, wall, shown.zCeil]);

  const items = useMemo(() => {
    const out: Item[] = [];
    const node = (g: number[][], i: number, j: number) => [unit(xs[i], x0, x1), unit(ys[j], y0, y1), ZLO + clamp(g[j][i] / zmax, 0, 1.2)];
    if (bars) {
      // #84: one box per node; half a cell wide (or a fixed width on a single row/column), zero heights left out.
      const hx = xs.length > 1 ? 0.8 / (xs.length - 1) : 0.4, hy = ys.length > 1 ? 0.8 / (ys.length - 1) : 0.4;
      for (let j = 0; j < ys.length; j++)
        for (let i = 0; i < xs.length; i++) {
          const v = z[j][i];
          if (!(v > zmax * 1e-3)) continue;
          const cx = unit(xs[i], x0, x1), cy = unit(ys[j], y0, y1), top = ZLO + clamp(v / zmax, 0, 1.2);
          const c = (dx: number, dy: number, zz: number) => [cx + dx * hx, cy + dy * hy, zz];
          out.push({ kind: 'bar', h: v / zmax, cell: [i, j], points: [[cx, cy, (ZLO + top) / 2]], faces: [
            [c(-1, -1, ZLO), c(1, -1, ZLO), c(1, -1, top), c(-1, -1, top)],
            [c(1, -1, ZLO), c(1, 1, ZLO), c(1, 1, top), c(1, -1, top)],
            [c(1, 1, ZLO), c(-1, 1, ZLO), c(-1, 1, top), c(1, 1, top)],
            [c(-1, 1, ZLO), c(-1, -1, ZLO), c(-1, -1, top), c(-1, 1, top)],
            [c(-1, -1, top), c(1, -1, top), c(1, 1, top), c(-1, 1, top)],
          ] });
        }
    } else
      for (let j = 0; j + 1 < ys.length; j++)
        for (let i = 0; i + 1 < xs.length; i++) {
          const h = (z[j][i] + z[j][i + 1] + z[j + 1][i + 1] + z[j + 1][i]) / 4 / zmax;
          if (Number.isFinite(h)) out.push({ kind: 'quad', h, cell: [i, j], points: [node(z, i, j), node(z, i + 1, j), node(z, i + 1, j + 1), node(z, i, j + 1)] });
        }
    if (overlay)
      for (let j = 0; j + 1 < ys.length; j++)
        for (let i = 0; i + 1 < xs.length; i++) {
          const h = (overlay[j][i] + overlay[j][i + 1] + overlay[j + 1][i + 1] + overlay[j + 1][i]) / 4 / zmax;
          if (Number.isFinite(h)) out.push({ kind: 'overlay', h, bias: 0.01, points: [node(overlay, i, j), node(overlay, i + 1, j), node(overlay, i + 1, j + 1), node(overlay, i, j + 1)] });
        }
    if (zSample)
      for (let j = 0; j < ys.length; j++)
        for (let i = 0; i < xs.length; i++) {
          const v = zSample[j]?.[i];
          if (!(v > zmax * 1e-3)) continue;
          const px = unit(xs[i], x0, x1), py = unit(ys[j], y0, y1);
          out.push({ kind: 'stem', h: 0, bias: 0.02, points: [[px, py, ZLO], [px, py, ZLO + clamp(v / zmax, 0, 1.2)]] });
        }
    return out;
  }, [xs, ys, z, zSample, overlay, bars, x0, x1, y0, y1, zmax]);

  const model = useRef<Model | null>(null);
  model.current = { items, xs, ys, z, zmax, x0, x1, y0, y1, wall, cursor };

  /** Writes every view-dependent element for the current camera. Called after each React commit and by the turn. */
  const paint = useRef(() => {
    const m = model.current, svg = svgRef.current;
    if (!m || !svg) return;
    const v = view.current;
    const P = (x: number, y: number, zz: number) => project([x, y, zz], v, VIEWPORT);
    const wx = (q: number) => unit(q, m.x0, m.x1), wy = (q: number) => unit(q, m.y0, m.y1), wz = (q: number) => ZLO + clamp(q / m.zmax, 0, 1.2);
    const on = (cell?: [number, number]) => (m.cursor && cell && m.cursor[0] === cell[0] && m.cursor[1] === cell[1] ? ' data-on="true"' : '');
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const floor = corners.map(([x, y]) => P(x, y, ZLO));
    const centre = P(0, 0, 0);
    const yEdge = P(0, -1, ZLO).depth < P(0, 1, ZLO).depth ? -1 : 1;
    const xEdge = P(-1, 0, ZLO).depth < P(1, 0, ZLO).depth ? -1 : 1;
    const zCorner = corners.reduce((best, c) => (P(c[0], c[1], ZLO).x < P(best[0], best[1], ZLO).x ? c : best), corners[0]);
    const zFoot = P(zCorner[0], zCorner[1], ZLO), zHead = P(zCorner[0], zCorner[1], ZLO + 1);
    const zLeft = zFoot.x <= centre.x;
    const out = (p: { x: number; y: number }, d: number) => {
      const vx = p.x - centre.x, vy = p.y - centre.y, n = Math.hypot(vx, vy) || 1;
      return { x: p.x + (vx / n) * d, y: p.y + (vy / n) * d, ux: vx / n };
    };
    const anchor = (ux: number) => (ux > 0.35 ? 'start' : ux < -0.35 ? 'end' : 'middle') as 'start' | 'middle' | 'end';

    if (layer.box.current) layer.box.current.innerHTML = `<path d="${pathOf(floor)}Z"/>` + corners.map(([x, y], i) => {
      const top = P(x, y, ZLO + 1);
      return `<line x1="${floor[i].x}" y1="${floor[i].y}" x2="${top.x}" y2="${top.y}"/>`;
    }).join('');

    if (layer.wall.current) {
      // #86: a reference curve on the far wall, the plane y = far edge.
      let html = '';
      if (m.wall) {
        const yFar = -yEdge, w = m.wall;
        const pts = w.x.map((x, k) => P(wx(x), yFar, wz(w.z[k]))).filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
        const frame = [P(-1, yFar, ZLO), P(1, yFar, ZLO), P(1, yFar, ZLO + 1), P(-1, yFar, ZLO + 1)];
        html = `<g class="surface-wall"><path class="surface-wall-plane" d="${pathOf(frame)}Z"/><path class="surface-wall-curve" d="${pathOf(pts)}"/></g>`;
      }
      layer.wall.current.innerHTML = html;
    }

    if (layer.items.current) {
      const parts: string[] = [];
      for (const { item, points } of quadsByDepth(m.items, v, VIEWPORT)) {
        const cell = item.cell ? ` data-i="${item.cell[0]}" data-j="${item.cell[1]}"` : '';
        if (item.kind === 'quad') parts.push(`<path class="surface-quad"${cell}${on(item.cell)} style="--h: ${clamp(item.h, 0, 1)}" d="${pathOf(points)}Z"/>`);
        else if (item.kind === 'overlay') parts.push(`<path class="surface-overlay" d="${pathOf(points)}Z"/>`);
        else if (item.kind === 'bar') {
          // Only the two sides that face the camera, then the top: a box needs no more.
          const faces = item.faces!.map((f, k) => ({ k, pts: f.map((q) => P(q[0], q[1], q[2])) }))
            .filter(({ k, pts }) => k === 4 || pts.reduce((sum, q) => sum + q.depth, 0) / 4 < points[0].depth)
            .map(({ k, pts }) => `<path class="${k === 4 ? 'surface-bar-top' : 'surface-bar-side'}" d="${pathOf(pts)}Z"/>`).join('');
          parts.push(`<g class="surface-bar3d"${cell}${on(item.cell)} style="--h: ${clamp(item.h, 0, 1)}">${faces}</g>`);
        } else parts.push(`<g class="surface-stem"><line x1="${points[0].x}" y1="${points[0].y}" x2="${points[1].x}" y2="${points[1].y}"/><circle cx="${points[1].x}" cy="${points[1].y}" r="1.8"/></g>`);
      }
      layer.items.current.innerHTML = parts.join('');
    }

    if (layer.cursor.current) {
      let html = '';
      const c = m.cursor;
      if (c && c[0] < m.xs.length && c[1] < m.ys.length) {
        const val = m.z[c[1]]?.[c[0]] ?? NaN;
        const q = P(wx(m.xs[c[0]]), wy(m.ys[c[1]]), Number.isFinite(val) ? wz(val) : ZLO);
        const f = P(wx(m.xs[c[0]]), wy(m.ys[c[1]]), ZLO);
        html = `<g class="surface-cursor"><line x1="${f.x}" y1="${f.y}" x2="${q.x}" y2="${q.y}"/><circle cx="${q.x}" cy="${q.y}" r="4"/></g>`;
      }
      layer.cursor.current.innerHTML = html;
    }

    if (layer.axis.current) {
      const xt = niceTicks(m.x0, m.x1, 4), yt = niceTicks(m.y0, m.y1, 4), zt = niceTicks(0, m.zmax, 3);
      const text = (x: number, y: number, a: string, s: string) => `<text x="${x}" y="${y}" text-anchor="${a}">${esc(s)}</text>`;
      layer.axis.current.innerHTML =
        `<path d="${pathOf([P(-1, yEdge, ZLO), P(1, yEdge, ZLO)])}"/>` +
        `<path d="${pathOf([P(xEdge, -1, ZLO), P(xEdge, 1, ZLO)])}"/>` +
        `<path d="${pathOf([zFoot, zHead])}"/>` +
        xt.map((q) => { const o = out(P(wx(q), yEdge, ZLO), 11); return text(o.x, o.y + 3, anchor(o.ux), fmt(q, stepOf(xt))); }).join('') +
        yt.map((q) => { const o = out(P(xEdge, wy(q), ZLO), 11); return text(o.x, o.y + 3, anchor(o.ux), fmt(q, stepOf(yt))); }).join('') +
        zt.filter((q) => q !== 0).map((q) => { const p = P(zCorner[0], zCorner[1], wz(q)); return text(p.x + (zLeft ? -7 : 7), p.y + 3, zLeft ? 'end' : 'start', fmt(q, stepOf(zt))); }).join('');
    }
    const ox = out(P(0, yEdge, ZLO), 32), oy = out(P(xEdge, 0, ZLO), 32);
    placeMath(title.x.current, ox.x, ox.y + 3, anchor(ox.ux), 200);
    placeMath(title.y.current, oy.x, oy.y + 3, anchor(oy.ux), 200);
    placeMath(title.z.current, zHead.x + (zLeft ? -7 : 7), zHead.y - 10, zLeft ? 'end' : 'start', 200);
    svg.setAttribute('data-yaw', v.yaw.toFixed(3));
    svg.__paints = (svg.__paints ?? 0) + 1;
  });
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (svg) svg.__commits = (svg.__commits ?? 0) + 1;
    paint.current();
  });

  /** The idle turn: a rAF loop only while on screen, in a visible tab, not reduced and not held; it paints without React. */
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    if (reduced) { view.current = DEFAULT_VIEW; paint.current(); return; }
    let raf = 0, last = 0, acc = 0, inView = true;
    const tick = (now: number) => {
      raf = 0;
      if (!inView || document.hidden) { last = 0; return; }
      const dt = last ? now - last : 0;
      last = now;
      if (!drag.current && now >= heldUntil.current) {
        acc += dt;
        // About 30 frames a second: smooth for a slow turn, half the work of 60.
        if (acc >= 33) {
          const step = Math.min(acc, 100);
          acc = 0;
          view.current = { ...view.current, yaw: view.current.yaw + step * SPIN };
          paint.current();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const wake = () => { if (!raf && inView && !document.hidden) raf = requestAnimationFrame(tick); };
    const sleep = () => { cancelAnimationFrame(raf); raf = 0; last = 0; };
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
      inView = entries.at(-1)!.isIntersecting;
      if (inView) wake(); else sleep();
    });
    io?.observe(el);
    const vis = () => (document.hidden ? sleep() : wake());
    document.addEventListener('visibilitychange', vis);
    wake();
    return () => { sleep(); io?.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, [reduced]);

  const setView = (next: View) => { view.current = next; paint.current(); };
  const rotate = (dyaw: number, dpitch: number) => {
    hold();
    const v = view.current;
    setView({ yaw: v.yaw + dyaw, pitch: clamp(v.pitch + dpitch, PITCH_RANGE[0], PITCH_RANGE[1]) });
  };
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!e.isPrimary || e.button !== 0) return;
    const active = e.pointerType !== 'touch';
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active };
    if (active) e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.active) {
      const direction = touchDragDirection(dx, dy);
      if (direction === 'pending') return;
      if (direction === 'vertical') {
        drag.current = null;
        return;
      }
      d.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    rotate(dx * 0.008, e.pointerType === 'touch' ? 0 : dy * 0.008);
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const endDrag = (e: PointerEvent<SVGSVGElement>) => {
    if (e.type === 'lostpointercapture' && e.target !== e.currentTarget) return;
    if (drag.current?.id === e.pointerId) {
      if (drag.current.active) hold();
      drag.current = null;
    }
  };
  /** The hovered quad or bar sets the cursor (one listener for the whole layer). */
  const onItemOver = (e: PointerEvent<SVGGElement>) => {
    if (drag.current) return;
    const el = (e.target as Element).closest?.('[data-i]');
    if (el) setCursor([Number(el.getAttribute('data-i')), Number(el.getAttribute('data-j'))]);
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'Escape' && cursor) { setCursor(null); return; }
    if (e.shiftKey) {
      // Shift + arrows: walk the keyboard cursor over the grid nodes.
      const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      const m = d[e.key];
      if (!m) return;
      e.preventDefault();
      hold();
      setCursor((c) => {
        const [i, j] = c ?? [Math.floor(xs.length / 2), Math.floor(ys.length / 2)];
        return [clamp(i + m[0], 0, xs.length - 1), clamp(j + m[1], 0, ys.length - 1)];
      });
      return;
    }
    const step = 0.08;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = move[e.key];
    if (!m) return;
    e.preventDefault();
    rotate(m[0], m[1]);
  };

  const heading = surface.title ?? t(`Joint density of ${labels.x} and ${labels.y}`, `Совместная плотность ${labels.x} и ${labels.y}`);
  const aria = t(
    `${mathToPlain(heading)}: 3D surface of the theoretical density ${mathToPlain(labels.z)} over ${mathToPlain(labels.x)} and ${mathToPlain(labels.y)}` +
    `${zSample ? ', with the sample density drawn as stems' : ''}.`,
    `${mathToPlain(heading)}: трёхмерная поверхность теоретической плотности ${mathToPlain(labels.z)} над ${mathToPlain(labels.x)} и ${mathToPlain(labels.y)}` +
    `${zSample ? ', выборочная плотность показана столбиками' : ''}.`,
  );

  return (
    <figure className="surface">
      <div className="surface-bar">
        <span className="surface-heading"><MathText text={heading} /></span>
        <Button variant="ghost" onClick={() => setView(DEFAULT_VIEW)}><RotateCcw size={14} aria-hidden /> {t('Reset view', 'Сбросить вид')}</Button>
      </div>
      <svg
        ref={svgRef} className="surface-svg" viewBox={`0 0 ${W} ${H}`} role="img" tabIndex={0} aria-label={aria} aria-describedby={hintId}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        onLostPointerCapture={endDrag} onKeyDown={onKeyDown}
      >
        <g ref={layer.box} className="surface-box" aria-hidden="true" />
        <g ref={layer.wall} aria-hidden="true" />
        <g ref={layer.items} aria-hidden="true" onPointerOver={onItemOver} onPointerLeave={() => setCursor(null)} />
        <g ref={layer.cursor} aria-hidden="true" />
        <g className="surface-axis" aria-hidden="true">
          <g ref={layer.axis} />
          <g ref={title.x}><SvgMathText className="surface-title" x={0} y={0} text={labels.x} width={200} /></g>
          <g ref={title.y}><SvgMathText className="surface-title" x={0} y={0} text={labels.y} width={200} /></g>
          <g ref={title.z}><SvgMathText className="surface-title" x={0} y={0} text={labels.z} width={200} /></g>
        </g>
      </svg>
      <figcaption>
        <span className="chart-key chart-key--line tone-signal"><i /><MathText text={keyLabel ?? shown.keyLabel ?? t(`Theory ${labels.z}`, `Теория ${labels.z}`)} /></span>
        {zSample && <span className="surface-key-sample"><i /><MathText text={shown.sampleLabel ?? t('Sample density (2D histogram)', 'Выборочная плотность (двумерная гистограмма)')} /></span>}
        {overlay && <span className="surface-key-overlay"><i /><MathText text={shown.overlayLabel ?? t('Approximation', 'Приближение')} /></span>}
        {wall && <span className="surface-key-wall"><i /><MathText text={wall.label} /></span>}
        <span className="surface-readout" aria-live="polite">
          {cursor && cursor[0] < xs.length && cursor[1] < ys.length
            ? <MathText text={`$${labels.x.replace(/\$/g, '')} = ${sig4(xs[cursor[0]])}$, $${labels.y.replace(/\$/g, '')} = ${sig4(ys[cursor[1]])}$, ${labels.z.includes('$') ? labels.z : `$${labels.z}$`} $= ${sig4(z[cursor[1]][cursor[0]])}$${shown.rowNotes?.[cursor[1]] ? `; ${shown.rowNotes[cursor[1]]}` : ''}`} />
            : null}
        </span>
        <span id={hintId} className="surface-hint">{t('Drag or arrow keys turn it; Shift + arrows or the pointer read a point.', 'Поворачивайте перетаскиванием или стрелками; Shift + стрелки или указатель показывают значения в точке.')}</span>
      </figcaption>
    </figure>
  );
}

/** Deep equality of plain JSON-like data (numbers, strings, arrays, objects). */
function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameData(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a as object), kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!sameData((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  return true;
}

/**
 * #196: a station re-renders often (autoplay, readouts); the surface renders again only when its data or labels
 * really changed, so an unchanged surface costs no React work at all.
 */
export const Surface3D = memo(Surface3DView, (a, b) => a.keyLabel === b.keyLabel && sameData(a.surface, b.surface));
