import { useMemo, useState } from 'react';
import { AutoplayBar, useAutoplayKeys, usePlayback, useTicker, type Playback } from './stations/autoplay';
import { FigureCaption } from './lab-shell';
import type { LastResult } from './last-results';
import { moduleReadout } from './method-readouts';
import type { ModuleId } from './modules';
import { Chart } from './stations/chart';
import { methodSeries } from './stations/method-series';
import { collect, sources, type RunSettings } from './statistics';
import { Button, Slider } from './ui';

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
  const data = moduleReadout(id, sample, settings);
  const chart = useMemo(() => methodSeries(id, sample, settings), [id, sample, settings]);
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
      <section className="method-figure" aria-label="Experiment chart">
        <FigureCaption number="A">{chart.y}</FigureCaption>
        <Chart series={chart.series} xLabel={chart.x} yLabel={chart.y} height={250} domain={chart.domain} />
      </section>
      <div className="method-desk">
        <section>
          <FigureCaption number="B">Sample prefix</FigureCaption>
          <AutoplayBar playback={playback} onStep={step} stepLabel="More observations"
            status={growing ? `Adding observations · ${size} of ${target}` : `${size} of ${settings.count} observations`} progress={growing ? size / target : null} />
          <Slider id="prefix-size" label="Observations" value={size} display={String(size)} min={8} max={settings.count} step={1}
            onChange={(v) => analyze(v)} />
          <p className="session-source">
            {sources[settings.distribution].label} · seed {settings.seed}
          </p>
          <div className="method-result-actions">
            {!recorded && <Button onClick={() => analyze(size)}>Save Result</Button>}
            {hasNewSample && (
              <Button onClick={() => analyze(activeSettings.count, activeSettings)}>Use Active Sample</Button>
            )}
          </div>
        </section>
        <section className="method-value" aria-live="polite">
          <FigureCaption number="C">{data.label}</FigureCaption>
          <strong>{data.value}</strong>
          <code>{data.formula}</code>
          <p>{data.detail}</p>
        </section>
      </div>
    </div>
  );
}
