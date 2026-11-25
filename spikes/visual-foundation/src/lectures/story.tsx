import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { ArrowDown, ArrowUp, Compass, Expand, Pause, Play, Presentation, RotateCcw, Sparkles } from 'lucide-react';
import { MathText, Tex, mathToPlain } from '../math';
import { lectureFormula, lectureText } from '../i18n';
import { Slider } from '../ui';
import { useStationReducedMotion } from '../motion-preference';
import { findStation } from '../stations/catalog';
import { lectureHash, stationHash } from '../stations/route';
import { findFigure, figureParams } from './figures';
import { LiveFormula } from './live-formula';
import { STORY_TEXT as T } from './story-text';
import type { Lecture, Portal, Step } from './script';
import { resolveFigures } from './catalog';
import { PortalButton, PortalView } from './portal';
import { ScientistCards } from './scientist-card';
import './story.css';

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
type Mode = 'demo' | 'explore';


/**
 * A lecture as one scrolling story (#110): the text on the left, a live figure on the right that follows the step
 * being read (scrollytelling). Formulas are live (#109), "what if" chips rebuild the experiment, explanations open
 * layer by layer, and the figure expands into its full station. The hash follows the step being read.
 */
export function StoryPlayer({ lecture, step, present }: { lecture: Lecture; step: number; present: boolean }) {
  const total = lecture.steps.length;
  const reduced = useStationReducedMotion();
  const refs = useMemo(() => resolveFigures(lecture.steps), [lecture]);
  const [active, setActive] = useState(() => Math.min(Math.max(step, 1), total));
  const [mode, setMode] = useState<Mode>('demo');
  const [explore, setExplore] = useState<Record<string, Record<string, number>>>({});
  // Demo mode: every step starts from its own preset; the reader's changes belong to the step they were made in.
  const [over, setOver] = useState<{ at: number; p: Record<string, number> }>({ at: 0, p: {} });
  const [hot, setHot] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, number | null>>({});
  const [playing, setPlaying] = useState(true);
  const [runKey, setRunKey] = useState(0);
  // an open math portal (#138), and the link that opened it, to give focus back
  const [portal, setPortal] = useState<Portal | null>(null);
  const portalFrom = useRef<HTMLElement | null>(null);
  const closePortal = useCallback(() => {
    setPortal(null);
    requestAnimationFrame(() => portalFrom.current?.focus());
  }, []);
  const col = useRef<HTMLDivElement>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const synced = useRef(active);

  const ref = refs[active - 1];
  const overrides = over.at === active ? over.p : {};
  const figure = findFigure(ref.id);
  const spec = figure?.spec;
  const params = useMemo(
    () => (spec ? figureParams(ref.id, mode === 'explore' ? explore[ref.id] ?? { ...ref.params, ...overrides } : { ...ref.params, ...overrides }) : {}),
    [spec, ref, mode, explore, overrides],
  );
  const apply = (next: Record<string, number>, at = active) => {
    const id = refs[at - 1].id;
    if (mode === 'explore') setExplore((e) => ({ ...e, [id]: { ...(e[id] ?? params), ...next } }));
    else setOver((o) => ({ at, p: { ...(o.at === at ? o.p : {}), ...next } }));
  };
  useEffect(() => setResults({}), [ref.id]);

  // ---- scroll ↔ step
  const scrollToStep = useCallback(
    (i: number, smooth = !reduced) => {
      const el = sections.current[Math.min(Math.max(i, 1), total) - 1], c = col.current;
      if (!el || !c) return;
      c.scrollTo({ top: Math.max(0, el.offsetTop - c.clientHeight * 0.12), behavior: smooth ? 'smooth' : 'auto' });
      setActive(Math.min(Math.max(i, 1), total));
    },
    [reduced, total],
  );
  useLayoutEffect(() => {
    scrollToStep(active, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // A link or the back button changed the hash to another step: go there.
    const target = Math.min(Math.max(step, 1), total);
    if (target !== synced.current) {
      synced.current = target;
      scrollToStep(target);
    }
  }, [step, total, scrollToStep]);
  useEffect(() => {
    // The address follows the step being read, without adding history entries.
    synced.current = active;
    const hash = lectureHash({ n: lecture.lecture, step: active, present });
    if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
  }, [active, present, lecture.lecture]);
  const onScroll = useRef(0);
  const measure = () => {
    cancelAnimationFrame(onScroll.current);
    onScroll.current = requestAnimationFrame(() => {
      const c = col.current;
      if (!c) return;
      const line = c.scrollTop + c.clientHeight * 0.38;
      let k = 1;
      sections.current.forEach((el, i) => {
        if (el && el.offsetTop <= line) k = i + 1;
      });
      if (c.scrollTop + c.clientHeight >= c.scrollHeight - 2) k = Math.max(k, total);
      setActive(k);
    });
  };

  // ---- keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (portal || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
      const k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown') scrollToStep(active + 1);
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') scrollToStep(active - 1);
      else if (k === 'Home') scrollToStep(1);
      else if (k === 'End') scrollToStep(total);
      else if (k === ' ' || k === 'Spacebar') setPlaying((p) => !p);
      else if (k === 'e' || k === 'E' || k === 'у' || k === 'У') setMode((m) => (m === 'demo' ? 'explore' : 'demo'));
      else if (k === 'r' || k === 'R' || k === 'к' || k === 'К') setRunKey((r) => r + 1);
      else if (k === 'p' || k === 'P' || k === 'з' || k === 'З') window.location.hash = lectureHash({ n: lecture.lecture, step: active, present: !present });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, total, present, lecture.lecture, scrollToStep, portal]);
  useEffect(() => {
    if (present) document.documentElement.dataset.present = '';
    return () => {
      delete document.documentElement.dataset.present;
    };
  }, [present]);

  const toggleMode = () => {
    if (mode === 'demo') setExplore((e) => ({ ...e, [ref.id]: e[ref.id] ?? params }));
    setMode(mode === 'demo' ? 'explore' : 'demo');
  };
  const target = spec?.station(params) ?? null;
  const stationHref = target && findStation(target.station) ? stationHash(target.station, spec!.seed, target.params, { n: lecture.lecture, step: active, present }) : null;
  const openStation = (e: MouseEvent<HTMLAnchorElement>) => {
    // Grow the figure into the station: a view transition where the browser has one.
    const doc = document as Document & { startViewTransition?: (cb: () => Promise<void>) => unknown };
    if (!stationHref || reduced || !doc.startViewTransition || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    doc.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          const done = () => requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          window.addEventListener('hashchange', done, { once: true });
          window.location.hash = stationHref;
          window.setTimeout(resolve, 600);
        }),
    );
  };

  const Figure = figure?.Component;
  return (
    <div className="story" data-testid="lecture-player" data-mode={mode} data-present={present || undefined}>
      <div className="story-text" ref={col} onScroll={measure} data-testid="story-text">
        {lecture.steps.map((s, i) => (
          <StorySection
            key={i}
            ref={(el) => {
              sections.current[i] = el;
            }}
            step={s}
            index={i + 1}
            total={total}
            active={i + 1 === active}
            present={present}
            lecture={lecture}
            figureId={refs[i].id}
            params={refs[i].id === ref.id ? params : figureParams(refs[i].id, refs[i].params)}
            results={refs[i].id === ref.id ? results : {}}
            hot={hot}
            onHot={setHot}
            onParam={(k, v) => {
              if (i + 1 !== active) scrollToStep(i + 1);
              apply({ [k]: v }, i + 1);
            }}
            onWhatIf={(next) => {
              if (i + 1 !== active) scrollToStep(i + 1);
              apply(next, i + 1);
            }}
            onFocusStep={() => i + 1 !== active && scrollToStep(i + 1)}
            onPortal={(p, from) => {
              portalFrom.current = from;
              setPortal(p);
            }}
          />
        ))}
        <div className="story-tail" aria-hidden="true" />
      </div>

      <div className="story-stage" aria-label={T.figureLabel}>
        <header className="story-stage-head">
          <div className="story-stage-title">
            <span className="story-stage-eyebrow">{spec?.title}</span>
            <b data-testid="story-beat"><MathText text={spec?.beatTitles[ref.beat] ?? ref.beat} /></b>
          </div>
          <div className="story-tools">
            <div className="story-mode" role="group" aria-label={T.mode}>
              <button type="button" aria-pressed={mode === 'demo'} onClick={() => mode !== 'demo' && toggleMode()} title={T.demoHint}>
                <Sparkles size={13} aria-hidden="true" /> {T.demo}
              </button>
              <button type="button" aria-pressed={mode === 'explore'} onClick={() => mode !== 'explore' && toggleMode()} title={T.exploreHint}>
                <Compass size={13} aria-hidden="true" /> {T.explore}
              </button>
            </div>
            <button type="button" className="story-icon" onClick={() => setPlaying((p) => !p)} aria-label={playing ? T.pause : T.play} title={`${playing ? T.pause : T.play} (Space)`}>
              {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            </button>
            <button type="button" className="story-icon" onClick={() => setRunKey((r) => r + 1)} aria-label={T.restart} title={`${T.restart} (R)`}>
              <RotateCcw size={15} aria-hidden="true" />
            </button>
            {stationHref ? (
              <a className="story-expand" href={stationHref} onClick={openStation} data-testid="story-open-station">
                <Expand size={14} aria-hidden="true" /> {T.openStation}
              </a>
            ) : (
              <span className="story-expand is-off">{T.noStation}</span>
            )}
          </div>
        </header>
        <div className="story-figure" style={{ viewTransitionName: 'lab-figure' }}>
          {Figure && (
            <Figure key={ref.id} beat={ref.beat} params={params} seed={spec!.seed} hot={hot} onHot={setHot} playing={playing && !portal}
              reduced={reduced} runKey={runKey} onResults={setResults} />
          )}
        </div>
        <ScientistCards slugs={lecture.steps[active - 1].scientists ?? []} step={active} />
        {portal && <PortalView key={`${portal.lecture}/${portal.step}`} portal={portal} reduced={reduced} present={present} onClose={closePortal} />}
        {mode === 'explore' && spec && (
          <div className="story-explore" data-testid="story-explore">
            {Object.entries(spec.params).map(([k, p]) => (
              <Slider key={ref.id + k} id={`story-${k}`} label={p.label} value={params[k]} min={p.min} max={p.max} step={p.step}
                display={String(params[k])} onChange={(v) => apply({ [k]: v })} />
            ))}
            <p>{T.exploreHint}</p>
          </div>
        )}
      </div>

      <footer className="story-foot">
        <nav className="story-dots" aria-label={T.steps}>
          {lecture.steps.map((s, i) => (
            <a key={i} href={lectureHash({ n: lecture.lecture, step: i + 1, present })} aria-current={i + 1 === active ? 'step' : undefined}
              onClick={(e) => {
                e.preventDefault();
                scrollToStep(i + 1);
              }}>
              <span className="sr-only"><MathText text={lectureText(lecture.lecture, s.title)} /></span>
            </a>
          ))}
        </nav>
        <p className="lecture-counter" data-testid="step-counter" aria-live="polite">
          {T.step} <b>{active}</b> / {total}
        </p>
        <p className="lecture-keys" aria-hidden="true">{T.keys}</p>
        <button type="button" className="story-icon" onClick={() => scrollToStep(active - 1)} disabled={active === 1} aria-label={T.prev}><ArrowUp size={15} aria-hidden="true" /></button>
        <button type="button" className="story-icon" onClick={() => scrollToStep(active + 1)} disabled={active === total} aria-label={T.next}><ArrowDown size={15} aria-hidden="true" /></button>
        <button type="button" className="lecture-nav lecture-present" aria-pressed={present}
          onClick={() => (window.location.hash = lectureHash({ n: lecture.lecture, step: active, present: !present }))} title={T.presenterTitle}>
          <Presentation size={15} aria-hidden="true" /> <span>{T.presenter}</span>
        </button>
      </footer>
    </div>
  );
}

