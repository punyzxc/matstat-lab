import { useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, RotateCw } from 'lucide-react';
import { FigureCaption, LabFooter, LabHeader } from './lab-shell';
import { PlateGlyph } from './plate-glyph';
import { SpecimenView } from './specimen-view';
import { Matrix, Trace } from './sample-readouts';
import { useStationReducedMotion } from './motion-preference';
import { collect, moments, sources, type RunSettings, type Distribution } from './statistics';
import { moduleReadout } from './method-readouts';
import { modules, type ModuleId } from './modules';
import './observatory.css';

const pad = (n: number) => String(n).padStart(2, '0');
const fixed = (v: number) => v.toFixed(3).replace(/^-0\.000$/, '0.000');
function ExperimentIndex({
  selected,
  onSelect,
  reduced,
}: {
  selected: ModuleId;
  onSelect: (m: ModuleId) => void;
  reduced: boolean;
}) {
  const current = modules.find((m) => m.id === selected)!;
  return (
    <section className="index-section" id="experiments" aria-labelledby="index-title">
      <div className="section-heading">
        <h2 id="index-title" tabIndex={-1}>
          Experiment index
        </h2>
        <span>01 — {pad(modules.length)}</span>
      </div>
      <Tabs.Root value={selected} onValueChange={(v) => onSelect(v as ModuleId)}>
        <Tabs.List
          className="index-strip"
          aria-label="Laboratory modules"
          onKeyDownCapture={(e) => {
            if (!window.matchMedia('(max-width:600px)').matches) return;
            const steps: Record<string, number> = { ArrowUp: -2, ArrowDown: 2, ArrowLeft: -1, ArrowRight: 1 };
            if (!(e.key in steps)) return;
            const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]'));
            const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
            if (index < 0) return;
            e.preventDefault();
            e.stopPropagation();
            tabs[(index + steps[e.key] + tabs.length) % tabs.length].focus();
          }}
        >
          {modules.map((m, i) => (
            <Tabs.Trigger key={m.id} value={m.id} className="index-tab">
              <span className="index-num">
                {pad(i + 1)}
                <i />
              </span>
              <PlateGlyph id={m.id} />
              <span className="index-name">{m.name}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {modules.map((m) => (
          <Tabs.Content key={m.id} value={m.id} className="index-detail">
            <motion.span
              initial={reduced ? false : { opacity: 0.55 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16 }}
            >
              {current.description}
            </motion.span>
            <a href={'#module/' + m.id} aria-label={'Open module — ' + m.name}>
              Open module <ArrowRight size={15} />
            </a>
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </section>
  );
}
export function Observatory({
  settings,
  initialModule,
  onSelect,
  onSample,
}: {
  settings: RunSettings;
  initialModule: ModuleId;
  onSelect: (m: ModuleId) => void;
  onSample: (s: RunSettings) => void;
}) {
  const reduced = useStationReducedMotion();
  const [paused, setPaused] = useState(false);
  const sample = useMemo(() => collect(settings), [settings]);
  const stats = useMemo(() => moments(sample)!, [sample]);
  const playing = !reduced && !paused;
  return (
    <div className="atlas">
      <a className="skip" href="#experiments">
        Skip to experiments
      </a>
      <LabHeader home />
      <main className="lab-spread">
        <section className="atlas-hero" aria-labelledby="atlas-title">
          <div className="atlas-intro">
            <div className="edition">
              <i /> COMPUTATIONAL STATISTICS
            </div>
            <h1 id="atlas-title">
              Probability
              <br />
              <em>atlas</em>
              <span aria-hidden="true">.</span>
            </h1>
            <p>Choose a model and inspect how each draw maps to a probability on the knot.</p>
            <div className="live-model">
              <label htmlFor="atlas-model">Model</label>
              <span>
                <select
                  id="atlas-model"
                  name="atlas-model"
                  value={settings.distribution}
                  onChange={(e) =>
                    onSample({ ...settings, distribution: e.currentTarget.value as Distribution })
                  }
                >
                  {Object.entries(sources).map(([key, model]) => (
                    <option key={key} value={key}>
                      {model.label.split(' (')[0]}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} aria-hidden="true" />
              </span>
              <small>n = {settings.count}</small>
            </div>
            <a className="launch" href={'#module/' + initialModule}>
              Launch experiment <ArrowUpRight size={17} />
            </a>
          </div>
          <SpecimenView
            settings={settings}
            sample={sample}
            playing={playing}
            reduced={reduced}
            toggle={() => setPaused((v) => !v)}
          />
        </section>
        <ExperimentIndex selected={initialModule} onSelect={onSelect} reduced={reduced} />
        <section className="record" aria-labelledby="record-title">
          <div className="record-title">
            <div className="edition">
              <i /> ACTIVE SAMPLE
            </div>
            <h2 id="record-title">Session record</h2>
            <div className="session-source">
              {sources[settings.distribution].label} · seed {settings.seed}
            </div>
            <button
              className="resample"
              onClick={() => onSample({ ...settings, seed: (settings.seed + 1) >>> 0 })}
            >
              <RotateCw size={13} /> Resample
            </button>
          </div>
          <div className="record-figure">
            <FigureCaption number="A">Draw sequence</FigureCaption>
            <Trace sample={sample.slice(0, 48)} animate={playing} />
          </div>
          <div className="record-figure">
            <FigureCaption number="B">Frequency / ASCII</FigureCaption>
            <Matrix sample={sample} settings={settings} />
          </div>
          <dl className="metric-list">
            {[
              ['Sample mean', fixed(stats.mean)],
              ['Variance', fixed(stats.variance!)],
              ['Std. deviation', fixed(stats.deviation!)],
              ['Observations', sample.length],
            ].map(([key, val]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{val}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <LabFooter />
    </div>
  );
}
export function MethodPreview({ id, settings }: { id: ModuleId; settings: RunSettings }) {
  const m = modules.find((v) => v.id === id)!;
  const [size, setSize] = useState(settings.count);
  const all = useMemo(() => collect(settings), [settings]);
  const sample = useMemo(() => all.slice(0, size), [all, size]);
  const data = moduleReadout(id, sample, settings);
  return (
    <div className="atlas method-page">
      <LabHeader />
      <main className="lab-spread">
        <a href="#observatory" className="backlink">
          <ArrowLeft size={14} /> Probability atlas
        </a>
        <div className="method-intro">
          <div>
            <div className="edition">
              <i /> EXPERIMENT {pad(modules.indexOf(m) + 1)}
            </div>
            <h1>{m.name}</h1>
            <p>{m.description}</p>
          </div>
          <PlateGlyph id={id} />
        </div>
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
              onChange={(e) => setSize(e.currentTarget.valueAsNumber)}
            />
            <div className="method-trace">
              <Trace sample={sample.slice(0, 48)} animate={false} />
            </div>
            <p className="session-source">
              {sources[settings.distribution].label} · seed {settings.seed}
            </p>
          </section>
          <section className="method-value" aria-live="polite">
            <FigureCaption number="B">{data.label}</FigureCaption>
            <strong>{data.value}</strong>
            <code>{data.formula}</code>
            <p>{data.detail}</p>
          </section>
        </div>
      </main>
      <LabFooter />
    </div>
  );
}
