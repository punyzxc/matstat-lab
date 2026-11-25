import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
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

/** A rotatable SVG joint-density surface: theory as shaded quads, sample density as stems. */
export function Surface3D({ surface, keyLabel }: { surface: Surface; keyLabel?: string }) {
  const shown = useTween(surface, mixSurface);
  const [view, setView] = useState(DEFAULT_VIEW);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const hintId = useId();
  const { x: xs, y: ys, z, zSample, labels, overlay, wall } = shown;
  const bars = Boolean(shown.bars);
  /** #84: the camera turns by itself while idle and on screen; a drag or a key holds it for HOLD_MS; reduced motion keeps a still 3/4 view. */
  const reduced = useStationReducedMotion();
  const heldUntil = useRef(0);
  const hold = () => { heldUntil.current = performance.now() + HOLD_MS; };
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (reduced) { setView(DEFAULT_VIEW); return; }
    if (!onScreen) return;
    let raf = 0, last = performance.now(), acc = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!drag.current && now >= heldUntil.current) {
        acc += dt;
        // About 30 frames a second: smooth for a slow turn, half the work of 60.
        if (acc >= 33) {
          const step = Math.min(acc, 100);
          acc = 0;
          setView((v) => ({ ...v, yaw: v.yaw + step * SPIN }));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, onScreen]);
  /** The cell under the pointer or the keyboard cursor (Shift + arrows): its x, y and z are read out. */
  const [cursor, setCursor] = useState<[number, number] | null>(null);

  const { x0, x1, y0, y1, zmax } = useMemo(() => {
    const zTop = Math.max(finiteMax(z.flat()), zSample ? finiteMax(zSample.flat()) : 0, overlay ? finiteMax(overlay.flat()) : 0, wall ? finiteMax(wall.z) : 0);
    return {
      x0: finiteMin(xs), x1: finiteMax(xs), y0: finiteMin(ys), y1: finiteMax(ys),
      zmax: (Number.isFinite(zTop) && zTop > 0 ? zTop : 1) * 1.05,
    };
  }, [xs, ys, z, zSample, overlay, wall]);
  const wx = (v: number) => unit(v, x0, x1), wy = (v: number) => unit(v, y0, y1), wz = (v: number) => ZLO + clamp(v / zmax, 0, 1.2);

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
  const sorted = quadsByDepth(items, view, VIEWPORT);

  // Bounding box, axes and ticks, placed on the edges nearest the viewer.
  const P = (x: number, y: number, zz: number) => project([x, y, zz], view, VIEWPORT);
  const centre = P(0, 0, 0);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const floor = corners.map(([x, y]) => P(x, y, ZLO));
  const yEdge = P(0, -1, ZLO).depth < P(0, 1, ZLO).depth ? -1 : 1;
  const xEdge = P(-1, 0, ZLO).depth < P(1, 0, ZLO).depth ? -1 : 1;
  const zCorner = corners.reduce((best, c) => (P(c[0], c[1], ZLO).x < P(best[0], best[1], ZLO).x ? c : best), corners[0]);
  const zFoot = P(zCorner[0], zCorner[1], ZLO), zHead = P(zCorner[0], zCorner[1], ZLO + 1);
  const zLeft = zFoot.x <= centre.x;
  const out = (p: { x: number; y: number }, d: number) => {
    const vx = p.x - centre.x, vy = p.y - centre.y, n = Math.hypot(vx, vy) || 1;
    return { x: p.x + (vx / n) * d, y: p.y + (vy / n) * d, ux: vx / n };
  };
  const anchor = (ux: number) => (ux > 0.35 ? 'start' : ux < -0.35 ? 'end' : 'middle');
  const xt = niceTicks(x0, x1, 4), yt = niceTicks(y0, y1, 4), zt = niceTicks(0, zmax, 3);
  const axisTitle = (mid: number[], text: string) => {
    const o = out(P(mid[0], mid[1], ZLO), 32);
    return <SvgMathText className="surface-title" x={o.x} y={o.y + 3} anchor={anchor(o.ux)} text={text} width={200} />;
  };

  const rotate = (dyaw: number, dpitch: number) => {
    hold();
    setView((v) => ({ yaw: v.yaw + dyaw, pitch: clamp(v.pitch + dpitch, PITCH_RANGE[0], PITCH_RANGE[1]) }));
  };
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    rotate((e.clientX - d.x) * 0.008, (e.clientY - d.y) * 0.008);
    drag.current = { id: d.id, x: e.clientX, y: e.clientY };
  };
  const endDrag = (e: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.id === e.pointerId) {
      drag.current = null;
      hold();
    }
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

  const title = surface.title ?? t(`Joint density of ${labels.x} and ${labels.y}`, `Совместная плотность ${labels.x} и ${labels.y}`);
  const aria = t(
    `${mathToPlain(title)}: 3D surface of the theoretical density ${mathToPlain(labels.z)} over ${mathToPlain(labels.x)} and ${mathToPlain(labels.y)}` +
    `${zSample ? ', with the sample density drawn as stems' : ''}.`,
    `${mathToPlain(title)}: трёхмерная поверхность теоретической плотности ${mathToPlain(labels.z)} над ${mathToPlain(labels.x)} и ${mathToPlain(labels.y)}` +
    `${zSample ? ', выборочная плотность показана столбиками' : ''}.`,
  );

  return (
    <figure className="surface">
      <div className="surface-bar">
        <span className="surface-heading"><MathText text={title} /></span>
        <Button variant="ghost" onClick={() => setView(DEFAULT_VIEW)}><RotateCcw size={14} aria-hidden /> {t('Reset view', 'Сбросить вид')}</Button>
      </div>
      <svg
        ref={svgRef} data-yaw={view.yaw.toFixed(3)} className="surface-svg" viewBox={`0 0 ${W} ${H}`} role="img" tabIndex={0} aria-label={aria} aria-describedby={hintId}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={onKeyDown}
      >
        <g className="surface-box" aria-hidden="true">
          <path d={pathOf(floor) + 'Z'} />
          {corners.map(([x, y], i) => {
            const top = P(x, y, ZLO + 1);
            return <line key={i} x1={floor[i].x} y1={floor[i].y} x2={top.x} y2={top.y} />;
          })}
        </g>
        {wall && (() => {
          // #86: a reference curve on the far wall, the plane y = far edge.
          const yFar = -yEdge;
          const pts = wall.x.map((x, k) => P(wx(x), yFar, wz(wall.z[k]))).filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
          const frame = [P(-1, yFar, ZLO), P(1, yFar, ZLO), P(1, yFar, ZLO + 1), P(-1, yFar, ZLO + 1)];
          return (
            <g className="surface-wall" aria-hidden="true">
              <path className="surface-wall-plane" d={pathOf(frame) + 'Z'} />
              <path className="surface-wall-curve" d={pathOf(pts)} />
            </g>
          );
        })()}
        <g aria-hidden="true" onPointerLeave={() => setCursor(null)}>
          {sorted.map(({ item, points, index }) =>
            item.kind === 'quad' ? (
              <path key={index} className="surface-quad" data-on={cursor && item.cell && cursor[0] === item.cell[0] && cursor[1] === item.cell[1] || undefined}
                style={{ ['--h' as string]: clamp(item.h, 0, 1) }} d={pathOf(points) + 'Z'} onPointerEnter={() => item.cell && setCursor(item.cell)} />
            ) : item.kind === 'overlay' ? (
              <path key={index} className="surface-overlay" d={pathOf(points) + 'Z'} />
            ) : item.kind === 'bar' ? (
              <g key={index} className="surface-bar3d" style={{ ['--h' as string]: clamp(item.h, 0, 1) }}
                data-on={cursor && item.cell && cursor[0] === item.cell[0] && cursor[1] === item.cell[1] || undefined}
                onPointerEnter={() => item.cell && setCursor(item.cell)}>
                {item.faces!.map((f, k) => ({ f, k, pts: f.map((q) => P(q[0], q[1], q[2])) }))
                  // Only the two sides that face the camera, then the top: a box needs no more.
                  .filter(({ k, pts }) => k === 4 || pts.reduce((sum, q) => sum + q.depth, 0) / 4 < points[0].depth)
                  .map(({ k, pts }) => <path key={k} className={k === 4 ? 'surface-bar-top' : 'surface-bar-side'} d={pathOf(pts) + 'Z'} />)}
              </g>
            ) : (
              <g key={index} className="surface-stem">
                <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} />
                <circle cx={points[1].x} cy={points[1].y} r={1.8} />
              </g>
            ),
          )}
        </g>
        {cursor && cursor[0] < xs.length && cursor[1] < ys.length && (() => {
          const v = z[cursor[1]]?.[cursor[0]] ?? NaN;
          const q = P(wx(xs[cursor[0]]), wy(ys[cursor[1]]), Number.isFinite(v) ? wz(v) : ZLO);
          const f = P(wx(xs[cursor[0]]), wy(ys[cursor[1]]), ZLO);
          return (
            <g className="surface-cursor" aria-hidden="true">
              <line x1={f.x} y1={f.y} x2={q.x} y2={q.y} />
              <circle cx={q.x} cy={q.y} r={4} />
            </g>
          );
        })()}
        <g className="surface-axis" aria-hidden="true">
          <path d={pathOf([P(-1, yEdge, ZLO), P(1, yEdge, ZLO)])} />
          <path d={pathOf([P(xEdge, -1, ZLO), P(xEdge, 1, ZLO)])} />
          <path d={pathOf([zFoot, zHead])} />
          {xt.map((v) => {
            const o = out(P(wx(v), yEdge, ZLO), 11);
            return <text key={'x' + v} x={o.x} y={o.y + 3} textAnchor={anchor(o.ux)}>{fmt(v, stepOf(xt))}</text>;
          })}
          {yt.map((v) => {
            const o = out(P(xEdge, wy(v), ZLO), 11);
            return <text key={'y' + v} x={o.x} y={o.y + 3} textAnchor={anchor(o.ux)}>{fmt(v, stepOf(yt))}</text>;
          })}
          {zt.map((v) => {
            const p = P(zCorner[0], zCorner[1], wz(v));
            return <text key={'z' + v} x={p.x + (zLeft ? -7 : 7)} y={p.y + 3} textAnchor={zLeft ? 'end' : 'start'}>{fmt(v, stepOf(zt))}</text>;
          })}
          {axisTitle([0, yEdge], labels.x)}
          {axisTitle([xEdge, 0], labels.y)}
          <SvgMathText className="surface-title" x={zHead.x + (zLeft ? -7 : 7)} y={zHead.y - 10} anchor={zLeft ? 'end' : 'start'} text={labels.z} width={200} />
        </g>
      </svg>
      <figcaption>
        <span className="chart-key chart-key--line tone-signal"><i /><MathText text={keyLabel ?? t(`Theory ${labels.z}`, `Теория ${labels.z}`)} /></span>
        {zSample && <span className="surface-key-sample"><i /><MathText text={shown.sampleLabel ?? t('Sample density (2D histogram)', 'Выборочная плотность (двумерная гистограмма)')} /></span>}
        {overlay && <span className="surface-key-overlay"><i /><MathText text={shown.overlayLabel ?? t('Approximation', 'Приближение')} /></span>}
        {wall && <span className="surface-key-wall"><i /><MathText text={wall.label} /></span>}
        <span className="surface-readout" aria-live="polite">
          {cursor && cursor[0] < xs.length && cursor[1] < ys.length
            ? <MathText text={`$${labels.x.replace(/\$/g, '')} = ${sig4(xs[cursor[0]])}$, $${labels.y.replace(/\$/g, '')} = ${sig4(ys[cursor[1]])}$, ${labels.z.includes('$') ? labels.z : `$${labels.z}$`} $= ${sig4(z[cursor[1]][cursor[0]])}$`} />
            : null}
        </span>
        <span id={hintId} className="surface-hint">{t('Drag or arrow keys turn it; Shift + arrows or the pointer read a point.', 'Поворачивайте перетаскиванием или стрелками; Shift + стрелки или указатель показывают значения в точке.')}</span>
      </figcaption>
    </figure>
  );
}
