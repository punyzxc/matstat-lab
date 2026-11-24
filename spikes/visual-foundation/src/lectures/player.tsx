import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, FlaskConical, Presentation } from 'lucide-react';
import { findStation } from '../stations/catalog';
import { lectureHash, stationHash } from '../stations/route';
import { fitPortrait, PORTRAIT, type Lecture, type Scientist, type Step } from './script';
import roster from '../../lectures/scientists.json';
import './lectures.css';

/** Every lecture script in `spikes/visual-foundation/lectures/LNN.json`, bundled at build time. */
const files = import.meta.glob<Lecture>('../../lectures/L[0-9][0-9].json', { eager: true, import: 'default' });
export const lectures: Lecture[] = Object.values(files).sort((a, b) => a.lecture - b.lecture);
export const findLecture = (n: number) => lectures.find((l) => l.lecture === n) ?? null;
const scientists = (roster as { scientists: Scientist[] }).scientists;
const findScientist = (slug: string) => scientists.find((s) => s.slug === slug);

/** The quiet drawer: the twelve lectures, each opening at its first step. */
export function LectureList({ present }: { present?: boolean }) {
  return (
    <ol className="lecture-list" aria-label="Lectures">
      {lectures.map((l) => (
        <li key={l.lecture}>
          <a href={lectureHash({ n: l.lecture, step: 1, present })}>
            <span className="lecture-list-n">L{String(l.lecture).padStart(2, '0')}</span>
            <span className="lecture-list-title">{l.title}</span>
            <span className="lecture-list-meta">
              {l.steps.length} {l.steps.length === 1 ? 'step' : 'steps'}
              {l.status !== 'ready' && <i> · draft</i>}
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
export function LecturePlayer({ lecture, step, present }: { lecture: Lecture; step: number; present: boolean }) {
  const total = lecture.steps.length;
  const index = Math.min(Math.max(step, 1), total);
  const current = lecture.steps[index - 1];
  const go = (next: number, presenting = present) => {
    const target = lectureHash({ n: lecture.lecture, step: Math.min(Math.max(next, 1), total), present: presenting });
    if (window.location.hash !== target) window.location.hash = target;
  };

  useEffect(() => {
    // An out-of-range step in a link lands on the nearest real step.
    if (index !== step) window.location.replace(lectureHash({ n: lecture.lecture, step: index, present }));
  }, [index, step, lecture.lecture, present]);
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

  return (
    <div className="lecture-player" data-testid="lecture-player">
      <nav className="lecture-steps" aria-label="Steps">
        {lecture.steps.map((s, i) => (
          <a key={i} href={lectureHash({ n: lecture.lecture, step: i + 1, present })} aria-current={i + 1 === index ? 'step' : undefined} title={s.title}>
            <span>{i + 1}</span> {s.title}
          </a>
        ))}
      </nav>
      <article className="lecture-step" aria-labelledby="lecture-step-title" aria-live="polite">
        <StepView key={index} lecture={lecture} step={current} index={index} present={present} />
      </article>
      <footer className="lecture-controls">
        <button type="button" className="lecture-nav" onClick={() => go(index - 1)} disabled={index === 1} aria-label="Previous step">
          <ArrowLeft size={16} aria-hidden="true" /> <span>Previous</span>
        </button>
        <p className="lecture-counter" data-testid="step-counter">
          Step <b>{index}</b> / {total}
        </p>
        <p className="lecture-keys" aria-hidden="true">
          <kbd>←</kbd> <kbd>→</kbd> steps · <kbd>P</kbd> presenter · <kbd>Esc</kbd> close
        </p>
        <button type="button" className="lecture-nav lecture-present" aria-pressed={present} onClick={() => go(index, !present)} title="Presenter mode (P)">
          <Presentation size={16} aria-hidden="true" /> <span>Presenter</span>
        </button>
        <button type="button" className="lecture-nav" onClick={() => go(index + 1)} disabled={index === total} aria-label="Next step">
          <span>Next</span> <ArrowRight size={16} aria-hidden="true" />
        </button>
      </footer>
    </div>
  );
}

function StepView({ lecture, step, index, present }: { lecture: Lecture; step: Step; index: number; present: boolean }) {
  const e = step.experiment;
  const station = e ? findStation(e.station) : null;
  return (
    <>
      <div className="lecture-text">
        <h3 id="lecture-step-title" tabIndex={-1}>{step.title}</h3>
        <p className="lecture-idea">{step.idea}</p>
        {step.formula?.length ? (
          <div className="lecture-formula" role="math" aria-label={step.formula.join('; ')}>
            {step.formula.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        ) : null}
        {step.example && (
          <section className="lecture-example" aria-label="Worked example">
            <h4>Example</h4>
            <p>{step.example}</p>
          </section>
        )}
        {e && station && (
          <a className="lecture-experiment" href={stationHash(e.station, e.seed ?? null, e.params ?? {}, { n: lecture.lecture, step: index, present })}>
            <FlaskConical size={16} aria-hidden="true" /> {e.label ?? 'Open experiment'}
            <span>{station.name}{e.seed != null ? ` · seed ${e.seed}` : ''}</span>
          </a>
        )}
        {present && step.notes && <p className="lecture-notes"><b>Teacher notes.</b> {step.notes}</p>}
      </div>
      {step.scientists?.length ? (
        <aside className="lecture-portraits" aria-label="Scientists">
          {step.scientists.map((slug) => <Portrait key={slug} slug={slug} />)}
        </aside>
      ) : null}
    </>
  );
}

const portraitCache = new Map<string, Promise<string | null>>();
function loadPortrait(slug: string) {
  let p = portraitCache.get(slug);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}portraits/${slug}.txt`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.text() : null))
      .then(fitPortrait)
      .catch(() => null);
    portraitCache.set(slug, p);
  }
  return p;
}

/** The owner's ASCII portrait in a fixed slot, or a labelled placeholder while the file is empty or missing. */
export function Portrait({ slug }: { slug: string }) {
  const person = findScientist(slug);
  const [art, setArt] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    loadPortrait(slug).then((a) => live && setArt(a));
    return () => {
      live = false;
    };
  }, [slug]);
  const name = person?.name ?? slug;
  return (
    <figure className="portrait" data-slug={slug} data-state={art ? 'art' : 'placeholder'} style={{ ['--cols' as string]: PORTRAIT.columns, ['--lines' as string]: PORTRAIT.lines }}>
      {art ? (
        <pre className="portrait-art" role="img" aria-label={`ASCII portrait of ${name}`}>{art}</pre>
      ) : (
        <div className="portrait-art portrait-placeholder" aria-hidden="true">
          <span>{initials(name)}</span>
          <small>portrait · {slug}.txt</small>
        </div>
      )}
      <figcaption>
        <b>{name}</b> {person && <span className="portrait-years">{person.years}</span>}
        {person && <span className="portrait-line">{person.contribution}</span>}
      </figcaption>
    </figure>
  );
}
const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter((w) => /^\p{Lu}/u.test(w))
    .map((w) => w[0])
    .slice(0, 3)
    .join('');
