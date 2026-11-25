import '@fontsource-variable/space-grotesk';
import { MathText, Tex } from './math';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './style.css';
import './i18n-tables';
import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Tabs from '@radix-ui/react-tabs';
import { MotionConfig, motion } from 'motion/react';
import {
  Activity, ArrowDownToLine, ChevronDown, CircleHelp,
  Maximize, Minimize, SlidersHorizontal,
} from 'lucide-react';
import { Observatory, SampleRecord } from './observatory';
import { MethodPreview } from './method-preview';
import { historyPrefix, readLastResults, readLastVisited, writeLastResult, writeLastVisited, type LastResult } from './last-results';
import { useStationReducedMotion } from './motion-preference';
import type { ModuleId } from './modules';
import { LabNotesContent } from './lab-shell';
import { findStation, orbitOfModule, orbits, type OrbitId } from './stations/catalog';
import { KernelStation } from './stations/kernel-station';
import { lectureHash, orbitHash, parseRoute, stationHash, type Route } from './stations/route';
import { findLecture, LectureList, LecturePlayer } from './lectures/player';
import { SceneDock } from './stations/station-dock';
import { Plot } from './plot.tsx';
import { dec, lectureText, locale, plural, t, useLang } from './i18n';
import { asciiHistogram, collect, histogram, initialSettings, moments, sources, type Distribution, type RunSettings } from './statistics.ts';

/** Legacy stations take `n` (sample size), `scale` and `dist` (0 normal, 1 uniform, 2 exponential) from the hash, clamped to their sliders. */
const distributions = Object.keys(sources) as Distribution[];
const clamp = (v: number, lo: number, hi: number, step: number) => Math.min(hi, Math.max(lo, lo + Math.round((v - lo) / step) * step));
export function legacySettings(base: RunSettings, seed: number | null, params: Record<string, number>): RunSettings {
  const out = { ...base };
  if (seed != null) out.seed = seed;
  if (Number.isFinite(params.n)) out.count = clamp(params.n, 64, 2048, 64);
  if (Number.isFinite(params.scale)) out.scale = Number(clamp(params.scale, 0.5, 2.5, 0.05).toFixed(2));
  if (Number.isInteger(params.dist) && distributions[params.dist]) out.distribution = distributions[params.dist];
  return out;
}
const pinned = (route: Route) => route.seed != null || ['n', 'scale', 'dist'].some((k) => k in route.params);
import { Button, Panel, PanelHeading, Slider, Stat } from './ui.tsx';
import { AutoplayBar, useAutoplayKeys, usePlayback, type Playback } from './stations/autoplay';

type Phase = 'running' | 'paused' | 'complete';
type Run = { settings: RunSettings; all: number[]; shown: number; phase: Phase; record: boolean };
const newRun = (settings: RunSettings, immediate: boolean, record = false): Run => ({
  record, settings, all: collect(settings), shown: immediate ? settings.count : 0, phase: immediate ? 'complete' : 'running',
});

const number = { format: (v: number) => v.toLocaleString(locale()) };
const fixed = (value: number | null | undefined) => value == null ? '—' : dec((Math.abs(value) < 0.0005 ? 0 : value).toFixed(3));
const modes = ['Histogram', 'ECDF', 'ASCII'] as const;
const modeName = (m: (typeof modes)[number]) => m === 'Histogram' ? t('Histogram', 'Гистограмма') : m === 'ECDF' ? t('ECDF', 'ЭФР') : 'ASCII';
const guide = {
  get Histogram() { return t(String.raw`Frequency density · $\dfrac{\text{count}}{n \times \text{bin width}}$`, String.raw`Плотность частоты · $\dfrac{\text{число}}{n \times \text{ширина интервала}}$`); },
  get ECDF() { return t(String.raw`Cumulative probability · $F_n(x) = \dfrac{\#\{x_i \le x\}}{n}$`, String.raw`Накопленная частота · $F_n(x) = \dfrac{\#\{x_i \le x\}}{n}$`); },
  get ASCII() { return t('Relative bin counts · @ marks occupied levels', 'Относительные частоты интервалов · @ отмечает заполненные уровни'); },
};

