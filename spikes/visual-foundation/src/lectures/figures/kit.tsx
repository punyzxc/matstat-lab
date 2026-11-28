import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MathText } from '../../math';
import { renderStride, useQualityProfile } from '../../quality';

/** What every live lecture figure receives from the story player. */
export type FigureProps = {
  beat: string;
  params: Record<string, number>;
  seed: number;
  /** The variable lit up in a formula, or null. */
  hot: string | null;
  onHot: (key: string | null) => void;
  playing: boolean;
  reduced: boolean;
  /** Bumps when the reader asks for a restart. */
  runKey: number;
  /** Live numbers for \lres in formulas; called a few times a second. */
  onResults: (r: Record<string, number | null>) => void;
};

export type Frame = { ctx: CanvasRenderingContext2D; w: number; h: number; dt: number; now: number; particleStride: number };

/** Frames drawn by one figure canvas, read by the e2e specs (`canvas.__frames`); a plain property, no DOM write. */
type CountedCanvas = HTMLCanvasElement & { __frames?: number };

/**
 * A crisp full-size canvas driven by `requestAnimationFrame` only while it can move: `running` is true, the tab is
 * visible and the canvas is in the viewport. Otherwise the loop is cancelled, not idled (#194). `frame` reads the
 * latest props through a ref, so the loop never restarts on a re-render. While stopped, a resize or a re-render
 * (a param change, a highlight, a "what if" chip) draws exactly one fresh frame with dt = 0, so the still image
 * stays correct. On resume the first frame has dt = 0, so the simulation goes on from where it stood.
 */
export function useCanvasLoop(frame: (f: Frame) => void, running: boolean) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const draw = useRef(frame);
  draw.current = frame;
  const run = useRef(running);
  run.current = running;
  const quality = useQualityProfile();
  const currentQuality = useRef(quality);
  currentQuality.current = quality;
  const control = useRef<{ wake: () => void; still: () => void; resize: () => void } | null>(null);
  useEffect(() => {
    const el = canvas.current! as CountedCanvas;
    const ctx = el.getContext('2d')!;
    let raf = 0, last = 0, w = 0, h = 0, inView = true;
    el.__frames = 0;
    const live = () => run.current && !document.hidden && inView;
    const size = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(currentQuality.current.dprCap, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      el.width = Math.max(1, Math.round(w * dpr));
      el.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const tick = (now: number) => {
      raf = 0;
      const moving = live();
      if (moving && last && now - last < currentQuality.current.frameMs - 0.5) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = moving && last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = moving ? now : 0;
      ctx.clearRect(0, 0, w, h);
      if (w > 0 && h > 0) draw.current({ ctx, w, h, dt, now, particleStride: renderStride(currentQuality.current.particleScale) });
      el.__frames = (el.__frames ?? 0) + 1;
      if (moving) raf = requestAnimationFrame(tick);
    };
    // Start the loop if it may move; a single fresh frame otherwise.
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const still = () => {
      if (!live() && raf) { cancelAnimationFrame(raf); raf = 0; last = 0; }
    };
    const resize = () => { size(); wake(); };
    control.current = { wake, still, resize };
    size();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const io = new IntersectionObserver((entries) => {
      inView = entries.at(-1)!.isIntersecting;
      if (inView) wake(); else still();
    });
    io.observe(el);
    const vis = () => (document.hidden ? still() : wake());
    document.addEventListener('visibilitychange', vis);
    wake();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
      control.current = null;
    };
  }, []);
  useEffect(() => { control.current?.resize(); }, [quality]);
  // Play starts the loop; Pause stops it after the frame in flight. While stopped, every re-render paints once.
  useEffect(() => {
    const c = control.current;
    if (!c) return;
    if (running) c.wake();
    else { c.still(); c.wake(); }
  });
  return canvas;
}

/** True when two shown-value records hold the same numbers (arrays and plain objects compared one level deep). */
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => {
    const x = (a as Record<string, unknown>)[k], y = (b as Record<string, unknown>)[k];
    if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((v, i) => Object.is(v, y[i]));
    return Object.is(x, y);
  });
}

/** `useState` whose setter keeps the old value when the new one holds the same numbers, so it causes no re-render. */
export function useSteadyState<T>(init: T): [T, (v: T) => void] {
  const [value, set] = useState(init);
  const steady = useCallback((v: T) => set((prev) => (same(prev, v) ? prev : v)), []);
  return [value, steady];
}

/**
 * Calls `report` at most every `ms` milliseconds with the latest value of `get`, and only when the values changed.
 * While `running` is false the timer is off; `get` then runs once after each render, so a param change while paused
 * still updates the numbers, and unchanged values are not reported again.
 */
export function useThrottledReport(get: () => Record<string, number | null>, report: (r: Record<string, number | null>) => void, ms = 120, running = true) {
  const g = useRef(get);
  g.current = get;
  const r = useRef(report);
  r.current = report;
  const sent = useRef('');
  const send = useRef(() => {
    const v = g.current();
    const key = JSON.stringify(v);
    if (key === sent.current) return;
    sent.current = key;
    r.current(v);
  });
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => { if (!document.hidden) send.current(); }, ms);
    return () => clearInterval(t);
  }, [ms, running]);
  useEffect(() => {
    if (!running) send.current();
  });
}

/** A typeset label pinned over the canvas at fractional coordinates. */
export function Label({ x, y, children, align = 'start', hot, dim, className, style }: {
  x: number; y: number; children: ReactNode; align?: 'start' | 'middle' | 'end'; hot?: boolean; dim?: boolean; className?: string; style?: CSSProperties;
}) {
  return (
    <div
      className={`figure-label figure-label--${align}${hot ? ' is-hot' : ''}${dim ? ' is-dim' : ''}${className ? ' ' + className : ''}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, ...style }}
    >
      {typeof children === 'string' ? <MathText text={children} /> : children}
    </div>
  );
}

export const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) ** 3);
export const easeInOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
