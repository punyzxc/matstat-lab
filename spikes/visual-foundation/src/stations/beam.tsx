import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { SvgMathText } from '../math';
import { t, useLang } from '../i18n';
import { useStationReducedMotion } from '../motion-preference';
import type { Beam as BeamData } from './kernel-contract';

/**
 * #132: the expectation as a centre of mass. The masses p_i hang from a beam at the points x_i and the beam rests
 * on a fulcrum at Mξ = Σ x_i p_i. When a value or a probability changes, the beam first tips about the old fulcrum
 * (the torque Σ (x_i − old) p_i = Mξ − old is no longer zero), then the fulcrum slides to the new Mξ and it levels.
 * Weights can be dragged along the beam or moved with the arrow keys; both change the typed parameter x_i.
 */
const W = 640, H = 210, PAD = 36, BEAM_Y = 96, HANG = 44, MAX_R = 26, MAX_TILT = 11;
const fmt = (v: number) => t(String(Number(v.toFixed(3))), String(Number(v.toFixed(3))).replace('.', ','));
const tex = (v: number) => t(String(Number(v.toFixed(3))), String(Number(v.toFixed(3))).replace('.', '{,}'));

export function Beam({ beam, onParam }: { beam: BeamData; onParam: (key: string, value: number) => void }) {
  useLang();
  const reduced = useStationReducedMotion();
  const [lo, hi] = beam.range;
  const px = (x: number) => PAD + ((x - lo) / (hi - lo)) * (W - 2 * PAD);
  const fromPx = (p: number) => lo + ((p - PAD) / (W - 2 * PAD)) * (hi - lo);

  // The drawn state (pivot in data units, tilt in degrees) eases toward a target; the target tips, then levels.
  const [pose, setPose] = useState({ pivot: beam.mean, angle: 0 });
  const target = useRef({ pivot: beam.mean, angle: 0 });
  const timer = useRef<number | undefined>(undefined);
  /** #196: starts the easing loop; it stops by itself once the pose reaches its target. */
  const kick = useRef<() => void>(() => {});
  useEffect(() => {
    window.clearTimeout(timer.current);
    if (reduced) {
      target.current = { pivot: beam.mean, angle: 0 };
      setPose(target.current);
      return;
    }
    const old = target.current.pivot;
    const torque = beam.mean - old; // Σ (x_i − old) p_i, since Σ p_i = 1
    if (Math.abs(torque) < 1e-9) return;
    // Positive torque: more moment to the right, the right end goes down (clockwise in screen coordinates).
    target.current = { pivot: old, angle: Math.max(-MAX_TILT, Math.min(MAX_TILT, torque * 9)) };
    kick.current();
    timer.current = window.setTimeout(() => { target.current = { pivot: beam.mean, angle: 0 }; kick.current(); }, 320);
    return () => window.clearTimeout(timer.current);
  }, [beam.mean, reduced]);
  const svg = useRef<SVGSVGElement & { __frames?: number }>(null);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    // The pose the loop last wrote: the loop ends on the frame it lands on the target.
    let at = { pivot: beam.mean, angle: 0 };
    const tick = () => {
      raf = 0;
      const g = target.current, k = 0.16;
      const next = { pivot: at.pivot + (g.pivot - at.pivot) * k, angle: at.angle + (g.angle - at.angle) * k };
      const done = Math.abs(next.pivot - g.pivot) < 1e-4 && Math.abs(next.angle - g.angle) < 1e-3;
      at = done ? g : next;
      setPose(at);
      const el = svg.current;
      if (el) el.__frames = (el.__frames ?? 0) + 1;
      if (!done) raf = requestAnimationFrame(tick);
    };
    kick.current = () => { if (!raf) raf = requestAnimationFrame(tick); };
    kick.current();
    return () => { cancelAnimationFrame(raf); kick.current = () => {}; };
  }, [reduced]);

  const cx = px(pose.pivot), rad = (pose.angle * Math.PI) / 180;
  /** A point of the beam at data value x, after the tilt about the pivot. */
  const onBeam = (x: number) => ({ x: cx + (px(x) - cx) * Math.cos(rad), y: BEAM_Y + (px(x) - cx) * Math.sin(rad) });
  const left = onBeam(lo), right = onBeam(hi);

  const drag = useRef<number | null>(null);
  const snap = (v: number) => Math.min(hi, Math.max(lo, Math.round(v / beam.step) * beam.step));
  const toData = (e: PointerEvent) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return snap(fromPx(pt.x));
  };
  const move = (e: PointerEvent) => {
    if (drag.current == null) return;
    const v = toData(e);
    if (v != null && v !== beam.x[drag.current]) onParam(beam.keys[drag.current], Number(v.toFixed(6)));
  };
  const key = (i: number) => (e: KeyboardEvent) => {
    const d = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    onParam(beam.keys[i], Number(snap(beam.x[i] + d * (e.shiftKey ? 1 : beam.step)).toFixed(6)));
  };
  const ticks = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
  const summary = t(`Beam: masses ${beam.p.map(fmt).join(', ')} at ${beam.x.map(fmt).join(', ')}; fulcrum at Mξ = ${fmt(beam.mean)}`,
    `Рычаг: массы ${beam.p.map(fmt).join('; ')} в точках ${beam.x.map(fmt).join('; ')}; опора в Mξ = ${fmt(beam.mean)}`);

  return (
    <section className="beam" aria-label={t('Centre of mass', 'Центр масс')}>
      <p className="beam-head">
        <b>{t('Centre of mass', 'Центр масс')}</b> · {t('drag a weight or use the arrow keys; the fulcrum finds the balance', 'перетащите груз или нажмите стрелки; опора сама найдёт равновесие')}
      </p>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} data-reduced={reduced || undefined}
        onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <g className="beam-axis">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={px(v)} x2={px(v)} y1={H - 30} y2={H - 25} />
              <text x={px(v)} y={H - 12}>{t(String(v), String(v).replace('-', '−'))}</text>
            </g>
          ))}
          <line x1={px(lo)} x2={px(hi)} y1={H - 30} y2={H - 30} />
        </g>
        <line className="beam-xbar" x1={px(beam.sampleMean)} x2={px(beam.sampleMean)} y1={BEAM_Y + 8} y2={H - 30} />
        <polygon className="beam-fulcrum" data-mean={beam.mean} points={`${cx},${BEAM_Y + 4} ${cx - 13},${BEAM_Y + 30} ${cx + 13},${BEAM_Y + 30}`} />
        <SvgMathText className="beam-mean-label" x={cx} y={BEAM_Y + 52} anchor="middle" width={170} text={`$M\\xi = ${tex(beam.mean)}$`} />
        <line className="beam-bar" x1={left.x} y1={left.y} x2={right.x} y2={right.y} />
        {beam.x.map((x, i) => {
          const at = onBeam(x), r = Math.max(3, MAX_R * Math.sqrt(beam.p[i])), cy = at.y - HANG;
          return (
            <g key={beam.keys[i]} className="beam-weight" data-weight={i + 1}>
              <line x1={at.x} y1={at.y} x2={at.x} y2={cy + r} />
              <circle cx={at.x} cy={cy} r={r} tabIndex={0} role="slider"
                aria-label={t(`Weight ${i + 1}: value x${i + 1}`, `Груз ${i + 1}: значение x${i + 1}`)}
                aria-valuemin={lo} aria-valuemax={hi} aria-valuenow={x} aria-valuetext={fmt(x)}
                onPointerDown={(e) => { drag.current = i; (e.target as Element).setPointerCapture?.(e.pointerId); }}
                onPointerMove={move} onKeyDown={key(i)} />
              <text className="beam-mass" x={at.x} y={cy - r - 6}>{fmt(beam.p[i])}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
