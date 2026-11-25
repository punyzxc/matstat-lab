import { useEffect } from 'react';
import { ArrowLeft, ArrowRight, FlaskConical, Presentation } from 'lucide-react';
import { findStation } from '../stations/catalog';
import { lectureHash, stationHash } from '../stations/route';
import type { Lecture, Step } from './script';
import { MathText, Tex, mathToPlain } from '../math';
import { lectureFormula, lectureText, plural, t } from '../i18n';
import './lectures.css';
import { StoryPlayer } from './story';
import { Portrait } from './portrait';
export { Portrait };

import { findLecture, lectures } from './catalog';
export { findLecture, lectures };

/** The quiet drawer: the twelve lectures, each opening at its first step. */
export function LectureList({ present }: { present?: boolean }) {
  return (
    <ol className="lecture-list" aria-label={t('Lectures', 'Лекции')}>
      {lectures.map((l) => (
        <li key={l.lecture}>
          <a href={lectureHash({ n: l.lecture, step: 1, present })}>
            <span className="lecture-list-n">{t('L', 'Л')}{String(l.lecture).padStart(2, '0')}</span>
            <span className="lecture-list-title"><MathText text={lectureText(l.lecture, l.title)} /></span>
            <span className="lecture-list-meta">
              {l.steps.length} {t(l.steps.length === 1 ? 'step' : 'steps', plural(l.steps.length, 'шаг', 'шага', 'шагов'))}
              {l.status !== 'ready' && <i> · {t('draft', 'черновик')}</i>}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/**
 * One lecture, one step at a time. The hash is the state: `#lecture/<n>/<step>[?present=1]`.
 * ← → (and PageUp/PageDown, which presentation clickers send) move between steps, Home/End jump, P toggles presenter mode.
 */
export function LecturePlayer(props: { lecture: Lecture; step: number; present: boolean }) {
  // keyed by lecture: a portal's "go there" opens another lecture with a fresh player
  return props.lecture.story ? <StoryPlayer key={props.lecture.lecture} {...props} /> : <StepPlayer key={props.lecture.lecture} {...props} />;
}

function StepPlayer({ lecture, step, present }: { lecture: Lecture; step: number; present: boolean }) {
  const total = lecture.steps.length;
  const index = Math.min(Math.max(step, 1), total);
  const current = lecture.steps[index - 1];
  const go = (next: number, presenting = present) => {
    const target = lectureHash({ n: lecture.lecture, step: Math.min(Math.max(next, 1), total), present: presenting });
    if (window.location.hash !== target) window.location.hash = target;
  };

  useEffect(() => {
    // A malformed or out-of-range step in a link lands on the nearest real step, and the address shows it.
    const canonical = lectureHash({ n: lecture.lecture, step: index, present });
    if (total && window.location.hash !== canonical) window.location.replace(canonical);
  }); // after every render: any hash change re-renders the app, even when it parses to the same step
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
      const k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown') go(index + 1);
      else if (k === 'ArrowLeft' || k === 'PageUp') go(index - 1);
      else if (k === 'Home') go(1);
      else if (k === 'End') go(total);
      else if (k === 'p' || k === 'P' || k === 'з' || k === 'З') go(index, !present);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    // Presenter mode reduces the scene chrome around the dock (see lectures.css).
    if (present) document.documentElement.dataset.present = '';
    return () => {
      delete document.documentElement.dataset.present;
    };
  }, [present]);

  if (!current) return <p className="station-status" role="alert">{t('This lecture script has no steps yet.', 'В сценарии этой лекции пока нет шагов.')}</p>;
  return (
    <div className="lecture-player" data-testid="lecture-player">
      <nav className="lecture-steps" aria-label={t('Steps', 'Шаги')}>
        {lecture.steps.map((s, i) => (
          <a key={i} href={lectureHash({ n: lecture.lecture, step: i + 1, present })} aria-current={i + 1 === index ? 'step' : undefined} title={mathToPlain(lectureText(lecture.lecture, s.title))}>
            <span>{i + 1}</span> <MathText text={lectureText(lecture.lecture, s.title)} />
          </a>
        ))}
      </nav>
      <article className="lecture-step" aria-labelledby="lecture-step-title" aria-live="polite">
        <StepView key={index} lecture={lecture} step={current} index={index} present={present} />
      </article>
      <footer className="lecture-controls">
        <button type="button" className="lecture-nav" onClick={() => go(index - 1)} disabled={index === 1} aria-label={t('Previous step', 'Предыдущий шаг')}>
          <ArrowLeft size={16} aria-hidden="true" /> <span>{t('Previous', 'Назад')}</span>
        </button>
        <p className="lecture-counter" data-testid="step-counter">
          {t('Step', 'Шаг')} <b>{index}</b> / {total}
        </p>
        <p className="lecture-keys" aria-hidden="true">
          <kbd>←</kbd> <kbd>→</kbd> {t('steps', 'шаги')} · <kbd>P</kbd> {t('presenter', 'показ')} · <kbd>Esc</kbd> {t('close', 'закрыть')}
        </p>
        <button type="button" className="lecture-nav lecture-present" aria-pressed={present} onClick={() => go(index, !present)} title={t('Presenter mode (P)', 'Режим показа (P)')}>
          <Presentation size={16} aria-hidden="true" /> <span>{t('Presenter', 'Показ')}</span>
        </button>
        <button type="button" className="lecture-nav" onClick={() => go(index + 1)} disabled={index === total} aria-label={t('Next step', 'Следующий шаг')}>
          <span>{t('Next', 'Далее')}</span> <ArrowRight size={16} aria-hidden="true" />
        </button>
      </footer>
    </div>
  );
}

function StepView({ lecture, step, index, present }: { lecture: Lecture; step: Step; index: number; present: boolean }) {
  const e = step.experiment;
  const station = e ? findStation(e.station) : null;
  const tx = (s: string | undefined) => lectureText(lecture.lecture, s);
  return (
    <>
      <div className="lecture-text">
        <h3 id="lecture-step-title" tabIndex={-1}><MathText text={tx(step.title)} /></h3>
        <p className="lecture-idea"><MathText text={tx(step.idea)} /></p>
        {step.formula?.length ? (
          <div className="lecture-formula" data-testid="lecture-formula">
            {step.formula.map((line, i) => <Tex key={i} tex={lectureFormula(lecture.lecture, line)} display />)}
          </div>
        ) : null}
        {step.example && (
          <section className="lecture-example" aria-label={t('Worked example', 'Разобранный пример')}>
            <h4>{t('Example', 'Пример')}</h4>
            <p><MathText text={tx(step.example)} /></p>
          </section>
        )}
        {e && station && (
          <a className="lecture-experiment" href={stationHash(e.station, e.seed ?? null, e.params ?? {}, { n: lecture.lecture, step: index, present })}>
            <FlaskConical size={16} aria-hidden="true" /> <b className="lecture-experiment-label">{e.label ? <MathText text={tx(e.label)} /> : t('Open experiment', 'Открыть эксперимент')}</b>
            <span className="lecture-experiment-meta">{station.name}{e.seed != null ? ` · ${t('seed', 'зерно')} ${e.seed}` : ''}</span>
          </a>
        )}
        {present && step.notes && <p className="lecture-notes"><b>{t('Teacher notes.', 'Заметки преподавателя.')}</b> <MathText text={tx(step.notes)} /></p>}
      </div>
      {step.scientists?.length ? (
        <aside className="lecture-portraits" aria-label={t('Scientists', 'Учёные')}>
          {step.scientists.map((slug) => <Portrait key={slug} slug={slug} />)}
        </aside>
      ) : null}
    </>
  );
}