function Workspace({ settings, onComplete }: { settings: RunSettings; onComplete: (value: RunSettings) => void }) {
  const reduced = useStationReducedMotion();
  // The experiment plays by itself: the sample accumulates on open and again after every change.
  const [run, setRun] = useState(() => newRun(settings, reduced === true));
  const [draft, setDraft] = useState(settings);
  const [seedText, setSeedText] = useState(String(settings.seed));
  const [projector, setProjector] = useState(false);
  const [theory, setTheory] = useState(true);
  const [mode, setMode] = useState<(typeof modes)[number]>('Histogram');
  const [exported, setExported] = useState(false);
  const pace = usePlayback();
  const validSeed = /^\d{1,10}$/.test(seedText) && Number(seedText) <= 4294967295;
  const busy = run.phase === 'running';
  const sample = useMemo(() => run.all.slice(0, run.shown), [run.all, run.shown]);
  const model = sources[run.settings.distribution];
  const domain = model.domain(run.settings.scale);
  const hist = histogram(sample, domain, 28, run.settings.count);
  const finalBins = useMemo(() => histogram(run.all, sources[run.settings.distribution].domain(run.settings.scale)), [run.all, run.settings]);
  const densityPeak = Math.max(...finalBins.density);
  const summary = moments(sample);
  const [theoreticalMean, theoreticalVariance] = model.theory(run.settings.scale);

  useEffect(() => {
    if (run.record && run.phase === 'complete') onComplete(run.settings);
  }, [onComplete, run.record, run.phase, run.settings]);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => {
      setRun(current => {
        if (current.phase !== 'running') return current;
        const shown = Math.min(current.all.length, current.shown + Math.ceil(current.all.length / 19));
        return { ...current, shown, phase: shown === current.all.length ? 'complete' : 'running' };
      });
    }, Math.round(43 / pace.speed));
    return () => clearInterval(timer);
  }, [busy, pace.speed]);

  // Every parameter change starts a new run at once; no Run button.
  useEffect(() => {
    if (!validSeed) return;
    const next = { ...draft, seed: Number(seedText) };
    const same = next.distribution === run.settings.distribution && next.scale === run.settings.scale &&
      next.count === run.settings.count && next.seed === run.settings.seed;
    if (same) return;
    const t = window.setTimeout(() => setRun(newRun(next, reduced === true, true)), 160);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, seedText, validSeed]);

  useEffect(() => {
    if (!exported) return;
    const timer = window.setTimeout(() => setExported(false), 2200);
    return () => clearTimeout(timer);
  }, [exported]);

  /** A new sample from the next seed. */
  const nextDraw = useCallback(() => {
    const seed = (run.settings.seed + 1) >>> 0;
    setSeedText(String(seed));
    setRun(newRun({ ...run.settings, seed }, reduced === true, true));
  }, [run.settings, reduced]);
  const playback: Playback = {
    ...pace,
    playing: busy,
    setPlaying: (v) => {
      const next = typeof v === 'function' ? v(busy) : v;
      if (next === busy) return;
      if (!next) setRun(current => ({ ...current, phase: current.phase === 'running' ? 'paused' : current.phase }));
      else if (run.phase === 'paused') setRun(current => ({ ...current, phase: 'running' }));
      else nextDraw();
    },
  };
  useAutoplayKeys(() => playback.setPlaying(p => !p), nextDraw);

  function download() {
    const { distribution, scale, seed } = run.settings;
    const rows = sample.map((value, index) => [distribution, scale, seed, index + 1, value].join(','));
    const file = new Blob([['distribution,scale,seed,index,value', ...rows].join('\r\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statum-${distribution}-${seed}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
  }

  const status = busy ? t(`Drawing · ${number.format(run.shown)} of ${number.format(run.settings.count)}`, `Розыгрыш · ${number.format(run.shown)} из ${number.format(run.settings.count)}`)
    : run.phase === 'paused' ? t('Simulation paused', 'Моделирование приостановлено')
    : t(`${number.format(run.shown)} observations complete`, `Готово: ${number.format(run.shown)} ${plural(run.shown, 'наблюдение', 'наблюдения', 'наблюдений')}`);

  return <div id="workspace" className={projector ? 'station-legacy app--projector' : 'station-legacy'}>
    <div className="workspace-title">
      <h2>{t('Experiment workspace', 'Рабочее место эксперимента')}</h2>
      <span className="workspace-actions"><Button variant="ghost" aria-pressed={projector} onClick={()=>setProjector(!projector)} title={t('Toggle projector mode', 'Режим проектора')}>
          {projector ? <Minimize size={14} aria-hidden/> : <Maximize size={14} aria-hidden/>}<span>{t('Projector', 'Проектор')}</span></Button>
        <Button onClick={download} disabled={!sample.length} aria-label={t('Export CSV', 'Экспорт CSV')}><ArrowDownToLine size={15} aria-hidden /> {exported ? t('Exported', 'Сохранено') : t('Export CSV', 'Экспорт CSV')}</Button></span>
    </div>

    <div className="instrument-grid">
      <Panel label={t('Simulation parameters', 'Параметры моделирования')} className="parameters">
        <PanelHeading icon={<SlidersHorizontal size={16} aria-hidden />} title={t('Parameters', 'Параметры')} />
        <div className="parameter-body">
          <label htmlFor="distribution">{t('Distribution', 'Распределение')}</label>
          <div className="select-field">
            <select id="distribution" name="distribution" value={draft.distribution}
              onChange={event => setDraft({ ...draft, distribution: event.currentTarget.value as Distribution })}>
              {Object.entries(sources).map(([key, source]) => <option key={key} value={key}>{source.label}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden />
          </div>
          <fieldset aria-label={t('Sample parameters', 'Параметры выборки')}>
            <Slider id="sample-size" label={t('Sample size', 'Объём выборки')} value={draft.count} display={number.format(draft.count)}
              min={64} max={2048} step={64} onChange={count => setDraft({ ...draft, count })} />
            <Slider id="distribution-scale" label={sources[draft.distribution].parameter} value={draft.scale}
              display={dec(draft.scale.toFixed(2))} min={0.5} max={2.5} step={0.05} onChange={scale => setDraft({ ...draft, scale })} />
            <div className="seed-field">
              <label htmlFor="seed">{t('Random seed', 'Зерно генератора')}</label>
              <input inputMode="numeric" id="seed" name="seed" autoComplete="off" value={seedText}
                aria-invalid={!validSeed} aria-describedby={!validSeed ? 'seed-error' : undefined}
                onChange={event => setSeedText(event.currentTarget.value)} />
              {!validSeed && <small id="seed-error">{t('Enter an integer from 0 to 4,294,967,295.', 'Введите целое число от 0 до 4 294 967 295.')}</small>}
            </div>
          </fieldset>
        </div>
        <p className="parameter-hint">{t('Every change draws a new sample at once. Type exact values in the boxes.', 'Любое изменение сразу разыгрывает новую выборку. Точные значения можно ввести в полях.')}</p>
      </Panel>

      <Panel label={t('Experiment output', 'Результаты эксперимента')} className="outputs">
        <AutoplayBar playback={playback} onStep={nextDraw} stepLabel={t('New sample', 'Новая выборка')} announce status={status}
          onRestart={() => setRun(newRun(run.settings, reduced === true, true))}
          progress={run.phase !== 'complete' ? run.shown / run.settings.count : null} progressLabel={t('Simulation progress', 'Ход моделирования')} />
        <Tabs.Root value={mode} onValueChange={value => setMode(value as (typeof modes)[number])}>
          <PanelHeading icon={<Activity size={17} aria-hidden />} title={t('Distribution output', 'Распределение выборки')}
            trailing={<Tabs.List aria-label={t('Data view', 'Вид данных')} className="tabs">{modes.map(item => <Tabs.Trigger key={item} value={item}>{modeName(item)}</Tabs.Trigger>)}</Tabs.List>} />
          <div className="plot-toolbar">
            <span className="plot-model">{t(`${run.settings.distribution === 'normal' ? 'Normal' : model.label} distribution`, `${model.label.split(' (')[0]} распределение`)} <b><Tex tex={model.notation} /></b></span>
            <label className="theory-toggle">
              <input type="checkbox" checked={theory} disabled={mode === 'ASCII'} onChange={event => setTheory(event.currentTarget.checked)} />
              <span aria-hidden /><span>{t('Theory overlay', 'Теоретическая кривая')}</span>
            </label>
          </div>
          {modes.map(item => <Tabs.Content key={item} value={item} className="tab-content">
            <motion.div initial={reduced ? false : { opacity: 0.45 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.16 }}>
              <p className="plot-axis"><MathText text={item === 'Histogram' && run.phase !== 'complete' ? t(String.raw`Accumulating density · $\dfrac{\text{count}}{\text{target } n \times \text{bin width}}$`, String.raw`Накопление плотности · $\dfrac{\text{число}}{\text{целевое } n \times \text{ширина интервала}}$`) : guide[item]} /></p>
              {item === 'ASCII' ?
                <div className="ascii"><pre aria-hidden data-testid="ascii-data">{asciiHistogram(hist.counts, 12, Math.max(1, ...finalBins.counts))}</pre>
                  <p>{t(`Bin counts · ${number.format(sample.length)} observations`, `Частоты интервалов · наблюдений: ${number.format(sample.length)}`)}</p></div>
                : <Plot sample={sample} settings={run.settings} mode={item === 'ECDF' ? 'ecdf' : 'histogram'} showTheory={theory} densityPeak={densityPeak} />}
            </motion.div>
          </Tabs.Content>)}
          <div className="chart-legend">
            <span><i /> {t('Observed sample', 'Наблюдаемая выборка')}</span>
            {theory && mode !== 'ASCII' && <span><i className="line-key" /> {t('Theoretical model', 'Теоретическая модель')}</span>}
            {hist.outside > 0 && <span>{t(`${hist.outside} outside visible range`, `Вне видимого диапазона: ${hist.outside}`)}</span>}
          </div>
        </Tabs.Root>
        <dl className="stats">
          <Stat label={t('Sample mean', 'Выборочное среднее')} actual={fixed(summary?.mean)} theoretical={fixed(theoreticalMean)} id="sample-mean" />
          <Stat label={t('Sample variance', 'Выборочная дисперсия')} actual={fixed(summary?.variance)} theoretical={fixed(theoreticalVariance)} />
          <Stat label={t('Std. deviation', 'Ср. кв. отклонение')} actual={fixed(summary?.deviation)} theoretical={fixed(Math.sqrt(theoreticalVariance))} />
          <Stat label={t('Observations', 'Наблюдения')} referenceLabel={t('Target', 'Цель')} actual={number.format(sample.length)} theoretical={number.format(run.settings.count)} />
        </dl>
      </Panel>
    </div>

    <Panel label={t('Theory and bin data', 'Теория и данные интервалов')} className="theory-panel">
      <PanelHeading icon={<CircleHelp size={16} aria-hidden />} title={t('Reading the experiment', 'Как читать эксперимент')} />
      <div className="theory-body">
        <div><p>{model.description}</p><p>{t('Sample variance uses ', 'Выборочная дисперсия вычисляется с делителем ')}<Tex tex="n - 1" />{t('. The histogram, empirical CDF and ASCII view all use the same seed and observations.', '. Гистограмма, эмпирическая функция распределения и ASCII-вид построены по одним и тем же наблюдениям с одним зерном.')}</p>{run.settings.distribution === 'normal' && <p>{t('The normal CDF uses a numerical approximation.', 'Нормальная функция распределения вычисляется приближённо.')}</p>}</div>
        <details>
          <summary>{t('View bin data', 'Показать данные интервалов')}</summary>
          <div className="table-scroll">
            <table aria-label={t('Histogram bins', 'Интервалы гистограммы')}><thead><tr><th scope="col">{t('Range', 'Интервал')}</th><th scope="col">{t('Count', 'Частота')}</th><th scope="col">{t('Density', 'Плотность')}</th></tr></thead>
              <tbody>{hist.counts.map((count, index) => {
                const lo = domain[0] + hist.width * index;
                return <tr key={index}><th scope="row">{fixed(lo)} – {fixed(lo + hist.width)}</th><td>{count}</td><td>{fixed(hist.density[index])}</td></tr>;
              })}</tbody>
            </table>
          </div>
        </details>
      </div>
    </Panel>
  </div>;
}

const DEFAULT_SEED = 2048;
const orbitKey = 'statum-lab:orbit';
const readOrbit = (): OrbitId => {
  try {
    const v = localStorage.getItem(orbitKey);
    if (orbits.some((o) => o.id === v)) return v as OrbitId;
    const last = readLastVisited();
    return last ? orbitOfModule(last) : 'variables';
  } catch {
    return 'variables';
  }
};

/** The program: one scene. The URL hash decides which orbit is shown and what is open inside the scene. */
function StationApp() {
  const lang = useLang();
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [orbit, setOrbit] = useState<OrbitId>(() => {
    const station = route.station ? findStation(route.station) : null;
    return station?.orbit ?? route.orbit ?? readOrbit();
  });
  const [results, setResults] = useState(readLastResults);
  const [lastVisited, setLastVisited] = useState<string | undefined>(readLastVisited);
  const settings = results.distribution?.settings ?? initialSettings;
  const station = route.station ? findStation(route.station) ?? null : null;
  const lecture = route.lecture ? findLecture(route.lecture.n) : null;
  const back = route.back ? { ...route.back, present: route.present } : null;

  const complete = useCallback((id: ModuleId, result: LastResult) => {
    setResults(current => ({ ...current, [id]: result }));
    writeLastResult(id, result);
  }, []);
  const completeDistribution = useCallback((resultSettings: RunSettings) => {
    complete('distribution', { settings: resultSettings, size: resultSettings.count });
  }, [complete]);

  useEffect(() => {
    const navigate = () => {
      const next = parseRoute(window.location.hash);
      setRoute(next);
      const s = next.station ? findStation(next.station) : null;
      if (s) setOrbit(s.orbit);
      else if (next.orbit) setOrbit(next.orbit);
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(orbitKey, orbit); } catch { /* private mode: the URL still carries the orbit */ }
  }, [orbit]);
  useEffect(() => {
    if (!station) return;
    setLastVisited(station.id);
    if (station.kind === 'legacy') writeLastVisited(station.module);
  }, [station]);
  useEffect(() => {
    function synchronize(event: StorageEvent) {
      if (event.key === null || event.key.startsWith(historyPrefix)) {
        setResults(readLastResults());
        setLastVisited(readLastVisited());
      }
    }
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, []);
  useEffect(() => {
    const title = station?.name ?? (lecture ? t(`Lecture ${lecture.lecture}`, `Лекция ${lecture.lecture}`) : route.drawer === 'notes' ? t('Lab notes', 'Заметки') : route.drawer === 'record' ? t('Sample record', 'Журнал выборки') : route.drawer === 'lectures' ? t('Lectures', 'Лекции') : orbits.find(o => o.id === orbit)!.name);
    document.title = title + ' · STATUM LAB';
  }, [station, lecture, route.drawer, orbit, lang]);

  const backHash = back ? lectureHash(back) : null;
  const close = useCallback(() => {
    // A station opened from a lecture step closes back to that step.
    window.location.hash = backHash ?? orbitHash(orbit);
  }, [orbit, backHash]);

  let overlay = null;
  if (station) {
    const legacy = route.seed == null && !pinned(route) ? settings : legacySettings(settings, route.seed, route.params);
    const lead = <><MathText text={station.summary} /> <span className="dock-lecture">{t(`Lecture ${station.lectures}`, station.lectures)}</span>
      {backHash && <a className="dock-back" href={backHash}>{t(`← Back to lecture ${back!.n}, step ${back!.step}`, `← Назад к лекции ${back!.n}, шаг ${back!.step}`)}</a>}</>;
    overlay = (
      <SceneDock key={station.id} title={station.name} eyebrow={<><i /> {t('STATION · ORBIT', 'СТАНЦИЯ · ОРБИТА')} {orbits.find(o => o.id === station.orbit)!.numeral}</>} lead={lead} onClose={close} testId="station-dock">
        {station.kind === 'kernel' ? (
          <KernelStation station={station} seed={route.seed ?? DEFAULT_SEED} params={route.params}
            onState={(seed, params) => {
              // Replace, not push: autoplay draws must not flood the back button, and no hashchange re-mounts the station.
              const hash = stationHash(station.id, seed, params, back);
              if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
            }} />
        ) : station.module === 'distribution' ? (
          <Workspace settings={legacy} onComplete={completeDistribution} />
        ) : (
          <MethodPreview id={station.module} activeSettings={legacy}
            lastResult={pinned(route) ? undefined : results[station.module]}
            onComplete={result => complete(station.module, result)} />
        )}
      </SceneDock>
    );
  } else if (lecture && route.lecture) {
    overlay = (
      <SceneDock key="lecture" className="scene-dock--lecture" title={lectureText(lecture.lecture, lecture.title)} testId="lecture-dock"
        eyebrow={<><i /> {t('LECTURE', 'ЛЕКЦИЯ')} {lecture.lecture}{lecture.status !== 'ready' ? t(' · DRAFT SCRIPT', ' · ЧЕРНОВИК СЦЕНАРИЯ') : ''}</>} onClose={close}>
        <LecturePlayer lecture={lecture} step={route.lecture.step} present={route.present} />
      </SceneDock>
    );
  } else if (route.drawer === 'lectures') {
    overlay = (
      <SceneDock key="lectures" side="end" title={t('Lectures', 'Лекции')} lead={t('Walk through a lecture step by step and open its experiments.', 'Пройдите лекцию шаг за шагом и откройте её эксперименты.')} onClose={close} testId="drawer-lectures">
        <LectureList />
      </SceneDock>
    );
  } else if (route.drawer) {
    overlay = (
      <SceneDock key={route.drawer} side="end" title={route.drawer === 'notes' ? t('Lab notes', 'Заметки') : t('Sample record', 'Журнал выборки')} onClose={close} testId={`drawer-${route.drawer}`}>
        {route.drawer === 'notes' ? <LabNotesContent /> : <SampleRecord settings={settings} />}
      </SceneDock>
    );
  }
  return <Observatory settings={settings} orbit={orbit} openStation={station?.id ?? null} openKey={station?.id ?? route.drawer} results={results}
    lastVisited={lastVisited} onSample={completeDistribution} overlay={overlay} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><MotionConfig reducedMotion="user"><StationApp /></MotionConfig></StrictMode>,
);
