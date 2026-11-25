import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { MathText, SvgMathText, mathToPlain } from '../math';
import { RotateCcw } from 'lucide-react';
import { Button } from '../ui';
import type { Surface } from './kernel-contract';
import { clamp, lerpArray, lerpGrid, niceTicks, project, quadsByDepth, unit } from './surface-math.mjs';
import { useTween } from './use-tween';

const W = 680, H = 340;
const VIEWPORT = { cx: 340, cy: 180, scale: 112 };
const DEFAULT_VIEW = { yaw: -0.6, pitch: 0.55 };
const PITCH_RANGE: [number, number] = [-0.1, 1.2];
const ZLO = -0.5; // world z of the floor; the surface rises to ZLO + 1

/** Blend two surfaces on the same grid; null when the grid changed (then the surface snaps). */
function mixSurface(a: Surface, b: Surface, t: number): Surface | null {
  const same =
    a.x.length === b.x.length && a.y.length === b.y.length && a.z.length === b.z.length &&
    a.z[0]?.length === b.z[0]?.length && Boolean(a.zSample) === Boolean(b.zSample);
  if (!same) return null;
  return {
    ...b,
    x: lerpArray(a.x, b.x, t),
    y: lerpArray(a.y, b.y, t),
    z: lerpGrid(a.z, b.z, t),
    zSample: a.zSample && b.zSample ? lerpGrid(a.zSample, b.zSample, t) : b.zSample,
  };
}

const fmt = (v: number, step: number) => {
  const digits = Math.max(0, Math.min(4, -Math.floor(Math.log10(step) + 1e-9)));
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace('-', '−');
};
const stepOf = (t: number[]) => (t.length > 1 ? t[1] - t[0] : 1);
const finiteMin = (a: number[]) => a.reduce((m, v) => (Number.isFinite(v) && v < m ? v : m), Infinity);
const finiteMax = (a: number[]) => a.reduce((m, v) => (Number.isFinite(v) && v > m ? v : m), -Infinity);
const pathOf = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');

type Item = { points: number[][]; bias?: number; kind: 'quad' | 'stem'; h: number };

/** A rotatable SVG joint-density surface: theory as shaded quads, sample density as stems. */
export function Surface3D({ surface, keyLabel }: { surface: Surface; keyLabel?: string }) {
  const shown = useTween(surface, mixSurface);
  const [view, setView] = useState(DEFAULT_VIEW);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const hintId = useId();
  const { x: xs, y: ys, z, zSample, labels } = shown;

  const { x0, x1, y0, y1, zmax } = useMemo(() => {
    const zTop = Math.max(finiteMax(z.flat()), zSample ? finiteMax(zSample.flat()) : 0);
    return {
      x0: finiteMin(xs), x1: finiteMax(xs), y0: finiteMin(ys), y1: finiteMax(ys),
      zmax: (Number.isFinite(zTop) && zTop > 0 ? zTop : 1) * 1.05,
    };
  }, [xs, ys, z, zSample]);
  const wx = (v: number) => unit(v, x0, x1), wy = (v: number) => unit(v, y0, y1), wz = (v: number) => ZLO + clamp(v / zmax, 0, 1.2);

  const items = useMemo(() => {
    const out: Item[] = [];
    const node = (i: number, j: number) => [unit(xs[i], x0, x1), unit(ys[j], y0, y1), ZLO + clamp(z[j][i] / zmax, 0, 1.2)];
    for (let j = 0; j + 1 < ys.length; j++)
      for (let i = 0; i + 1 < xs.length; i++) {
        const h = (z[j][i] + z[j][i + 1] + z[j + 1][i + 1] + z[j + 1][i]) / 4 / zmax;
        if (Number.isFinite(h)) out.push({ kind: 'quad', h, points: [node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1)] });
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
  }, [xs, ys, z, zSample, x0, x1, y0, y1, zmax]);
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

  const rotate = (dyaw: number, dpitch: number) =>
    setView((v) => ({ yaw: v.yaw + dyaw, pitch: clamp(v.pitch + dpitch, PITCH_RANGE[0], PITCH_RANGE[1]) }));
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
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = 0.08;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = move[e.key];
    if (!m) return;
    e.preventDefault();
    rotate(m[0], m[1]);
  };

  const title = surface.title ?? `Joint density of ${labels.x} and ${labels.y}`;
  const aria =
    `${mathToPlain(title)}: 3D surface of the theoretical density ${mathToPlain(labels.z)} over ${mathToPlain(labels.x)} and ${mathToPlain(labels.y)}` +
    `${zSample ? ', with the sample density drawn as stems' : ''}.`;

  return (
    <figure className="surface">
      <div className="surface-bar">
        <span className="surface-heading"><MathText text={title} /></span>
        <Button variant="ghost" onClick={() => setView(DEFAULT_VIEW)}><RotateCcw size={14} aria-hidden /> Reset view</Button>
      </div>
      <svg
        className="surface-svg" viewBox={`0 0 ${W} ${H}`} role="img" tabIndex={0} aria-label={aria} aria-describedby={hintId}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={onKeyDown}
      >
        <g className="surface-box" aria-hidden="true">
          <path d={pathOf(floor) + 'Z'} />
          {corners.map(([x, y], i) => {
            const top = P(x, y, ZLO + 1);
            return <line key={i} x1={floor[i].x} y1={floor[i].y} x2={top.x} y2={top.y} />;
          })}
        </g>
        <g aria-hidden="true">
          {sorted.map(({ item, points, index }) =>
            item.kind === 'quad' ? (
              <path key={index} className="surface-quad" style={{ ['--h' as string]: clamp(item.h, 0, 1) }} d={pathOf(points) + 'Z'} />
            ) : (
              <g key={index} className="surface-stem">
                <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} />
                <circle cx={points[1].x} cy={points[1].y} r={1.8} />
              </g>
            ),
          )}
        </g>
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
        <span className="chart-key chart-key--line tone-signal"><i /><MathText text={keyLabel ?? `Theory ${labels.z}`} /></span>
        {zSample && <span className="surface-key-sample"><i /><MathText text={shown.sampleLabel ?? 'Sample density (2D histogram)'} /></span>}
        <span id={hintId} className="surface-hint">Drag or use arrow keys to rotate.</span>
      </figcaption>
    </figure>
  );
}
