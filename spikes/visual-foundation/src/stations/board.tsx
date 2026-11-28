import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { touchDragDirection } from '../touch-drag';
import { t, useLang } from '../i18n';
import { project } from './surface-math.mjs';
import { useStationReducedMotion } from '../motion-preference';
import type { Board as Data } from './kernel-contract';

/**
 * #90: the throws themselves. Buffon's needles fall onto ruled lines `d` apart and light up when they cross one;
 * darts land in the unit square over the typed region. Every mark is one of the throws the readouts count, so the
 * picture and the numbers come from the same draw.
 */
const S = 100; // view units per board unit
const fmt = (v: number) => String(Number(v.toPrecision(3))).replace('.', t('.', ','));

export function Board({ board, drawKey, onFocusLine }: { board: Data; drawKey: number; onFocusLine?: (line: number | null) => void }) {
  useLang();
  const reduced = useStationReducedMotion();
  if (board.kind === 'chords') return <Chords board={board} drawKey={drawKey} reduced={reduced} onFocusLine={onFocusLine} />;
  if (board.kind === 'segment') return <Segment board={board} drawKey={drawKey} reduced={reduced} />;
  if (board.kind === 'cube') return <Cube board={board} drawKey={drawKey} reduced={reduced} />;
  return board.kind === 'needles' ? <Needles board={board} drawKey={drawKey} reduced={reduced} /> : <Darts board={board} drawKey={drawKey} reduced={reduced} />;
}

/**
 * #124: Bertrand's paradox as three circles, one per way of taking "a chord at random". Each draws its own chords;
 * those longer than the side √3 of the inscribed triangle are lit. Hovering or focusing a circle lights its line
 * of the live formula.
 */
