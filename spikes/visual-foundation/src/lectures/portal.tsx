import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Waypoints } from 'lucide-react';
import { MathText, Tex, mathToPlain } from '../math';
import { lectureFormula, lectureText } from '../i18n';
import { lectureHash } from '../stations/route';
import { findLecture, resolveFigures } from './catalog';
import { figureParams, findFigure } from './figures';
import { LiveFormula } from './live-formula';
import { STORY_TEXT as T } from './story-text';
import type { Portal } from './script';

/** A portal link in a step (#138): the target lecture and the title of its step. */
export function PortalButton({ portal, onOpen }: { portal: Portal; onOpen: (p: Portal, from: HTMLElement) => void }) {
  const target = findLecture(portal.lecture)?.steps[portal.step - 1];
  if (!target) return null;
  const title = lectureText(portal.lecture, target.title);
  return (
    <button type="button" className="story-portal" data-testid="story-portal" onClick={(e) => onOpen(portal, e.currentTarget)}
      aria-label={`${T.portal}: ${T.lecture} ${portal.lecture}, ${mathToPlain(title)}`}>
      <Waypoints size={13} aria-hidden="true" />
      <span className="story-portal-n">L{portal.lecture}</span>
      <MathText text={title} />
    </button>
  );
}

/**
 * The portal itself: a compact live copy of another lecture's step (its figure, live formulas and idea) over the
 * current figure. Its experiment runs on its own values; Esc or Back closes it and returns focus to the link,
 * "Go there" opens that lecture at that step.
 */
export function PortalView({ portal, reduced, present, onClose }: { portal: Portal; reduced: boolean; present: boolean; onClose: () => void }) {
  const lecture = findLecture(portal.lecture)!;
  const step = lecture.steps[portal.step - 1];
  const ref = useMemo(() => (lecture.story ? resolveFigures(lecture.steps)[portal.step - 1] : null), [lecture, portal.step]);
  const figure = ref ? findFigure(ref.id) : null;
  const [params, setParams] = useState(() => (ref && figure ? figureParams(ref.id, ref.params) : {}));
  const [results, setResults] = useState<Record<string, number | null>>({});
  const [hot, setHot] = useState<string | null>(null);
  const back = useRef<HTMLButtonElement>(null);
  const tx = (v: string) => lectureText(lecture.lecture, v);

  useEffect(() => {
    back.current?.focus();
    // Esc closes the portal, not the lecture behind it: handled first, in the capture phase.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const Figure = figure?.Component, spec = figure?.spec;
  return (
    <div className="story-portal-view" role="dialog" aria-modal="false" aria-labelledby="story-portal-title" data-testid="story-portal-view">
      <header className="story-portal-head">
        <div>
          <span className="story-stage-eyebrow">
            {T.portal} · {T.lecture} {lecture.lecture} · <MathText text={tx(lecture.title)} />
          </span>
          <b id="story-portal-title"><MathText text={tx(step.title)} /></b>
        </div>
        <div className="story-portal-actions">
          <button ref={back} type="button" className="story-portal-back" onClick={onClose} title={`${T.back} (Esc)`}>
            <ArrowLeft size={14} aria-hidden="true" /> {T.back}
          </button>
          <a className="story-expand" href={lectureHash({ n: lecture.lecture, step: portal.step, present })} data-testid="story-portal-go">
            <ArrowUpRight size={14} aria-hidden="true" /> {T.goThere}
          </a>
        </div>
      </header>
      <div className="story-portal-body">
        <div className="story-portal-text">
          <p className="lecture-idea"><MathText text={tx(step.idea)} /></p>
          {step.live?.length && spec ? (
            <div className="story-live">
              {step.live.map((tex, i) => (
                <LiveFormula key={i} tex={tx(tex)} values={params} results={results} params={spec.params} vars={spec.vars} hot={hot} onHot={setHot}
                  onChange={(k, v) => setParams((p) => ({ ...p, [k]: v }))} />
              ))}
            </div>
          ) : step.formula?.length ? (
            <div className="lecture-formula">{step.formula.map((line, i) => <Tex key={i} tex={lectureFormula(lecture.lecture, line)} display />)}</div>
          ) : null}
          <p className="story-portal-hint">{T.portalHint}</p>
        </div>
        {Figure && ref && spec && (
          <div className="story-portal-figure">
            <Figure beat={ref.beat} params={params} seed={spec.seed} hot={hot} onHot={setHot} playing reduced={reduced} runKey={0} onResults={setResults} />
          </div>
        )}
      </div>
    </div>
  );
}