type SectionProps = {
  step: Step; index: number; total: number; active: boolean; present: boolean; lecture: Lecture; figureId: string;
  params: Record<string, number>; results: Record<string, number | null>; hot: string | null;
  onHot: (k: string | null) => void; onParam: (k: string, v: number) => void; onWhatIf: (p: Record<string, number>) => void; onFocusStep: () => void;
  onPortal: (p: Portal, from: HTMLElement) => void;
  ref: (el: HTMLElement | null) => void;
};

function StorySection({ step: s, index, active, present, lecture, figureId, params, results, hot, onHot, onParam, onWhatIf, onFocusStep, onPortal, ref }: SectionProps) {
  const fig = findFigure(figureId)?.spec;
  const tx = (v: string) => lectureText(lecture.lecture, v);
  const e = s.experiment, station = e ? findStation(e.station) : null;
  const same = (p: Record<string, number>) => Object.entries(p).every(([k, v]) => Math.abs((params[k] ?? NaN) - v) < 1e-9);
  const layers: [keyof typeof T.layers, string][] = [];
  if (s.layers?.intuition) layers.push(['intuition', s.layers.intuition]);
  if (s.layers?.definition) layers.push(['definition', s.layers.definition]);
  if (s.live?.length && s.formula?.length) layers.push(['formula', '']);
  if (s.layers?.details) layers.push(['details', s.layers.details]);
  return (
    <section ref={ref} className={`story-step${active ? ' is-active' : ''}`} data-step={index} aria-current={active ? 'step' : undefined}
      onFocus={onFocusStep} aria-labelledby={`story-step-${index}`}>
      <p className="story-step-n">{String(index).padStart(2, '0')}</p>
      <h3 id={`story-step-${index}`}><MathText text={tx(s.title)} /></h3>
      <p className="lecture-idea"><MathText text={tx(s.idea)} /></p>
      {s.live?.length && fig ? (
        <div className="story-live">
          {s.live.map((tex, i) => (
            <LiveFormula key={i} tex={tx(tex)} values={params} results={results} params={fig.params} vars={fig.vars} hot={hot} onHot={onHot} onChange={onParam} />
          ))}
        </div>
      ) : s.formula?.length ? (
        <div className="lecture-formula" data-testid="lecture-formula">
          {s.formula.map((line, i) => <Tex key={i} tex={lectureFormula(lecture.lecture, line)} display />)}
        </div>
      ) : null}
      {s.whatIf?.length ? (
        <div className="story-whatif" role="group" aria-label={T.whatIf}>
          <span>{T.whatIf}</span>
          {s.whatIf.map((w, i) => (
            <button key={i} type="button" aria-pressed={same(w.params)} aria-label={`${T.whatIf} ${mathToPlain(tx(w.label))}`} onClick={() => onWhatIf(w.params)}>
              <MathText text={tx(w.label)} />
            </button>
          ))}
        </div>
      ) : null}
      {layers.length ? (
        <div className="story-layers">
          {layers.map(([kind, text]) => (
            <details key={kind} className={`story-layer story-layer--${kind}`}>
              <summary>{T.layers[kind]}</summary>
              {kind === 'formula' ? (
                <div className="lecture-formula">{s.formula!.map((line, i) => <Tex key={i} tex={lectureFormula(lecture.lecture, line)} display />)}</div>
              ) : (
                <p><MathText text={tx(text)} /></p>
              )}
            </details>
          ))}
        </div>
      ) : null}
      {s.example && (
        <section className="lecture-example" aria-label={T.workedExample}>
          <h4>{T.example}</h4>
          <p><MathText text={tx(s.example)} /></p>
        </section>
      )}
      {s.portals?.length ? (
        <div className="story-portals" role="group" aria-label={T.portals}>
          <span>{T.portals}</span>
          {s.portals.map((p, i) => <PortalButton key={i} portal={p} onOpen={onPortal} />)}
        </div>
      ) : null}
      {e && station && (
        <a className="story-link" href={stationHash(e.station, e.seed ?? null, e.params ?? {}, { n: lecture.lecture, step: index, present })}>
          <MathText text={e.label ? tx(e.label) : T.openExperiment} /> <span>{station.name}</span>
        </a>
      )}
      {present && s.notes && <p className="lecture-notes"><b>{T.notes}</b> <MathText text={tx(s.notes)} /></p>}
    </section>
  );
}
