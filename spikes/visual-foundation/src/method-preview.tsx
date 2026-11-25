import { useMemo, useState } from 'react';
import { MathText, Tex } from './math';
import { FigureCaption } from './lab-shell';
import type { LastResult } from './last-results';
import { moduleReadout } from './method-readouts';
import type { ModuleId } from './modules';
import { Chart } from './stations/chart';
import { methodSeries } from './stations/method-series';
import { collect, sources, type RunSettings } from './statistics';
import { Button } from './ui';

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
  const [size, setSize] = useState(lastResult?.size ?? settings.count);
  const [recorded, setRecorded] = useState(Boolean(lastResult));
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
    setSettings(nextSettings);
    setSize(observations);
    setRecorded(true);
    onComplete({ settings: nextSettings, size: observations });
  }
  return (
    <div className="station-legacy method-station">
      <section className="method-figure" aria-label="Experiment chart">
        <FigureCaption number="A"><MathText text={chart.y} /></FigureCaption>
        <Chart series={chart.series} xLabel={chart.x} yLabel={chart.y} height={250} domain={chart.domain} />
      </section>
      <div className="method-desk">
        <section>
          <FigureCaption number="B">Sample prefix</FigureCaption>
          <label htmlFor="prefix-size">
            Observations <output>{size}</output>
          </label>
          <input
            id="prefix-size"
            type="range"
            name="prefix-size"
            min={8}
            max={settings.count}
            value={size}
            onChange={(e) => analyze(e.currentTarget.valueAsNumber)}
          />
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
          <code><Tex tex={data.formula} /></code>
          <p><MathText text={data.detail} /></p>
        </section>
      </div>
    </div>
  );
}
