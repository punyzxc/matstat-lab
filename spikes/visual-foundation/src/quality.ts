import { useEffect, useSyncExternalStore } from 'react';

export type QualityLevel = 'high' | 'medium' | 'low';
export type QualityProfile = Readonly<{
  level: QualityLevel;
  dprCap: number;
  frameMs: number;
  particleScale: number;
  blur: boolean;
}>;

export const qualityLevels = {
  high: { level: 'high', dprCap: 1.75, frameMs: 1000 / 60, particleScale: 1, blur: true },
  medium: { level: 'medium', dprCap: 1.25, frameMs: 1000 / 30, particleScale: 0.5, blur: true },
  low: { level: 'low', dprCap: 1, frameMs: 1000 / 25, particleScale: 0.25, blur: false },
} as const satisfies Record<QualityLevel, QualityProfile>;

type DeviceSignals = {
  cores?: number;
  memory?: number;
  coarse: boolean;
  pixelArea: number;
  saveData: boolean;
};

export function chooseQuality({ cores, memory, coarse, pixelArea, saveData }: DeviceSignals): QualityProfile {
  const atMost = (value: number | undefined, limit: number) => value !== undefined && value > 0 && value <= limit;
  if (saveData || atMost(cores, 2) || atMost(memory, 2)) return qualityLevels.low;
  if (coarse || atMost(cores, 4) || atMost(memory, 4) || pixelArea > 5_000_000) return qualityLevels.medium;
  return qualityLevels.high;
}

/** Subsample only the marks drawn from an existing sample; its simulation and readouts stay intact. */
export const renderStride = (scale: number) => Math.round(1 / scale);

const FRAME_WINDOW_MS = 3000;
const SLOW_FRAME_MS = 33;

export function createFrameMonitor() {
  let start: number | undefined;
  let last = 0;
  const frames: number[] = [];

  function reset() {
    start = undefined;
    frames.length = 0;
  }

  function sample(now: number): number | undefined {
    if (start === undefined) {
      start = last = now;
      return;
    }
    frames.push(now - last);
    last = now;
    if (now - start < FRAME_WINDOW_MS) return;

    frames.sort((a, b) => a - b);
    const middle = Math.floor(frames.length / 2);
    const median = frames.length % 2 ? frames[middle] : (frames[middle - 1] + frames[middle]) / 2;
    reset();
    start = now;
    return median;
  }

  return { sample, reset };
}

const STORAGE_KEY = 'statum-lab:quality';
const valid = (value: string | null): value is QualityLevel => value === 'high' || value === 'medium' || value === 'low';

function readOverride(): QualityLevel | null {
  const url = new URLSearchParams(window.location.search).get('quality');
  try {
    if (valid(url)) window.localStorage.setItem(STORAGE_KEY, url);
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (valid(saved)) return saved;
  } catch { /* The URL still forces a profile when storage is unavailable. */ }
  return valid(url) ? url : null;
}

function readDevice() {
  const nav = window.navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return chooseQuality({
    cores: nav.hardwareConcurrency,
    memory: nav.deviceMemory,
    coarse: window.matchMedia('(pointer: coarse)').matches,
    pixelArea: window.innerWidth * window.innerHeight * (window.devicePixelRatio || 1) ** 2,
    saveData: Boolean(nav.connection?.saveData || window.matchMedia('(prefers-reduced-data: reduce)').matches),
  });
}

const override = typeof window === 'undefined' ? null : readOverride();
let profile: QualityProfile =
  typeof window === 'undefined' ? qualityLevels.high : override ? qualityLevels[override] : readDevice();
let downgraded = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = () => profile;

export function useQualityProfile() {
  return useSyncExternalStore(subscribe, snapshot, () => qualityLevels.high);
}

/** Mounted once by the app. Forced profiles and hidden tabs don't spend time sampling frames. */
export function useAdaptiveQuality() {
  const quality = useQualityProfile();
  useEffect(() => {
    document.documentElement.dataset.quality = quality.level;
    document.documentElement.dataset.qualityBlur = quality.blur ? 'on' : 'off';
  }, [quality]);
  useEffect(() => {
    if (override || downgraded || profile.level === 'low') return;
    const monitor = createFrameMonitor();
    let raf = 0;

    function measure(now: number) {
      const median = monitor.sample(now);
      if (median !== undefined && median > SLOW_FRAME_MS) {
        const previous = profile.level;
        profile = previous === 'high' ? qualityLevels.medium : qualityLevels.low;
        downgraded = true;
        if (import.meta.env?.DEV) {
          console.info(`STATUM LAB quality: ${previous} → ${profile.level}, median ${median.toFixed(1)} ms`);
        }
        listeners.forEach((listener) => listener());
        return;
      }
      raf = window.requestAnimationFrame(measure);
    }

    function visibility() {
      window.cancelAnimationFrame(raf);
      monitor.reset();
      if (!document.hidden && !downgraded) raf = window.requestAnimationFrame(measure);
    }

    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
}
