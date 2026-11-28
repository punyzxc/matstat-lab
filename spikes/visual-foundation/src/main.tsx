import '@fontsource-variable/space-grotesk';
import { MathText } from './math';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './style.css';
import './quality.css';
import './i18n-tables';
import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { Observatory, SampleRecord } from './observatory';
import { MethodPreview } from './method-preview';
import { historyPrefix, readLastResults, readLastVisited, writeLastResult, writeLastVisited, type LastResult } from './last-results';
import type { ModuleId } from './modules';
import { LabNotesContent } from './lab-shell';
import { findStation, orbitOfModule, orbits, type OrbitId } from './stations/catalog';
import { KernelStation } from './stations/kernel-station';
import { lectureHash, orbitHash, parseRoute, stationHash, type Route } from './stations/route';
import { findLecture, LectureList, LecturePlayer } from './lectures/player';
import { SceneDock } from './stations/station-dock';
import { lectureText, t, useLang } from './i18n';
import { initialSettings, sources, type Distribution, type RunSettings } from './statistics.ts';
import { useAdaptiveQuality } from './quality';

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
/** Lecture links written for the old Explorer still carry its knobs: `dist` (0 normal, 1 uniform, 2 exponential, the kernel's
 * own law numbering) and `scale` (the normal law's sigma, the uniform law's half-width, the exponential law's mean). The kernel
 * station reads them as its law and parameters, so `#station/distribution?dist=2&n=1024&scale=1` opens the same experiment. */
export function explorerParams(params: Record<string, number>): Record<string, number> {
  if (!('dist' in params) && !('scale' in params)) return params;
  const { dist, scale, ...out } = params;
  if (!('law' in out) && Number.isInteger(dist) && dist >= 0 && dist <= 2) out.law = dist;
  if (Number.isFinite(scale) && scale > 0) {
    const law = out.law ?? 0;
    if (law === 0 && !('sigma' in out)) out.sigma = scale;
    if (law === 1 && !('lo' in out) && !('hi' in out)) { out.lo = -scale; out.hi = scale; }
    if (law === 2 && !('lambda' in out)) out.lambda = 1 / scale;
  }
  return out;
}
const pinned = (route: Route) => route.seed != null || ['n', 'scale', 'dist'].some((k) => k in route.params);

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
  useAdaptiveQuality();
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

  /** The scene's shared sample (the observatory's own sample controls); the old Explorer workspace is a kernel station now (#91). */
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
    // A station opened from a lecture step closes back to that step. Read the live address, not the
    // rendered route: an Escape pressed in the same instant as a link click must follow the new hash.
    const live = parseRoute(window.location.hash);
    window.location.hash = live.back ? lectureHash({ ...live.back, present: live.present }) : orbitHash(orbit);
  }, [orbit]);

  let overlay = null;
  if (station) {
    const legacy = route.seed == null && !pinned(route) ? settings : legacySettings(settings, route.seed, route.params);
    const lead = <><MathText text={station.summary} /> <span className="dock-lecture">{t(`Lecture ${station.lectures}`, station.lectures)}</span>
      {backHash && <a className="dock-back" href={backHash}>{t(`← Back to lecture ${back!.n}, step ${back!.step}`, `← Назад к лекции ${back!.n}, шаг ${back!.step}`)}</a>}</>;
    overlay = (
      <SceneDock key={station.id} title={station.name} eyebrow={<><i /> {t('STATION · ORBIT', 'СТАНЦИЯ · ОРБИТА')} {orbits.find(o => o.id === station.orbit)!.numeral}</>} lead={lead} onClose={close} testId="station-dock">
        {station.kind === 'kernel' ? (
          <KernelStation station={station} seed={route.seed ?? DEFAULT_SEED} params={station.id === 'distribution' ? explorerParams(route.params) : route.params} texts={route.texts} snaps={route.snaps}
            onState={(seed, params, texts, snaps) => {
              // Replace, not push: autoplay draws must not flood the back button, and no hashchange re-mounts the station.
              const hash = stationHash(station.id, seed, params, back, texts, snaps);
              if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
            }} />
        ) : (
          <MethodPreview id={station.module} activeSettings={legacy}
            lastResult={pinned(route) ? undefined : results[station.module]}
            onComplete={result => complete(station.module, result)} />
        )}
      </SceneDock>
    );
  } else if (lecture && route.lecture) {
    overlay = (
      <SceneDock key="lecture" className={`scene-dock--lecture${lecture.story ? ' scene-dock--story' : ''}`} title={lectureText(lecture.lecture, lecture.title)} testId="lecture-dock"
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
