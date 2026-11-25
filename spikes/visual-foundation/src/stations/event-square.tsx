import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { MathText } from '../math';
import { t, useLang } from '../i18n';
import { useStationReducedMotion } from '../motion-preference';
import type { EventSquare as Data } from './kernel-contract';

/**
 * #117: conditional probability as shrinking the world to B. A (a vertical strip) and B (a rectangle on the floor)
 * live in the unit square; their edges can be dragged or moved with the arrow keys, which changes the typed
 * parameters. "Condition on B" slides everything so that B fills the square: the outside leaves the picture,
 * and the part of A that is left is P(A | B). The points are the first throws of the draw the readouts count.
 */
const W = 300;
type Handle = 'a' | 's' | 'b' | 'h';
const fmt = (v: number) => t(String(Number(v.toFixed(3))), String(Number(v.toFixed(3))).replace('.', ','));
const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function EventSquare({ square, onParam, drawKey }: { square: Data; onParam: (key: string, value: number) => void; drawKey: number }) {
  useLang();
  const reduced = useStationReducedMotion();
  const [given, setGiven] = useState(false);
  const { A, B, P, keys, step, points, cls, independent } = square;
  const bw = B[1] - B[0], bh = B[3] - B[2];
  const canCondition = bw > 0 && bh > 0;
  const zoom = given && canCondition;
  // Square coordinates (y up) → view units, before and after conditioning on B.
  const X = (x: number) => (zoom ? (x - B[0]) / bw : x) * W;
  const Y = (y: number) => W - (zoom ? (y - B[2]) / bh : y) * W;
  const box = ([x0, x1, y0, y1]: number[]) => ({ x: X(x0), y: Y(y1), width: Math.max(0, X(x1) - X(x0)), height: Math.max(0, Y(y0) - Y(y1)) });

  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ handle: Handle; x0: number; s0: number } | null>(null);
  const snap = (v: number) => Number((Math.round(clamp(v) / step) * step).toFixed(6));
  const toSquare = (e: PointerEvent) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x / W, y: (W - pt.y) / W };
  };
  // Keys pressed faster than the kernel answers build on the last value sent, not on the last result.
  const latest = useRef({ ...keys });
  const shown = useRef(keys);
  if (shown.current !== keys) {
    shown.current = keys;
    latest.current = { ...keys };
  }
  const set = (handle: Handle, v: number) => {
    const next = snap(v);
    if (next === latest.current[handle]) return;
    latest.current = { ...latest.current, [handle]: next };
    onParam(handle, next);
  };
  const start = (handle: Handle) => (e: PointerEvent) => {
    if (zoom) return;
    const p = toSquare(e);
    if (!p) return;
    drag.current = { handle, x0: p.x, s0: latest.current.s };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    const d = drag.current, p = d && toSquare(e);
    if (!d || !p) return;
    if (d.handle === 'a') set('a', p.x);
    else if (d.handle === 'b') set('b', p.x - latest.current.s);
    else if (d.handle === 'h') set('h', p.y);
    else set('s', d.s0 + (p.x - d.x0));
  };
  const end = () => { drag.current = null; };
  const key = (handle: Handle) => (e: KeyboardEvent) => {
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0;
    if (!dir || zoom) return;
    e.preventDefault();
    e.stopPropagation();
    set(handle, latest.current[handle] + dir * step * (e.shiftKey ? 10 : 1));
  };
  const slider = (handle: Handle, label: string) => ({
    tabIndex: zoom ? -1 : 0, role: 'slider' as const, 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 1,
    'aria-valuenow': keys[handle], 'aria-valuetext': fmt(keys[handle]), onPointerDown: start(handle), onKeyDown: key(handle),
  });

  const a = box(A), b = box(B), ab = box([Math.max(A[0], B[0]), Math.min(A[1], B[1]), B[2], B[3]]);
  const summary = t(`A has area ${fmt(P.A)}, B ${fmt(P.B)}, their product ${fmt(P.AB)}; P(A | B) = ${P.AgB == null ? 'undefined' : fmt(P.AgB)}${independent ? '; A and B are independent' : ''}`,
    `Площадь A ${fmt(P.A)}, B ${fmt(P.B)}, их произведения ${fmt(P.AB)}; P(A | B) = ${P.AgB == null ? 'не определена' : fmt(P.AgB)}${independent ? '; A и B независимы' : ''}`);
  return (
    <section className="event-square" aria-label={t('Events in the unit square', 'События в единичном квадрате')} data-given={zoom || undefined} data-reduced={reduced || undefined}>
      <div className="es-head">
        <button type="button" className="es-given" aria-label={t('Condition on B', 'Условие B')} aria-pressed={zoom} disabled={!canCondition} onClick={() => setGiven((g) => !g)}>
          <MathText text={t('Condition on $B$', 'Условие $B$')} />
        </button>
        {independent ? (
          <span className="es-indep" data-independent>
            <MathText text={t('independent: $P(AB) = P(A)\\,P(B)$', 'независимы: $P(AB) = P(A)\\,P(B)$')} />
          </span>
        ) : (
          <span className="es-dep"><MathText text={t('dependent: $P(AB) \\ne P(A)\\,P(B)$', 'зависимы: $P(AB) \\ne P(A)\\,P(B)$')} /></span>
        )}
        <span className="es-hint">{zoom
          ? <MathText text={t(`only $B$ is left: the share of $A$ in it is $P(A \\mid B) = ${fmt(P.AgB ?? 0)}$`, `осталось только $B$: доля $A$ в нём — $P(A \\mid B) = ${fmt(P.AgB ?? 0)}$`)} />
          : t('drag the edges of A and B, or focus one and use the arrow keys', 'перетащите края A и B или выберите край и нажимайте стрелки')}</span>
      </div>
      <svg ref={svg} viewBox={`-12 -12 ${W + 24} ${W + 30}`} role="group" aria-label={summary} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <defs>
          <clipPath id="es-clip"><rect x={0} y={0} width={W} height={W} /></clipPath>
        </defs>
        <rect className="es-omega" x={0} y={0} width={W} height={W} />
        <g clipPath="url(#es-clip)">
          <rect className="es-a" {...a} style={a} />
          <rect className="es-b" {...b} style={b} />
          <rect className="es-ab" {...ab} style={ab} />
          <g key={drawKey}>
            {points.map(([x, y], i) => (
              <circle key={i} className="es-pt" data-c={cls[i]} cx={X(x)} cy={Y(y)} r={2} style={{ cx: X(x), cy: Y(y) }} />
            ))}
          </g>
          <text className="es-label" x={a.x + 6} y={Math.max(16, a.y + 16)}>A</text>
          <text className="es-label es-label-b" x={b.x + b.width - 6} y={b.y + 16} textAnchor="end">B</text>
        </g>
        {!zoom && (
          <g className="es-handles">
            <rect className="es-handle es-body" x={b.x + 8} y={b.y + 8} width={Math.max(0, b.width - 16)} height={Math.max(0, b.height - 16)} {...slider('s', t('Left edge of B', 'Левый край B'))} />
            <line className="es-handle" x1={a.x + a.width} x2={a.x + a.width} y1={0} y2={W} {...slider('a', t('Width of A', 'Ширина A'))} />
            <line className="es-handle" x1={b.x + b.width} x2={b.x + b.width} y1={b.y} y2={W} {...slider('b', t('Width of B', 'Ширина B'))} />
            <line className="es-handle" x1={b.x} x2={b.x + b.width} y1={b.y} y2={b.y} {...slider('h', t('Height of B', 'Высота B'))} />
          </g>
        )}
        <text className="es-tick" x={0} y={W + 14}>0</text>
        <text className="es-tick" x={W} y={W + 14} textAnchor="end">1</text>
        <text className="es-omega-label" x={W - 4} y={-2} textAnchor="end">Ω</text>
      </svg>
    </section>
  );
}
