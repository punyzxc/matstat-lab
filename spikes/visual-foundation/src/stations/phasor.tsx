import { useEffect, useMemo, useRef, useState } from 'react';
import { t as tr, useLang } from '../i18n';
import { useStationReducedMotion } from '../motion-preference';
import type { Phasor as Data } from './kernel-contract';

/**
 * #121: the characteristic function on the complex plane. Every sampled value x_j is the unit vector e^{itx_j};
 * the bold arrow is their mean, the empirical φ̂(t), and the ring marks the exact φ(t) on its curve. When the
 * parameter t sweeps by itself it runs a triangle wave over [−T, T]; the strips on the right trace Re φ and Im φ
 * with a cursor at the same t. Dragging along a strip (or the arrow keys on it) stops the sweep and sets t.
 */
const R = 118, C = 146, PLANE = 300;
const SW = 380, SH = 112, SX = 318, GAP = 40, PERIOD = 14000;
const fmt = (v: number) => (Math.abs(v) < 5e-4 ? '0' : v.toFixed(3));
const tick = (v: number) => (Math.abs(Math.abs(v) - 2 * Math.PI) < 1e-9 ? `${v < 0 ? '−' : ''}2π` : `${v < 0 ? '−' : ''}${Number(Math.abs(v).toFixed(2))}`);

function lerpExact(ts: number[], exact: [number, number][], t: number): [number, number] {
  if (t <= ts[0]) return exact[0];
  if (t >= ts[ts.length - 1]) return exact[exact.length - 1];
  const h = (ts[ts.length - 1] - ts[0]) / (ts.length - 1);
  const i = Math.min(ts.length - 2, Math.floor((t - ts[0]) / h));
  const w = (t - ts[i]) / (ts[i + 1] - ts[i]);
  return [exact[i][0] + w * (exact[i + 1][0] - exact[i][0]), exact[i][1] + w * (exact[i + 1][1] - exact[i][1])];
}

