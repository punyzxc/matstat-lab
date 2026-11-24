import { useMemo, useState } from 'react';
import { FigureCaption } from './lab-shell';
import type { LastResult } from './last-results';
import { moduleReadout } from './method-readouts';
import { modules, type ModuleId } from './modules';
import { Trace } from './sample-readouts';
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
  const m = modules.find(({ id: moduleId }) => moduleId === id)!;
  const [settings, setSettings] = useState(lastResult?.settings ?? activeSettings);
  const [size, setSize] = useState(lastResult?.size ?? settings.count);
  const [recorded, setRecorded] = useState(Boolean(lastResult));
  const all = useMemo(() => collect(settings), [settings]);
  const sample = useMemo(() => all.slice(0, size), [all, size]);
  const data = moduleReadout(id, sample, settings);
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
  return <div className="station-legacy">
      <div className="method-desk">
        <section>
          <FigureCaption number="A">Sample prefix</FigureCaption>
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
          <div className="method-trace">
            <Trace sample={sample.slice(0, 48)} animate={false} />
          </div>
          <p className="session-source">
            {sources[settings.distribution].label} · seed {settings.seed}
          </p>
          <div className="method-result-actions">
            {!recorded && <Button onClick={() => analyze(size)}>Save result</Button>}
            {hasNewSample && (
              <Button onClick={() => analyze(activeSettings.count, activeSettings)}>
                Use active sample
              </Button>
            )}
          </div>
        </section>
        <section className="method-value" aria-live="polite">
          <FigureCaption number="B">{data.label}</FigureCaption>
          <strong>{data.value}</strong>
          <code>{data.formula}</code>
          <p>{data.detail}</p>
        </section>
      </div>
</div>;
}
