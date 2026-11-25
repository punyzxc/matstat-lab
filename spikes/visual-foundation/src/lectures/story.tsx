import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Maximize, Minimize, Presentation } from 'lucide-react';
import { MathText, Tex } from '../math';
import { lectureFormula, lectureText, t, useLang } from '../i18n';
import { useStationReducedMotion } from '../motion-preference';
import { findStation } from '../stations/catalog';
import { KernelStation } from '../stations/kernel-station';
import { lectureHash, stationHash } from '../stations/route';
import { experimentForStep, storyText, type Experiment, type Lecture, type Step, type StoryText } from './script';
import './story.css';

const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
const layerKeys = ['intuition', 'definition', 'formula', 'details'] as const;

/** Opt-in story reader. The same station stays mounted while it expands and folds back. */
export function LectureStory({ lecture, step, present, renderPortrait }: {
  lecture: Lecture; step: number; present: boolean; renderPortrait: (slug: string) => ReactNode;
}) {
  const lang = useLang();
  const reduced = useStationReducedMotion();
  const index = Math.min(Math.max(1, step), lecture.steps.length);
  const current = lecture.steps[index - 1];
  const preset = useMemo(() => experimentForStep(lecture, index), [lecture, index]);
  const [experiment, setExperiment] = useState<Experiment | null>(preset);
  const [mode, setMode] = useState<'demo' | 'explore'>('demo');
  const [expanded, setExpanded] = useState(false);
  const flow = useRef<HTMLDivElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const scrollFromRoute = useRef(false);
  const routeFromScroll = useRef(false);
  const savedScroll = useRef(0);
  const pendingPatch = useRef<{ step: number; patch: NonNullable<Step['whatIf']>[number] } | null>(null);
  const figureId = useId();
  const beat = lecture.beats?.find(b => b.step === index);
  const station = experiment ? findStation(experiment.station) : null;
  const text = (value: StoryText) => typeof value === 'string' ? lectureText(lecture.lecture, value) : storyText(value, lang);

  const go = useCallback((next: number, scrolling = false, presenting = present) => {
    const hash = lectureHash({ n: lecture.lecture, step: Math.min(Math.max(1, next), lecture.steps.length), present: presenting });
    if (window.location.hash === hash) return;
    if (scrolling) {
      routeFromScroll.current = true;
      window.history.replaceState(window.history.state, '', hash);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else window.location.hash = hash;
  }, [lecture, present]);

  useLayoutEffect(() => {
    const pending = pendingPatch.current;
    setExperiment(preset && pending?.step === index
      ? { ...preset, ...(pending.patch.seed == null ? {} : { seed: pending.patch.seed }), params: { ...preset.params, ...pending.patch.params } }
      : preset);
    pendingPatch.current = null;
    setMode('demo');
    if (!flow.current) return;
    if (routeFromScroll.current) { routeFromScroll.current = false; return; }
    scrollFromRoute.current = true;
    const section = sections.current[index - 1];
    if (section) flow.current.scrollTop += section.getBoundingClientRect().top - flow.current.getBoundingClientRect().top;
    const frame = requestAnimationFrame(() => { scrollFromRoute.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [preset, index]);
  useEffect(() => { if (step !== index) go(index); }, [step, index, go]);
  useEffect(() => {
    if (present) document.documentElement.dataset.present = '';
    return () => { delete document.documentElement.dataset.present; };
  }, [present]);

  const fold = useCallback(() => {
    setExpanded(false);
    requestAnimationFrame(() => {
      if (flow.current) flow.current.scrollTop = savedScroll.current;
      expandButton.current?.focus({ preventScroll: true });
    });
  }, []);
  const expand = () => {
    if (!expanded) savedScroll.current = flow.current?.scrollTop ?? 0;
    setExpanded(true);
  };
  useLayoutEffect(() => { if (expanded) backButton.current?.focus({ preventScroll: true }); }, [expanded]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (!expanded || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      fold();
    };
    const navigate = (event: KeyboardEvent) => {
      if (expanded || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || typing(event.target)) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') go(index + 1);
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') go(index - 1);
      else if (event.key === 'Home') go(1);
      else if (event.key === 'End') go(lecture.steps.length);
      else if (/^[pPзЗ]$/.test(event.key)) go(index, false, !present);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', escape, true);
    window.addEventListener('keydown', navigate);
    return () => { window.removeEventListener('keydown', escape, true); window.removeEventListener('keydown', navigate); };
  }, [expanded, fold, go, index, lecture.steps.length, present]);

  const onScroll = () => {
    if (scrollFromRoute.current || expanded || !flow.current) return;
    const line = flow.current.getBoundingClientRect().top + flow.current.clientHeight * 0.3;
    let next = 1;
    sections.current.forEach((section, i) => { if (section && section.getBoundingClientRect().top <= line) next = i + 1; });
    if (next !== index) go(next, true);
  };
  const applyWhatIf = (targetStep: number, patch: NonNullable<Step['whatIf']>[number]) => {
    if (targetStep !== index) { pendingPatch.current = { step: targetStep, patch }; go(targetStep); return; }
    const base = targetStep === index ? experiment : experimentForStep(lecture, targetStep);
    if (base) setExperiment({ ...base, ...(patch.seed == null ? {} : { seed: patch.seed }), params: { ...base.params, ...patch.params } });
  };
  // A delayed callback from the previous beat must not replace the new beat's state.
  const generation = `${index}:${experiment?.station}`;
  const activeGeneration = useRef(generation);
  activeGeneration.current = generation;
  const synchronize = useCallback((seed: number, params: Record<string, number>) => {
    if (activeGeneration.current !== generation) return;
    setExperiment(previous => {
      if (!previous) return previous;
      const old = previous.params ?? {};
      if (previous.seed === seed && Object.keys(old).length === Object.keys(params).length && Object.entries(params).every(([key, value]) => old[key] === value)) return previous;
      return { ...previous, seed, params };
    });
  }, [generation]);

  return (
    <div className="lecture-story" data-testid="lecture-story" data-present={present}>
      <div ref={flow} className="story-flow" data-testid="story-flow" onScroll={onScroll} inert={expanded} aria-label={t('Lecture story', 'Текст лекции')}>
        {lecture.steps.map((item, i) => (
          <section key={i} ref={el => { sections.current[i] = el; }} data-story-step={i + 1} aria-current={index === i + 1 ? 'step' : undefined}>
            <p className="story-step-number">{t('Step', 'Шаг')} {i + 1} / {lecture.steps.length}</p>
            <h3><MathText text={lectureText(lecture.lecture, item.title)} /></h3>
            <p className="lecture-idea"><MathText text={lectureText(lecture.lecture, item.idea)} /></p>
            {item.formula?.length ? <div className="lecture-formula">{item.formula.map((line, k) => <Tex key={k} tex={lectureFormula(lecture.lecture, line)} display />)}</div> : null}
            {item.layers && <Layers layers={item.layers} text={text} />}
            {item.whatIf?.length ? <div className="story-what-if" aria-label={t('What if?', 'Что если?')}>
              <p>{t('What if?', 'Что если?')}</p>
              {item.whatIf.map((chip, k) => <button key={k} type="button" onClick={() => applyWhatIf(i + 1, chip)}><MathText text={text(chip.label)} /></button>)}
            </div> : null}
            {item.example && <p className="lecture-example"><MathText text={lectureText(lecture.lecture, item.example)} /></p>}
            {item.scientists?.length ? <aside className="story-scientists" aria-label={t('Scientists', 'Учёные')}>{item.scientists.map(slug => <div key={slug}>{renderPortrait(slug)}</div>)}</aside> : null}
            {present && item.notes && <p className="lecture-notes"><MathText text={lectureText(lecture.lecture, item.notes)} /></p>}
          </section>
        ))}
      </div>
      <motion.aside layout transition={{ layout: { duration: reduced ? 0 : 0.28 } }} id={figureId}
        className="story-lab" data-expanded={expanded} data-mode={mode} data-beat={beat?.id ?? `step-${index}`}
        data-params={JSON.stringify(experiment?.params ?? {})} data-n={experiment?.params?.n}
        aria-label={t('Live lecture experiment', 'Живой эксперимент лекции')}>
        <header className="story-lab-head">
          <div><p className="story-step-number">{t('Live experiment', 'Живой эксперимент')}</p><h4><MathText text={beat ? text(beat.label) : lectureText(lecture.lecture, current.title)} /></h4></div>
          <div className="story-modes" role="group" aria-label={t('Experiment mode', 'Режим эксперимента')}>
            <button type="button" aria-pressed={mode === 'demo'} onClick={() => { setMode('demo'); setExperiment(preset); }}>{t('Demo', 'Демонстрация')}</button>
            <button type="button" aria-pressed={mode === 'explore'} onClick={() => { setMode('explore'); expand(); }}>{t('Explore', 'Исследование')}</button>
          </div>
        </header>
        <div className="story-live">
          {station?.kind === 'kernel' && experiment ? <KernelStation key={station.id} station={station} seed={experiment.seed ?? 2048}
            params={experiment.params ?? {}} onState={synchronize} typedChoices={mode === 'explore'} stateSync="immediate" />
            : experiment && station ? <a className="lecture-experiment" href={stationHash(station.id, experiment.seed, experiment.params, { n: lecture.lecture, step: index, present })}>{t('Open experiment', 'Открыть эксперимент')}</a>
            : <p role="status">{t('This step has no experiment attached.', 'К этому шагу эксперимент пока не подключён.')}</p>}
        </div>
        {expanded ? <button ref={backButton} type="button" className="story-expand" aria-controls={figureId} aria-expanded={true} onClick={fold}><Minimize size={15} aria-hidden />{t('Back to text', 'Вернуться к тексту')} · Esc</button>
          : <button ref={expandButton} type="button" className="story-expand" aria-controls={figureId} aria-expanded={false} onClick={expand}><Maximize size={15} aria-hidden />{t('Expand experiment', 'Развернуть эксперимент')}</button>}
      </motion.aside>
      <footer className="story-controls" inert={expanded}>
        <button className="lecture-nav" type="button" disabled={index === 1} onClick={() => go(index - 1)} aria-label={t('Previous step', 'Предыдущий шаг')}><ArrowLeft size={15} aria-hidden /></button>
        <p className="lecture-counter" data-testid="step-counter">{t('Step', 'Шаг')} <b>{index}</b> / {lecture.steps.length}</p>
        <p className="lecture-keys">{t('Scroll to continue · ← → steps', 'Листайте дальше · ← → шаги')}</p>
        <button className="lecture-nav lecture-present" type="button" aria-pressed={present} onClick={() => go(index, false, !present)}><Presentation size={15} aria-hidden />{t('Presenter', 'Показ')}</button>
        <button className="lecture-nav" type="button" disabled={index === lecture.steps.length} onClick={() => go(index + 1)} aria-label={t('Next step', 'Следующий шаг')}><ArrowRight size={15} aria-hidden /></button>
      </footer>
    </div>
  );
}

function Layers({ layers, text }: { layers: NonNullable<Step['layers']>; text: (value: StoryText) => string }) {
  const keys = layerKeys.filter(key => layers[key] != null);
  const [open, setOpen] = useState<string | null>(keys[0] ?? null);
  const id = useId();
  const labels = { intuition: t('Intuition', 'Интуиция'), definition: t('Definition', 'Определение'), formula: t('Formula', 'Формула'), details: t('Details & proof', 'Подробности и доказательство') };
  return <div className="story-layers">{keys.map(key => <div key={key}>
    <h4><button type="button" id={`${id}-${key}-label`} aria-expanded={open === key} aria-controls={`${id}-${key}`} onClick={() => setOpen(previous => previous === key ? null : key)}>{labels[key]} <span aria-hidden>{open === key ? '−' : '+'}</span></button></h4>
    <div id={`${id}-${key}`} role="region" aria-labelledby={`${id}-${key}-label`} hidden={open !== key}><MathText text={text(layers[key]!)} /></div>
  </div>)}</div>;
}
