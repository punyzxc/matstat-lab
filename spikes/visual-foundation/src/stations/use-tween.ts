import { useLayoutEffect, useRef, useState } from 'react';
import { useStationReducedMotion } from '../motion-preference';
import { easeOutCubic } from './surface-math.mjs';

/**
 * Returns `target`, but when it changes, glides from the value currently shown to the new one over
 * `duration` ms with an ease-out. `mix(from, to, t)` returns the blend, or null when the two are not
 * comparable (then the value snaps). Reduced motion snaps. The frame loop is cancelled on unmount.
 */
export function useTween<T>(target: T, mix: (from: T, to: T, t: number) => T | null, duration = 280): T {
  const reduced = useStationReducedMotion();
  const [value, setValue] = useState(target);
  const shown = useRef(target);
  const frame = useRef(0);
  const mixRef = useRef(mix);
  mixRef.current = mix;
  useLayoutEffect(() => {
    cancelAnimationFrame(frame.current);
    const commit = (v: T) => {
      shown.current = v;
      setValue(v);
    };
    const from = shown.current;
    if (reduced || from === target || !mixRef.current(from, target, 0)) {
      commit(target);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      if (k >= 1) return commit(target);
      commit(mixRef.current(from, target, easeOutCubic(k)) ?? target);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, reduced, duration]);
  return value;
}
