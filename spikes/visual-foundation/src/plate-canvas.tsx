import { useEffect, useRef } from 'react';
import { t } from './i18n';
import { renderStride, useQualityProfile } from './quality';

export type Frame = {
  width: number;
  height: number;
  dpr: number;
  time: number;
  yaw: number;
  mesh: boolean;
  cue: number;
  particleStride: number;
};
export type Renderer = { draw: (frame: Frame) => void; dispose?: () => void };
export type RendererFactory = (canvas: HTMLCanvasElement) => Renderer | null;

/** #195: at most about 2.5 megapixels of backing store for one plate (1920×1080 at DPR 1.75 would be 6.4). */
export const MAX_PIXELS = 2_500_000;

export function PlateCanvas({
  create,
  fallback,
  label,
  playing,
  mesh,
  cue,
  maxFps,
}: {
  create: RendererFactory;
  fallback?: RendererFactory;
  label: string;
  playing: boolean;
  mesh: boolean;
  cue: number;
  /** #193: a cap on the frame rate, for a scene covered by a station or a lecture; the globe still turns. */
  maxFps?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const quality = useQualityProfile();
  const renderQuality = useRef(quality);
  renderQuality.current = quality;
  const state = useRef({ playing, mesh, cue, maxFps });
  const restart = useRef<() => void>(() => {});
  const resizePlate = useRef<() => void>(() => {});
  useEffect(() => {
    state.current = { playing, mesh, cue, maxFps };
    restart.current();
  }, [playing, mesh, cue, maxFps]);
  useEffect(() => { resizePlate.current(); }, [quality]);
  useEffect(() => {
    const box = host.current!;
    let canvas = document.createElement('canvas');
    let renderer = create(canvas);
    if (!renderer && fallback) {
      canvas = document.createElement('canvas');
      renderer = fallback(canvas);
    }
    if (!renderer) {
      box.textContent = label;
      return () => {
        box.textContent = '';
      };
    }
    let engine = renderer;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', label);
    box.append(canvas);
    const frame: Frame = { width: 0, height: 0, dpr: 1, time: 0, yaw: 0, mesh: false, cue, particleStride: 1 };
    let raf = 0, last = 0, visible = true;
    let fallbackInterval = 0;
    let pointer: { id: number; start: number; yaw: number; x: number; t: number } | null = null;
    // A released drag keeps a little spin that eases out, so a nudge feels physical.
    let spin = 0;
    function draw() {
      if (!frame.width || !frame.height) return;
      frame.mesh = state.current.mesh;
      frame.cue = state.current.cue;
      frame.particleStride = renderStride(renderQuality.current.particleScale);
      engine.draw(frame);
      // Frames drawn, read by the e2e specs (a plain property, no DOM write).
      (canvas as HTMLCanvasElement & { __frames?: number }).__frames = ((canvas as HTMLCanvasElement & { __frames?: number }).__frames ?? 0) + 1;
    }
    function loop(now: number) {
      const profile = renderQuality.current;
      const maxFps = state.current.maxFps;
      // Behind an open dock the low profile still rotates the Earth, with fewer canvas paints.
      const cap = maxFps ? 1000 / (profile.level === 'low' ? Math.min(5, maxFps) : maxFps) : 0;
      const interval = Math.max(profile.frameMs, cap, fallbackInterval);
      // Browser rAF timestamps are rounded, so a 100 ms cap needs to accept a 99.9 ms gap.
      if (now - last >= interval - 0.5 || !last) {
        if (last) {
          const delta = now - last;
          const step = Math.min(delta / 1000, cap ? cap / 1000 + 0.02 : 0.12);
          frame.time += step;
          if (spin && !pointer) {
            frame.yaw += spin * step;
            spin *= Math.exp(-step * 2.6);
            if (Math.abs(spin) < 0.01) spin = 0;
          }
        }
        last = now;
        draw();
      }
      raf = requestAnimationFrame(loop);
    }
    function refresh() {
      cancelAnimationFrame(raf);
      last = 0;
      if (!visible || document.hidden) return;
      draw();
      if (state.current.playing) raf = requestAnimationFrame(loop);
    }
    function resize() {
      const rect = box.getBoundingClientRect();
      frame.width = rect.width;
      frame.height = rect.height;
      // #195: the backing store is capped at MAX_PIXELS whatever the viewport; the DPR gives way first.
      const wanted = Math.min(devicePixelRatio || 1, renderQuality.current.dprCap);
      frame.dpr = Math.max(0.5, Math.min(wanted, Math.sqrt(MAX_PIXELS / Math.max(1, rect.width * rect.height)) * 0.999));
      canvas.width = Math.max(1, Math.round(rect.width * frame.dpr));
      canvas.height = Math.max(1, Math.round(rect.height * frame.dpr));
      refresh();
    }
    function down(e: PointerEvent) {
      if (!e.isPrimary || e.button !== 0) return;
      pointer = { id: e.pointerId, start: e.clientX, yaw: frame.yaw, x: e.clientX, t: e.timeStamp };
      spin = 0;
      box.setPointerCapture(e.pointerId);
    }
    function move(e: PointerEvent) {
      if (pointer?.id !== e.pointerId) return;
      frame.yaw = pointer.yaw + (e.clientX - pointer.start) * 0.006;
      const dt = Math.max(8, e.timeStamp - pointer.t);
      spin = Math.max(-2.4, Math.min(2.4, ((e.clientX - pointer.x) * 0.006 * 1000) / dt));
      pointer.x = e.clientX;
      pointer.t = e.timeStamp;
      if (!state.current.playing) draw();
    }
    function up(e: PointerEvent) {
      // A drag that stopped before release leaves no spin.
      if (!state.current.playing || (pointer && e.timeStamp - pointer.t > 90)) spin = 0;
      pointer = null;
    }
    function key(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      frame.yaw += e.key === 'ArrowLeft' ? -0.16 : 0.16;
      draw();
    }
    function contextLost(e: Event) {
      e.preventDefault();
      if (!fallback) return;
      const replacement = document.createElement('canvas'),
        cpu = fallback(replacement);
      if (!cpu) return;
      replacement.setAttribute('role', 'img');
      replacement.setAttribute('aria-label', label);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.replaceWith(replacement);
      engine.dispose?.();
      engine = cpu;
      canvas = replacement;
      fallbackInterval = 55;
      resize();
    }
    canvas.addEventListener('webglcontextlost', contextLost);
    const resizeObserver = new ResizeObserver(resize);
    const viewObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      refresh();
    });
    resizeObserver.observe(box);
    viewObserver.observe(box);
    document.addEventListener('visibilitychange', refresh);
    box.addEventListener('pointerdown', down);
    box.addEventListener('pointermove', move);
    box.addEventListener('lostpointercapture', up);
    box.addEventListener('keydown', key);
    restart.current = refresh;
    resizePlate.current = resize;
    resize();
    return () => {
      restart.current = () => {};
      resizePlate.current = () => {};
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      viewObserver.disconnect();
      document.removeEventListener('visibilitychange', refresh);
      box.removeEventListener('pointerdown', down);
      box.removeEventListener('pointermove', move);
      box.removeEventListener('lostpointercapture', up);
      box.removeEventListener('keydown', key);
      canvas.removeEventListener('webglcontextlost', contextLost);
      engine.dispose?.();
      canvas.remove();
    };
    // The label only names the canvas; a language switch relabels it below instead of rebuilding the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [create, fallback]);
  useEffect(() => {
    host.current?.querySelector('canvas')?.setAttribute('aria-label', label);
  }, [label]);
  return (
    <div
      className="plate-canvas"
      ref={host}
      tabIndex={0}
      role="group"
      aria-label={t('Rotate specimen with left and right arrow keys or by dragging horizontally', 'Поворачивайте фигуру стрелками влево и вправо или перетаскиванием по горизонтали')}
    />
  );
}
