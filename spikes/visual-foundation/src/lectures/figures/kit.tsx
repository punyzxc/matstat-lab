import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { MathText } from '../../math';

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

export type Frame = { ctx: CanvasRenderingContext2D; w: number; h: number; dt: number; now: number };

/**
 * A crisp full-size canvas redrawn every animation frame. `frame` reads the latest props through a ref,
 * so the loop never restarts on a re-render. dt is 0 while `running` is false (paused, hidden tab).
 */
export function useCanvasLoop(frame: (f: Frame) => void, running: boolean) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const draw = useRef(frame);
  draw.current = frame;
  const run = useRef(running);
  run.current = running;
  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext('2d')!;
    let raf = 0, last = performance.now(), w = 0, h = 0;
    const size = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      el.width = Math.max(1, Math.round(w * dpr));
      el.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    const tick = (now: number) => {
      const dt = run.current && !document.hidden ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      ctx.clearRect(0, 0, w, h);
      if (w > 0 && h > 0) draw.current({ ctx, w, h, dt, now });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  return canvas;
}

/** Calls `report` at most every `ms` milliseconds with the latest value of `get`. */
export function useThrottledReport(get: () => Record<string, number | null>, report: (r: Record<string, number | null>) => void, ms = 120) {
  const g = useRef(get);
  g.current = get;
  const r = useRef(report);
  r.current = report;
  useEffect(() => {
    const t = window.setInterval(() => r.current(g.current()), ms);
    return () => clearInterval(t);
  }, [ms]);
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
