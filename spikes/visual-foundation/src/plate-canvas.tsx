import { useEffect, useRef } from 'react';

export type Frame = {
  width: number;
  height: number;
  dpr: number;
  time: number;
  yaw: number;
  mesh: boolean;
  cue: number;
};
export type Renderer = { draw: (frame: Frame) => void; dispose?: () => void };
export type RendererFactory = (canvas: HTMLCanvasElement) => Renderer | null;

export function PlateCanvas({
  create,
  fallback,
  label,
  playing,
  mesh,
  cue,
}: {
  create: RendererFactory;
  fallback?: RendererFactory;
  label: string;
  playing: boolean;
  mesh: boolean;
  cue: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ playing, mesh, cue });
  const restart = useRef<() => void>(() => {});
  useEffect(() => {
    state.current = { playing, mesh, cue };
    restart.current();
  }, [playing, mesh, cue]);
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
    const small = navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4;
    const frame: Frame = { width: 0, height: 0, dpr: 1, time: 0, yaw: 0, mesh: false, cue };
    let raf = 0,
      last = 0,
      visible = true,
      slowFrames = 0;
    let interval = small ? 45 : 32;
    let pointer: { id: number; start: number; yaw: number } | null = null;
    function draw() {
      if (!frame.width || !frame.height) return;
      frame.mesh = state.current.mesh;
      frame.cue = state.current.cue;
      const start = performance.now();
      engine.draw(frame);
      if (performance.now() - start > 24 && ++slowFrames > 4) interval = 64;
    }
    function loop(now: number) {
      if (now - last >= interval || !last) {
        if (last) {
          const delta = now - last;
          frame.time += Math.min(delta / 1000, 0.12);
          if (delta > 80 && ++slowFrames > 6) interval = 64;
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
      frame.dpr = Math.min(devicePixelRatio || 1, small ? 1.25 : 1.75);
      canvas.width = Math.max(1, Math.round(rect.width * frame.dpr));
      canvas.height = Math.max(1, Math.round(rect.height * frame.dpr));
      refresh();
    }
    function down(e: PointerEvent) {
      if (!e.isPrimary || e.button !== 0) return;
      pointer = { id: e.pointerId, start: e.clientX, yaw: frame.yaw };
      box.setPointerCapture(e.pointerId);
    }
    function move(e: PointerEvent) {
      if (pointer?.id !== e.pointerId) return;
      frame.yaw = pointer.yaw + (e.clientX - pointer.start) * 0.009;
      draw();
    }
    function up() {
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
      interval = 55;
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
    resize();
    return () => {
      restart.current = () => {};
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
  }, [create, fallback, label]);
  return (
    <div
      className="plate-canvas"
      ref={host}
      tabIndex={0}
      role="group"
      aria-label="Rotate specimen with left and right arrow keys or by dragging horizontally"
    />
  );
}
