import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { useStationReducedMotion } from '../motion-preference';
import { SPEEDS, clampSpeed, parseNumberInput } from './autoplay-math.mjs';
import { t } from '../i18n';

/**
 * The shared autoplay engine. Every experiment plays by itself as soon as it opens: it grows a fresh
 * sample, then keeps drawing new ones. The person only stops it (Space) when they want to look
 * closer, steps one draw at a time (N), or changes the pace. Reduced motion opens it stopped.
 */
const speedKey = 'statum-lab:autoplay-speed';
const readSpeed = () => {
  try {
    const raw = localStorage.getItem(speedKey);
    return raw == null ? 1 : clampSpeed(Number(raw));
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

/**
 * Space plays or stops, N draws once more; ← and → move one draw back or forward (#113) when `onArrow` is given.
 * Ignored while typing or when a control has focus.
 */
export function useAutoplayKeys(onToggle: () => void, onStep: () => void, onArrow?: (d: -1 | 1) => void, onSnap?: () => void) {
  const ref = useRef({ onToggle, onStep, onArrow, onSnap });
  ref.current = { onToggle, onStep, onArrow, onSnap };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        ref.current.onToggle();
      } else if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
        e.preventDefault();
        ref.current.onStep();
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && ref.current.onArrow) {
        e.preventDefault();
        ref.current.onArrow(e.key === 'ArrowLeft' ? -1 : 1);
      } else if ((e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы') && ref.current.onSnap) {
        e.preventDefault();
        ref.current.onSnap();
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
  timeline,
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
  /** The time machine (#113): the draw on screen, the furthest draw reached, and a jump to any draw. */
  timeline?: Timeline;
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
              {s === 0.25 ? '¼' : s === 0.5 ? '½' : s}×
            </button>
          ))}
        </div>
        <TypedNumber className="autoplay-pace" label={t('Pace, typed multiplier', 'Темп, введённый множитель')} value={speed} suffix="×"
          onCommit={(v) => setSpeed(clampSpeed(v))} />
      </div>
      {timeline && <TimelineRow timeline={timeline} />}
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

export type Timeline = { draw: number; reach: number; onDraw: (d: number) => void };

/** A small typed number box: commits on Enter or blur, shows the committed value otherwise. */
function TypedNumber({ label, value, onCommit, className, suffix }: { label: string; value: number; onCommit: (v: number) => void; className?: string; suffix?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft == null) return;
    const v = parseNumberInput(draft);
    setDraft(null);
    if (v != null) onCommit(v);
  };
  return (
    <label className={className}>
      <input type="text" inputMode="decimal" aria-label={label} value={draft ?? String(value)} spellCheck={false}
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') setDraft(null); }} />
      {suffix && <span aria-hidden>{suffix}</span>}
    </label>
  );
}

/** The time machine row (#113): back, a scrubber over the draws reached so far, the typed draw number, forward. */
function TimelineRow({ timeline }: { timeline: Timeline }) {
  const { draw, reach, onDraw } = timeline;
  const top = Math.max(reach, draw);
  return (
    <div className="autoplay-timeline" role="group" aria-label={t('Time machine', 'Машина времени')}>
      <button type="button" className="autoplay-icon" onClick={() => onDraw(draw - 1)} disabled={draw <= 1}
        aria-label={t('Previous draw', 'Предыдущий прогон')} title={t('Previous draw (←)', 'Предыдущий прогон (←)')}>
        <ChevronLeft size={15} aria-hidden />
      </button>
      <input type="range" className="autoplay-scrub" min={1} max={Math.max(2, top)} step={1} value={draw} disabled={top < 2}
        aria-label={t('Draw on screen', 'Прогон на экране')} aria-valuetext={t(`draw ${draw} of ${top}`, `прогон ${draw} из ${top}`)}
        onChange={(e) => onDraw(Number(e.target.value))} />
      <button type="button" className="autoplay-icon" onClick={() => onDraw(draw + 1)}
        aria-label={t('Following draw', 'Следующий прогон')} title={t('Following draw (→)', 'Следующий прогон (→)')}>
        <ChevronRight size={15} aria-hidden />
      </button>
      <TypedNumber className="autoplay-draw" label={t('Draw number, typed value', 'Номер прогона, введённое значение')} value={draw}
        onCommit={(v) => onDraw(Math.max(1, Math.round(v)))} />
      <span className="autoplay-reach">{t(`of ${top}`, `из ${top}`)}</span>
    </div>
  );
}
