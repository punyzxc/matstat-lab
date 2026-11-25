import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { useStationReducedMotion } from '../motion-preference';
import { SPEEDS } from './autoplay-math.mjs';
import { t } from '../i18n';

/**
 * The shared autoplay engine. Every experiment plays by itself as soon as it opens: it grows a fresh
 * sample, then keeps drawing new ones. The person only stops it (Space) when they want to look
 * closer, steps one draw at a time (N), or changes the pace. Reduced motion opens it stopped.
 */
const speedKey = 'statum-lab:autoplay-speed';
const readSpeed = () => {
  try {
    const v = Number(localStorage.getItem(speedKey));
    return SPEEDS.includes(v) ? v : 1;
  } catch {
    return 1;
  }
};

export type Playback = {
  playing: boolean;
  setPlaying: (v: boolean | ((p: boolean) => boolean)) => void;
  speed: number;
  setSpeed: (v: number) => void;
};

export function usePlayback(): Playback {
  const reduced = useStationReducedMotion();
  const [playing, setPlaying] = useState(() => !reduced);
  const [speed, setSpeedState] = useState(readSpeed);
  const setSpeed = useCallback((v: number) => {
    setSpeedState(v);
    try {
      localStorage.setItem(speedKey, String(v));
    } catch {
      /* private mode: the pace lasts for this visit */
    }
  }, []);
  return { playing, setPlaying, speed, setSpeed };
}

/** Calls `tick` once after `delay` ms whenever `armed` is true; re-arms when `armed`/`token` change. Skips hidden tabs. */
export function useTicker(armed: boolean, delay: number, token: unknown, tick: () => void) {
  const latest = useRef(tick);
  latest.current = tick;
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  useEffect(() => {
    if (!armed || !visible) return;
    const t = window.setTimeout(() => latest.current(), delay);
    return () => clearTimeout(t);
  }, [armed, visible, delay, token]);
}

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(el.tagName) || el.getAttribute('role') === 'tab' || el.closest('svg[tabindex]') != null);

/** Space plays or stops, N draws once more. Ignored while typing or when a control has focus. */
export function useAutoplayKeys(onToggle: () => void, onStep: () => void) {
  const ref = useRef({ onToggle, onStep });
  ref.current = { onToggle, onStep };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        ref.current.onToggle();
      } else if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
        e.preventDefault();
        ref.current.onStep();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** The play bar: Stop/Play, one more draw, start over, pace, and what is happening now. */
export function AutoplayBar({
  playback,
  onStep,
  onRestart,
  status,
  progress,
  stepLabel = t('Next draw', 'Следующий прогон'),
  announce = false,
  progressLabel,
}: {
  playback: Playback;
  onStep: () => void;
  onRestart?: () => void;
  status: string;
  /** 0…1 while a fresh experiment grows; null once it runs steadily. */
  progress?: number | null;
  stepLabel?: string;
  /** Announce status changes to screen readers (only for statuses that change rarely). */
  announce?: boolean;
  progressLabel?: string;
}) {
  const { playing, setPlaying, speed, setSpeed } = playback;
  return (
    <div className="autoplay" data-playing={playing}>
      <div className="autoplay-controls">
        <button type="button" className="autoplay-main" aria-pressed={!playing} onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? t('Stop the experiment', 'Остановить эксперимент') : t('Play the experiment', 'Запустить эксперимент')} title={playing ? t('Stop (Space)', 'Стоп (пробел)') : t('Play (Space)', 'Пуск (пробел)')}>
          {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
          <span>{playing ? t('Stop', 'Стоп') : t('Play', 'Пуск')}</span>
        </button>
        <button type="button" className="autoplay-icon" onClick={onStep} aria-label={stepLabel} title={`${stepLabel} (N)`}>
          <StepForward size={15} aria-hidden />
        </button>
        {onRestart && (
          <button type="button" className="autoplay-icon" onClick={onRestart} aria-label={t('Start a fresh experiment', 'Начать эксперимент заново')} title={t('Start a fresh experiment', 'Начать эксперимент заново')}>
            <RotateCcw size={14} aria-hidden />
          </button>
        )}
        <div className="autoplay-speed" role="radiogroup" aria-label={t('Pace', 'Темп')}>
          {SPEEDS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={speed === s} onClick={() => setSpeed(s)}
              onKeyDown={(e) => {
                const k = SPEEDS.indexOf(speed);
                const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
                if (!d) return;
                e.preventDefault();
                const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, k + d))];
                setSpeed(next);
                (e.currentTarget.parentElement?.children[SPEEDS.indexOf(next)] as HTMLElement | undefined)?.focus();
              }}
              tabIndex={speed === s ? 0 : -1}>
              {s === 0.5 ? '½' : s}×
            </button>
          ))}
        </div>
      </div>
      <p className="autoplay-status">
        <span className={playing ? 'signal signal--active' : 'signal'} aria-hidden />
        <span role={announce ? 'status' : undefined} aria-live={announce ? 'polite' : 'off'}>{status}</span>
        <kbd title={t('Space stops or plays, N draws once more', 'Пробел — стоп и пуск, N — ещё один прогон')}>{t('Space · N', 'Пробел · N')}</kbd>
      </p>
      {progress != null && (
        <span className="autoplay-progress" style={{ ['--p' as string]: progress }}
          {...(progressLabel
            ? { role: 'progressbar', 'aria-label': progressLabel, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(progress * 100) }
            : { 'aria-hidden': true })} />
      )}
    </div>
  );
}
