import { useMemo, useState } from 'react';
import { MathText, Tex } from './math';
import { AutoplayBar, useAutoplayKeys, usePlayback, useTicker, type Playback } from './stations/autoplay';
import { FigureCaption } from './lab-shell';
import type { LastResult } from './last-results';
import { moduleReadout } from './method-readouts';
import type { ModuleId } from './modules';
import { Chart } from './stations/chart';
import { methodSeries } from './stations/method-series';
import { collect, sources, type RunSettings } from './statistics';
import { Button, Slider } from './ui';
import { dec, kernelText, t, texDec, useLang } from './i18n';

export function MethodPreview({
  id,
  activeSettings,
  lastResult,
  onComplete,
}: {
  id: ModuleId;
  activeSettings: RunSettings;
  lastResult?: LastResult;
  onComplete: (result: LastResult) => void;
}) {
  const [settings, setSettings] = useState(lastResult?.settings ?? activeSettings);
  const pace = usePlayback();
  const goal = lastResult?.size ?? settings.count;
  // Autoplay: the observations arrive batch by batch on open, so the method's path draws itself.
  const [size, setSize] = useState(pace.playing ? Math.min(8, goal) : goal);
  const [target, setTarget] = useState(goal);
  const [recorded, setRecorded] = useState(Boolean(lastResult));
  const batch = Math.max(1, Math.ceil(settings.count / 48));
  const growing = pace.playing && size < target;
  useTicker(growing, Math.round(70 / pace.speed), size, () => {
    const next = Math.min(target, size + batch);
    setSize(next);
    if (next >= target) pace.setPlaying(false);
  });
  const playback: Playback = {
    ...pace,
    playing: growing,
    setPlaying: (v) => {
      const next = typeof v === 'function' ? v(growing) : v;
      if (next && size >= target) {
        setTarget(settings.count);
        setSize(8);
      }
      pace.setPlaying(next);
    },
  };
  const step = () => {
    pace.setPlaying(false);
    setSize((s) => (s >= settings.count ? 8 : Math.min(settings.count, s + batch)));
  };
  useAutoplayKeys(() => playback.setPlaying((p) => !p), step);
  const all = useMemo(() => collect(settings), [settings]);
  const sample = useMemo(() => all.slice(0, size), [all, size]);
  const data = moduleReadout(id, sample, settings, t);
  const lang = useLang();
  const chart = useMemo(() => {
    const c = methodSeries(id, sample, settings);
    const k = (text: string) => kernelText('method-series', text);
    return { ...c, x: k(c.x), y: k(c.y), series: c.series.map((s) => (s.label ? { ...s, label: k(s.label) } : s)) };
  }, [id, sample, settings, lang]);
  const hasNewSample =
    settings.seed !== activeSettings.seed ||
    settings.count !== activeSettings.count ||
    settings.distribution !== activeSettings.distribution ||
    settings.scale !== activeSettings.scale;

  function analyze(observations: number, nextSettings = settings) {
    pace.setPlaying(false);
    setTarget(observations);
    setSettings(nextSettings);
    setSize(observations);
    setRecorded(true);
    onComplete({ settings: nextSettings, size: observations });
  }
  return (
    <div className="station-legacy method-station">
      <section className="method-figure" aria-label={t('Experiment chart', 'График эксперимента')}>
        <FigureCaption number="A"><MathText text={chart.y} /></FigureCaption>
        <Chart series={chart.series} xLabel={chart.x} yLabel={chart.y} height={250} domain={chart.domain} />
      </section>
      <div className="method-desk">
        <section>
          <FigureCaption number="B">{t('Sample prefix', 'Начало выборки')}</FigureCaption>
          <AutoplayBar playback={playback} onStep={step} stepLabel={t('More observations', 'Больше наблюдений')}
            status={growing ? t(`Adding observations · ${size} of ${target}`, `Добавление наблюдений · ${size} из ${target}`) : t(`${size} of ${settings.count} observations`, `Наблюдений: ${size} из ${settings.count}`)} progress={growing ? size / target : null} />
          <Slider id="prefix-size" label={t('Observations', 'Наблюдения')} value={size} display={String(size)} min={8} max={settings.count} step={1}
            onChange={(v) => analyze(v)} />
          <p className="session-source">
            {sources[settings.distribution].label} · {t('seed', 'зерно')} {settings.seed}
          </p>
          <div className="method-result-actions">
            {!recorded && <Button onClick={() => analyze(size)}>{t('Save Result', 'Сохранить результат')}</Button>}
            {hasNewSample && (
              <Button onClick={() => analyze(activeSettings.count, activeSettings)}>{t('Use Active Sample', 'Взять активную выборку')}</Button>
            )}
          </div>
        </section>
        <section className="method-value" aria-live="polite">
          <FigureCaption number="C">{data.label}</FigureCaption>
          <strong>{dec(data.value)}</strong>
          <code><Tex tex={texDec(data.formula)} /></code>
          <p><MathText text={dec(data.detail)} /></p>
        </section>
      </div>
    </div>
  );
}