export function Phasor({ phasor, onParam }: { phasor: Data; onParam: (key: string, v: number) => void }) {
  useLang();
  const reduced = useStationReducedMotion();
  const { xs, shown, T, ts, exact } = phasor;
  const parts = phasor.parts ?? [];
  const product = parts.length > 0;
  const sweeping = phasor.motion && !reduced;
  const [tNow, setTNow] = useState(phasor.t);
  const start = useRef<number | null>(null);

  const section = useRef<HTMLElement>(null);
  /**
   * #196: the sweep sets t at most about 30 times a second (one React render each), and only while the station is
   * on screen and the tab is visible; otherwise its loop is cancelled and the wave resumes where it stood.
   */
  useEffect(() => {
    if (!sweeping) { setTNow(phasor.t); return; }
    const el = section.current;
    let raf = 0, lastSet = -Infinity, inView = true, pausedAt: number | null = null;
    // Start the wave at the typed t, rising, so switching to the sweep does not jump.
    const t0 = Math.max(-T, Math.min(T, phasor.t));
    const offset = ((t0 + T) / (4 * T)) * PERIOD;
    start.current = null;
    const frame = (now: number) => {
      raf = 0;
      if (start.current === null) start.current = now - offset;
      if (pausedAt !== null) { start.current += now - pausedAt; pausedAt = null; }
      if (now - lastSet >= 33) {
        lastSet = now;
        const ph = ((now - start.current) % PERIOD) / PERIOD;
        setTNow(-T + 4 * T * (ph < 0.5 ? ph : 1 - ph));
      }
      raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf && inView && !document.hidden) raf = requestAnimationFrame(frame); };
    const sleep = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; pausedAt = performance.now(); } };
    const io = !el || typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
      inView = entries.at(-1)!.isIntersecting;
      if (inView) wake(); else sleep();
    });
    if (el) io?.observe(el);
    const vis = () => (document.hidden ? sleep() : wake());
    document.addEventListener('visibilitychange', vis);
    wake();
    return () => { cancelAnimationFrame(raf); raf = 0; io?.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, [sweeping, phasor.t, T]);

  const { tips, mean } = useMemo(() => {
    let re = 0, im = 0;
    const tips: [number, number][] = [];
    xs.forEach((x, j) => {
      const c = Math.cos(tNow * x), s = Math.sin(tNow * x);
      re += c; im += s;
      if (j < shown) tips.push([c, s]);
    });
    return { tips, mean: [re / xs.length, im / xs.length] as [number, number] };
  }, [xs, shown, tNow]);
  const ex = lerpExact(ts, exact, tNow);
  const factors = parts.map((part) => ({ key: part.key, z: lerpExact(ts, part.exact, tNow) }));
  const px = (re: number) => C + R * re, py = (im: number) => C - R * im;
  const curve = useMemo(() => exact.map(([a, b], i) => `${i ? 'L' : 'M'}${(C + R * a).toFixed(1)},${(C - R * b).toFixed(1)}`).join(''), [exact]);
  const sx = (v: number) => SX + ((v + T) / (2 * T)) * SW;
  const strip = (k: 0 | 1, top: number, src: [number, number][] = exact) => src.map((z, i) => `${i ? 'L' : 'M'}${sx(ts[i]).toFixed(1)},${(top + SH / 2 - (SH / 2 - 6) * z[k]).toFixed(1)}`).join('');

  const setFromPointer = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const v = -T + ((e.clientX - box.left) / box.width) * 2 * T;
    onParam('motion', 1);
    onParam('t', Number(Math.max(-T, Math.min(T, v)).toFixed(2)));
  };
  const onKey = (e: React.KeyboardEvent<SVGRectElement>) => {
    const step = e.shiftKey ? T / 10 : T / 100;
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : 0;
    if (!d) return;
    e.preventDefault();
    onParam('motion', 1);
    onParam('t', Number(Math.max(-T, Math.min(T, tNow + d)).toFixed(2)));
  };
  const drag = useRef(false);

  return (
    <section ref={section} className="phasor" aria-label={tr('Characteristic function on the complex plane', 'Характеристическая функция на комплексной плоскости')} data-sweep={sweeping || undefined}>
      <div className="ph-head">
        <span className="ph-t" data-t={tNow.toFixed(3)}>t = {fmt(tNow)}</span>
        <span className="ph-emp">{tr('sample', 'выборочная')} φ{product && <sub>X+Y</sub>}(t) = {fmt(mean[0])} {mean[1] < 0 ? '−' : '+'} {fmt(Math.abs(mean[1]))}i</span>
        {factors.map((f) => <span key={f.key} className="ph-factor" data-part={f.key}>φ<sub>{f.key}</sub>(t) = {fmt(f.z[0])} {f.z[1] < 0 ? '−' : '+'} {fmt(Math.abs(f.z[1]))}i</span>)}
        <span className="ph-exact">{product ? <>φ<sub>X</sub>φ<sub>Y</sub></> : 'φ'}(t) = {fmt(ex[0])} {ex[1] < 0 ? '−' : '+'} {fmt(Math.abs(ex[1]))}i</span>
        <span className="ph-n">{tr(`${tips.length} of ${xs.length} vectors drawn; the mean uses all`, `показано ${tips.length} из ${xs.length} векторов; среднее — по всем`)}</span>
      </div>
      <svg viewBox={`0 0 ${SX + SW + 8} ${PLANE}`} role="img"
        aria-label={tr(`At t = ${fmt(tNow)} the mean of the unit vectors is ${fmt(mean[0])}, ${fmt(mean[1])}; the exact value is ${fmt(ex[0])}, ${fmt(ex[1])}`,
          `При t = ${fmt(tNow)} среднее единичных векторов ${fmt(mean[0])}; ${fmt(mean[1])}; точное значение ${fmt(ex[0])}; ${fmt(ex[1])}`)}>
        <line className="ph-axis" x1={C - R - 14} y1={C} x2={C + R + 14} y2={C} />
        <line className="ph-axis" x1={C} y1={C - R - 14} x2={C} y2={C + R + 14} />
        <text className="ph-tick" x={C + R + 12} y={C - 6} textAnchor="end">Re</text>
        <text className="ph-tick" x={C + 6} y={C - R - 4}>Im</text>
        <circle className="ph-unit" cx={C} cy={C} r={R} />
        <text className="ph-tick" x={C + R + 3} y={C + 13}>1</text>
        <g className="ph-vectors">
          {tips.map(([c, s], j) => <line key={j} x1={C} y1={C} x2={px(c)} y2={py(s)} />)}
        </g>
        <g className="ph-tips">
          {tips.map(([c, s], j) => <circle key={j} cx={px(c)} cy={py(s)} r={1.6} />)}
        </g>
        <path className="ph-curve" d={curve} />
        {factors.map((f) => (
          <g key={f.key} className="ph-factor-arrow" data-part={f.key}>
            <line x1={C} y1={C} x2={px(f.z[0])} y2={py(f.z[1])} />
            <circle cx={px(f.z[0])} cy={py(f.z[1])} r={3} />
            <text x={px(f.z[0]) + 6} y={py(f.z[1]) - 6}>φ{f.key === 'X' ? 'ₓ' : 'ᵧ'}</text>
          </g>
        ))}
        <circle className="ph-exact-dot" cx={px(ex[0])} cy={py(ex[1])} r={6} />
        <line className="ph-mean" x1={C} y1={C} x2={px(mean[0])} y2={py(mean[1])} />
        <circle className="ph-mean-dot" data-re={mean[0].toFixed(4)} data-im={mean[1].toFixed(4)} cx={px(mean[0])} cy={py(mean[1])} r={3.6} />

        {([0, 1] as const).map((k) => {
          const top = k === 0 ? 24 : 24 + SH + GAP;
          const zero = top + SH / 2;
          const yv = (v: number) => zero - (SH / 2 - 6) * v;
          return (
            <g key={k} className="ph-strip" data-part={k ? 'im' : 're'}>
              <text className="ph-tick" x={SX} y={top - 6}>{k ? 'Im' : 'Re'} {product ? 'φₓ, φᵧ, φₓφᵧ' : 'φ(t)'}</text>
              <line className="ph-axis" x1={SX} y1={zero} x2={SX + SW} y2={zero} />
              <line className="ph-grid" x1={SX} y1={yv(1)} x2={SX + SW} y2={yv(1)} />
              <line className="ph-grid" x1={SX} y1={yv(-1)} x2={SX + SW} y2={yv(-1)} />
              {parts.map((part) => <path key={part.key} className="ph-strip-part" data-part={part.key} d={strip(k, top, part.exact)} />)}
              <path className={k ? 'ph-strip-im' : 'ph-strip-re'} d={strip(k, top)} />
              <line className="ph-cursor" x1={sx(tNow)} y1={top} x2={sx(tNow)} y2={top + SH} />
              <circle className="ph-exact-dot" cx={sx(tNow)} cy={yv(ex[k])} r={4} />
              <circle className="ph-mean-dot" cx={sx(tNow)} cy={yv(mean[k])} r={3} />
              <text className="ph-tick" x={SX} y={top + SH + 12}>{tick(-T)}</text>
              <text className="ph-tick" x={SX + SW} y={top + SH + 12} textAnchor="end">{tick(T)}</text>
              <rect className="ph-hit" x={SX} y={top} width={SW} height={SH} tabIndex={k ? -1 : 0} role="slider"
                aria-label={tr('Parameter t', 'Параметр t')} aria-valuemin={-T} aria-valuemax={T} aria-valuenow={Number(tNow.toFixed(2))}
                onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); setFromPointer(e); }}
                onPointerMove={(e) => { if (drag.current) setFromPointer(e); }}
                onPointerUp={() => { drag.current = false; }}
                onKeyDown={onKey} />
            </g>
          );
        })}
      </svg>
    </section>
  );
}