const METHOD: Record<string, [string, string]> = {
  radius: ['a point on a radius', 'точка на радиусе'],
  endpoints: ['random endpoints', 'случайные концы'],
  midpoint: ['a midpoint in the disc', 'середина в круге'],
};
const EXACT: Record<string, string> = { radius: '1/2', endpoints: '1/3', midpoint: '1/4' };
function Chords({ board, drawKey, reduced, onFocusLine }: { board: Extract<Data, { kind: 'chords' }>; drawKey: number; reduced: boolean; onFocusLine?: (line: number | null) => void }) {
  const R = 90;
  const tri = [0, 1, 2].map((k) => { const a = Math.PI / 2 + (2 * Math.PI * k) / 3; return `${R * Math.cos(a)},${-R * Math.sin(a)}`; }).join(' ');
  return (
    <figure className="board board--chords" data-reduced={reduced || undefined}>
      <figcaption className="board-head">
        <b>{t('Three ways to take a chord at random', 'Три способа взять хорду наудачу')}</b>
        <span>{t('lit: longer than the side √3 of the inscribed triangle', 'светятся хорды длиннее стороны √3 вписанного треугольника')}</span>
      </figcaption>
      <div className="chord-row">
        {board.circles.map((c, j) => {
          const [en, ru] = METHOD[c.id] ?? [c.label, c.label];
          const lit = c.long.filter(Boolean).length;
          return (
            <div key={c.id} className="chord-circle" data-method={c.id} tabIndex={0} role="group"
              aria-label={t(`${en}: ${lit} of the first ${c.chords.length} chords are long; share ${fmt(c.share)}, exact ${EXACT[c.id]}`, `${ru}: длинных ${lit} из первых ${c.chords.length} хорд; доля ${fmt(c.share)}, точно ${EXACT[c.id]}`)}
              onMouseEnter={() => onFocusLine?.(j)} onMouseLeave={() => onFocusLine?.(null)} onFocus={() => onFocusLine?.(j)} onBlur={() => onFocusLine?.(null)}>
              <svg viewBox={`${-R - 6} ${-R - 6} ${2 * R + 12} ${2 * R + 12}`} aria-hidden>
                <circle className="chord-disc" r={R} />
                <polygon className="chord-tri" points={tri} />
                <g key={drawKey}>
                  {c.chords.map(([x1, y1, x2, y2], i) => (
                    <line key={i} className="chord" data-long={c.long[i] || undefined} x1={x1 * R} y1={-y1 * R} x2={x2 * R} y2={-y2 * R} style={{ animationDelay: `${i * 18}ms` }} />
                  ))}
                </g>
              </svg>
              <div className="chord-caption">
                <span>{t(en, ru)}</span>
                <span className="chord-share" data-share={c.share}>{fmt(c.share)} <i>→ {EXACT[c.id]}</i></span>
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

function Needles({ board, drawKey, reduced }: { board: Extract<Data, { kind: 'needles' }>; drawKey: number; reduced: boolean }) {
  const { d, l, strips, width, needles, hits } = board;
  const W = width * S, H = strips * d * S, PAD = 0.5 * d * S;
  const crossed = hits.filter(Boolean).length;
  return (
    <figure className="board" data-reduced={reduced || undefined}>
      <figcaption className="board-head">
        <b>{t("Buffon's needle", 'Игла Бюффона')}</b>
        <span>{t(`l = ${fmt(l)}, d = ${fmt(d)}`, `l = ${fmt(l)}, d = ${fmt(d)}`)}</span>
        <span className="board-count" data-count={crossed}>{t(`${crossed} of the first ${needles.length} needles cross a line`, `${crossed} из первых ${needles.length} игл пересекают прямую`)}</span>
      </figcaption>
      <svg viewBox={`0 ${-PAD} ${W} ${H + 2 * PAD}`} role="img"
        aria-label={t(`Needles of length ${fmt(l)} dropped on lines ${fmt(d)} apart: ${crossed} of ${needles.length} cross a line`, `Иглы длины ${fmt(l)} на прямых через ${fmt(d)}: ${crossed} из ${needles.length} пересекают прямую`)}>
        {Array.from({ length: strips + 1 }, (_, k) => <line key={k} className="board-rule" x1={0} x2={W} y1={H - k * d * S} y2={H - k * d * S} />)}
        <g key={drawKey}>
          {needles.map(([cx, cy, th], i) => {
            const dx = (l / 2) * Math.cos(th) * S, dy = (l / 2) * Math.sin(th) * S;
            const x = cx * S, y = H - cy * S;
            return (
              <g key={i} className="board-needle" data-hit={hits[i] || undefined} style={{ animationDelay: `${i * 8}ms` }}>
                <line x1={x - dx} y1={y + dy} x2={x + dx} y2={y - dy} />
                <circle cx={x} cy={y} r={2.2} />
              </g>
            );
          })}
        </g>
      </svg>
    </figure>
  );
}

function Darts({ board, drawKey, reduced }: { board: Extract<Data, { kind: 'region' }>; drawKey: number; reduced: boolean }) {
  const { runs, darts, hits } = board;
  const W = 300, inside = hits.filter(Boolean).length;
  return (
    <figure className="board board--region" data-reduced={reduced || undefined}>
      <figcaption className="board-head">
        <b>{t('Darts in the unit square', 'Дротики в единичном квадрате')}</b>
        <span className="board-count" data-count={inside}>{t(`${inside} of the first ${darts.length} land in A`, `${inside} из первых ${darts.length} попали в A`)}</span>
      </figcaption>
      <svg viewBox={`-14 -8 ${W + 22} ${W + 28}`} role="img"
        aria-label={t(`The region A shaded in the unit square; ${inside} of ${darts.length} darts land in it`, `Область A закрашена в единичном квадрате; в неё попали ${inside} из ${darts.length} дротиков`)}>
        <rect className="board-square" x={0} y={0} width={W} height={W} />
        <path className="board-region" d={runs.map(([x, y, w, h]) => `M${x * W} ${W - (y + h) * W}h${w * W}v${h * W}h${-w * W}z`).join('')} />
        <g key={drawKey}>
          {darts.map(([x, y], i) => (
            <circle key={i} className="board-dart" data-hit={hits[i] || undefined} cx={x * W} cy={W - y * W} r={2.4} style={{ animationDelay: `${Math.min(i, 300) * 2}ms` }} />
          ))}
        </g>
        <text className="board-tick" x={0} y={W + 7} dominantBaseline="hanging">0</text>
        <text className="board-tick" x={W} y={W + 7} textAnchor="end" dominantBaseline="hanging">1</text>
        <text className="board-tick" x={-4} y={0} textAnchor="end" dominantBaseline="hanging">1</text>
      </svg>
    </figure>
  );
}

/** #119: points thrown into [0, 1]; the region A is shaded, hits lit. Height only spreads the marks so they can be seen. */
function Segment({ board, drawKey, reduced }: { board: Extract<Data, { kind: 'segment' }>; drawKey: number; reduced: boolean }) {
  const { intervals, darts, hits } = board;
  const W = 600, H = 70, inside = hits.filter(Boolean).length;
  return (
    <figure className="board board--segment" data-reduced={reduced || undefined}>
      <figcaption className="board-head">
        <b>{t('Points on the segment [0, 1]', 'Точки на отрезке [0, 1]')}</b>
        <span className="board-count" data-count={inside}>{t(`${inside} of the first ${darts.length} land in A`, `${inside} из первых ${darts.length} попали в A`)}</span>
      </figcaption>
      <svg viewBox={`-12 -6 ${W + 24} ${H + 34}`} role="img"
        aria-label={t(`The region A shaded on the segment from 0 to 1; ${inside} of ${darts.length} points land in it`, `Область A закрашена на отрезке от 0 до 1; в неё попали ${inside} из ${darts.length} точек`)}>
        {intervals.map(([x, w], i) => <rect key={i} className="board-region" x={x * W} y={0} width={w * W} height={H} />)}
        <g key={drawKey}>
          {darts.map(([x, h], i) => (
            <circle key={i} className="board-dart" data-hit={hits[i] || undefined} cx={x * W} cy={H - h * H} r={2.2} style={{ animationDelay: `${Math.min(i, 300) * 2}ms` }} />
          ))}
        </g>
        <line className="board-axis" x1={0} x2={W} y1={H + 8} y2={H + 8} />
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line className="board-axis" x1={v * W} x2={v * W} y1={H + 4} y2={H + 12} />
            <text className="board-tick" x={v * W} y={H + 16} textAnchor="middle" dominantBaseline="hanging">{fmt(v)}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

/**
 * #119: points thrown into the unit cube; the hits are lit, so they draw the region A themselves. The cube turns by
 * itself (not under reduced motion); dragging or the arrow keys turn it by hand.
 */
const CUBE_EDGES: [number, number][] = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
const CUBE_VIEW = { cx: 170, cy: 165, scale: 76 };
function Cube({ board, drawKey, reduced }: { board: Extract<Data, { kind: 'cube' }>; drawKey: number; reduced: boolean }) {
  const { darts, hits } = board;
  const [view, setView] = useState({ yaw: -0.7, pitch: 0.42 });
  const [held, setHeld] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; active: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  /** #196: the idle turn runs only while the cube is on screen and the tab is visible; otherwise its loop is cancelled. */
  useEffect(() => {
    const el = svgRef.current;
    if (reduced || held || !el) return;
    let raf = 0, last = 0, acc = 0, inView = true;
    const tick = (now: number) => {
      raf = 0;
      acc += last ? now - last : 0;
      last = now;
      // About 30 frames a second is smooth for a slow turn and halves the work.
      if (acc > 32) {
        const dt = Math.min(acc, 100);
        acc = 0;
        setView((v) => ({ ...v, yaw: v.yaw + dt * 0.00028 }));
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
  }, [reduced, held]);
  const turn = (dyaw: number, dpitch: number) => setView((v) => ({ yaw: v.yaw + dyaw, pitch: Math.min(1.25, Math.max(-0.2, v.pitch + dpitch)) }));
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const m: Record<string, [number, number]> = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08] };
    if (!m[e.key]) return;
    e.preventDefault();
    setHeld(true);
    turn(...m[e.key]);
  };
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!e.isPrimary || e.button !== 0) return;
    const active = e.pointerType !== 'touch';
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active };
    if (active) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setHeld(true);
    }
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
      setHeld(true);
    }
    turn(dx * 0.01, e.pointerType === 'touch' ? 0 : dy * 0.01);
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const endDrag = (e: PointerEvent<SVGSVGElement>) => {
    if (e.type === 'lostpointercapture' && e.target !== e.currentTarget) return;
    if (drag.current?.id !== e.pointerId) return;
    if (drag.current.active) setHeld(false);
    drag.current = null;
  };
  const P = (x: number, y: number, z: number) => project([2 * x - 1, 2 * y - 1, 2 * z - 1], view, CUBE_VIEW);
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => P(c & 1, (c >> 1) & 1, (c >> 2) & 1));
  const mid = (corners.reduce((s, c) => s + c.depth, 0) / 8);
  const pts = darts.map(([x, y, z], i) => ({ i, hit: hits[i], ...P(x, y, z) })).sort((a, b) => b.depth - a.depth);
  const inside = hits.filter(Boolean).length;
  const label = (x: number, y: number, z: number, text: string) => {
    const q = P(x, y, z);
    return <text className="board-tick cube-axis-label" x={q.x} y={q.y} textAnchor="middle" dominantBaseline="middle">{text}</text>;
  };
  return (
    <figure className="board board--cube" data-reduced={reduced || undefined}>
      <figcaption className="board-head">
        <b>{t('Points in the unit cube', 'Точки в единичном кубе')}</b>
        <span className="board-count" data-count={inside}>{t(`${inside} of the first ${darts.length} land in A`, `${inside} из первых ${darts.length} попали в A`)}</span>
      </figcaption>
      <svg ref={svgRef} viewBox="0 0 340 330" role="img" tabIndex={0} data-yaw={view.yaw.toFixed(3)}
        aria-label={t(`Points in the unit cube, ${inside} of ${darts.length} inside A and lit; drag or use the arrow keys to turn it`, `Точки в единичном кубе, ${inside} из ${darts.length} внутри A и подсвечены; поворачивайте перетаскиванием или стрелками`)}
        onKeyDown={onKeyDown} onBlur={() => setHeld(false)} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
        {CUBE_EDGES.map(([a, b], i) => (
          <line key={i} className="cube-edge" data-back={(corners[a].depth + corners[b].depth) / 2 > mid || undefined}
            x1={corners[a].x} y1={corners[a].y} x2={corners[b].x} y2={corners[b].y} />
        ))}
        <g key={drawKey}>
          {pts.map((p) => (
            <circle key={p.i} className="board-dart cube-dot" data-hit={p.hit || undefined} cx={p.x} cy={p.y}
              r={(p.hit ? 2.1 : 1.3) * (1 - p.depth * 0.12)} />
          ))}
        </g>
        {label(1.14, -0.08, -0.08, 'x')}
        {label(-0.08, 1.14, -0.08, 'y')}
        {label(-0.08, -0.08, 1.14, 'z')}
      </svg>
    </figure>
  );
}
